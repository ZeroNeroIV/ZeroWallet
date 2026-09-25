/**
 * Purpose: Automatic transaction categorization (Laya) via Gemini structured output
 *
 * Inputs:
 *   - request (CategorizeRequest): description, type, optional amount
 *   - options (CategorizationOptions): thresholds, categories, userId
 *
 * Outputs:
 *   - Returns (CategorizationOutcome): matched category + confidence, or
 *     on-demand new-category proposal instead of falling back to "Other"
 *
 * Side effects:
 *   - Makes HTTP requests to Google Gemini API when API key is configured
 *   - Queries CategoryRepository when categories are not supplied
 */

import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { useSettingsStore } from '../../store/settingsStore';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import type { Category, CategoryType } from '../../types/models';
import type {
  CategorizationOptions,
  CategorizationOutcome,
  CategorizeRequest,
  NewCategoryProposal,
  RawCategoryModelResponse,
} from '../../types/categorization';
import { CATEGORIZATION_DEFAULTS } from '../../types/categorization';

const TAG = '[Categorization]';

// Palette for on-demand categories (matches CreateCategoryScreen tones)
const NEW_CATEGORY_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#A8E6CF',
  '#FF8B94',
  '#B4A7D6',
  '#89CFF0',
  '#06D6A0',
  '#118AB2',
  '#FFD166',
  '#EF476F',
  '#8338EC',
  '#F77F00',
  '#3A86FF',
];

// Keyword -> icon hint for newly created categories
const KEYWORD_ICON_HINTS: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['coffee', 'cafe', 'starbucks', 'restaurant', 'food', 'pizza', 'burger', 'dining', 'grocery', 'supermarket', 'market'], icon: 'food' },
  { keywords: ['uber', 'taxi', 'bus', 'train', 'metro', 'fuel', 'gas', 'parking', 'flight', 'airline', 'transport'], icon: 'car' },
  { keywords: ['netflix', 'spotify', 'cinema', 'movie', 'game', 'concert', 'theater', 'entertainment'], icon: 'movie' },
  { keywords: ['electric', 'water', 'internet', 'phone', 'rent', 'utility', 'bill', 'gas bill'], icon: 'receipt' },
  { keywords: ['pharmacy', 'doctor', 'hospital', 'clinic', 'health', 'gym', 'fitness'], icon: 'medical-bag' },
  { keywords: ['school', 'course', 'book', 'tuition', 'education', 'udemy'], icon: 'school' },
  { keywords: ['salary', 'payroll', 'wage', 'paycheck'], icon: 'briefcase' },
  { keywords: ['freelance', 'upwork', 'fiverr', 'contract'], icon: 'laptop' },
  { keywords: ['gift', 'donation', 'charity'], icon: 'gift' },
  { keywords: ['shop', 'mall', 'amazon', 'clothing', 'shoes', 'store'], icon: 'shopping' },
];

// Keyword -> existing default category name (fallback when AI is unavailable)
const KEYWORD_CATEGORY_MAP: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['grocery', 'groceries', 'supermarket', 'market', 'food', 'restaurant', 'dining', 'pizza', 'burger', 'cafe', 'coffee', 'starbucks', 'bakery'], category: 'Food & Dining' },
  { keywords: ['uber', 'taxi', 'bus', 'train', 'metro', 'fuel', 'gas station', 'parking', 'flight', 'airline', 'transport'], category: 'Transportation' },
  { keywords: ['netflix', 'spotify', 'cinema', 'movie', 'game', 'concert', 'entertainment', 'subscription'], category: 'Entertainment' },
  { keywords: ['electric', 'water', 'internet', 'phone bill', 'rent', 'utility', 'utilities', 'bill'], category: 'Bills & Utilities' },
  { keywords: ['pharmacy', 'doctor', 'hospital', 'clinic', 'health', 'medical', 'gym'], category: 'Healthcare' },
  { keywords: ['school', 'course', 'book', 'tuition', 'education', 'udemy'], category: 'Education' },
  { keywords: ['salary', 'payroll', 'wage', 'paycheck', 'income'], category: 'Salary' },
  { keywords: ['freelance', 'upwork', 'fiverr', 'contract'], category: 'Freelance' },
  { keywords: ['dividend', 'interest', 'investment', 'stocks'], category: 'Investment' },
  { keywords: ['gift'], category: 'Gift' },
  { keywords: ['amazon', 'mall', 'clothing', 'shoes', 'shopping', 'store', 'shop'], category: 'Shopping' },
];

/**
 * Build the typed question sent to the model.
 * Example: Choose the best category: [groceries, transport, entertainment, utilities, other]
 */
export function buildCategorizationPrompt(
  request: CategorizeRequest,
  categories: Category[],
): string {
  const names = categories.map((c) => c.name);
  const list = names.join(', ');
  const amountLine = request.amount !== undefined ? `\nAmount: ${request.amount}` : '';

  return `You are an expense categorization assistant. Answer with JSON only, no markdown.

Choose the best category: [${list}]

Transaction description: "${request.description}"${amountLine}
Transaction type: ${request.type}

Rules:
1. Pick exactly one name from the list above as "categoryName", matching spelling/case exactly.
2. Return a "confidence" number between 0 and 1.
3. Keep "reasoning" to one short sentence.
4. If NONE of the listed categories fit well (do not force "Other"), set "shouldCreateNew" to true and propose a concise "suggestedNewCategory" with a Title-Case "name" (max 3 words), plus "icon" (a MaterialCommunityIcons name) and "color" (hex).
5. Never invent a categoryName outside the list. Propose new names only inside "suggestedNewCategory".

Return exactly this JSON shape:
{"categoryName": "<one of the listed names>" | null, "confidence": 0.0-1.0, "reasoning": "<short>", "shouldCreateNew": false, "suggestedNewCategory": {"name": "<Title Case>", "icon": "shopping", "color": "#FF6B6B"}}

If everything fits, omit suggestedNewCategory or set it to null. Respond with raw JSON only.`;
}

/**
 * Main entry: categorize a single transaction description.
 */
export async function categorizeTransaction(
  request: CategorizeRequest,
  options: CategorizationOptions = {},
): Promise<CategorizationOutcome> {
  const description = request.description?.trim() ?? '';
  if (!description) {
    throw new Error('Description is required for categorization');
  }

  const allowCreateNew = options.allowCreateNew ?? true;
  const categories = await resolveCategories(request.type, options);
  if (categories.length === 0) {
    throw new Error(`No ${request.type} categories found`);
  }

  const apiKey = useSettingsStore.getState().aiSettings.apiKey;
  if (apiKey) {
    try {
      const raw = await callGeminiCategorize(apiKey, request, categories, options.signal);
      return toOutcome(raw, categories, request, { allowCreateNew });
    } catch (error) {
      logger.warn(TAG, 'Gemini categorization failed, using keyword fallback', error);
    }
  } else {
    logger.info(TAG, 'No AI API key configured, using keyword fallback');
  }

  return keywordFallback(request, categories, allowCreateNew);
}

/**
 * Categorize multiple descriptions efficiently (sequential to respect rate limits).
 */
export async function categorizeBatch(
  requests: CategorizeRequest[],
  options: CategorizationOptions = {},
): Promise<CategorizationOutcome[]> {
  const results: CategorizationOutcome[] = [];
  for (const req of requests) {
    results.push(await categorizeTransaction(req, options));
  }
  return results;
}

/**
 * Create the proposed on-demand category in the database.
 * Returns the created Category.
 */
export async function createProposedCategory(
  userId: string,
  type: CategoryType,
  proposal: NewCategoryProposal,
): Promise<Category> {
  const repo = new CategoryRepository();
  const existing = await repo.findByUser(userId);
  const duplicate = existing.find(
    (c) => c.type === type && c.name.toLowerCase() === proposal.name.toLowerCase(),
  );
  if (duplicate) {
    return duplicate;
  }
  return repo.create({
    userId,
    name: proposal.name,
    type,
    icon: proposal.icon || 'shopping',
    color: proposal.color || config.defaults.color,
    isDefault: false,
  });
}

// ============================================================================
// Gemini call
// ============================================================================

async function callGeminiCategorize(
  apiKey: string,
  request: CategorizeRequest,
  categories: Category[],
  signal?: AbortSignal,
): Promise<RawCategoryModelResponse> {
  const model = useSettingsStore.getState().aiSettings.selectedModel ?? 'gemini-2.5-flash';
  const url = `${config.ai.baseUrl}/${model}:generateContent?key=${apiKey}`;
  const prompt = buildCategorizationPrompt(request, categories);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message ?? `Categorization API failed: ${response.status}`);
  }

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Empty categorization response from model');
  }

  return parseModelJson(text);
}

function parseModelJson(text: string): RawCategoryModelResponse {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned) as RawCategoryModelResponse;
  const confidence = clampConfidence(Number(parsed.confidence));
  return { ...parsed, confidence };
}

// ============================================================================
// Outcome mapping — never settle for "Other" when a new category fits better
// ============================================================================

function toOutcome(
  raw: RawCategoryModelResponse,
  categories: Category[],
  request: CategorizeRequest,
  opts: { allowCreateNew: boolean },
): CategorizationOutcome {
  const confidence = clampConfidence(raw.confidence);
  const matched = matchCategoryName(raw.categoryName, categories);
  const otherCategory = categories.find((c) => c.name.toLowerCase() === 'other') ?? null;

  const suggestedName = raw.suggestedNewCategory?.name?.trim();
  const modelWantsNew = raw.shouldCreateNew === true && !!suggestedName;

  // 1. Model explicitly proposes a new category -> honor it (on-demand creation)
  if (modelWantsNew && opts.allowCreateNew) {
    return {
      kind: 'create_new',
      choice: {
        categoryName: matched?.name ?? otherCategory?.name ?? categories[0].name,
        categoryId: matched?.id ?? otherCategory?.id ?? null,
        confidence,
        reasoning: raw.reasoning || 'No existing category fits well.',
      },
      shouldCreateNew: true,
      newCategory: normalizeProposal(raw, request.description),
      source: 'gemini',
    };
  }

  // 2. Best match is "Other" (or no match / low confidence) -> propose on-demand instead
  const isOther = !matched || matched.name.toLowerCase() === 'other';
  if (isOther && opts.allowCreateNew) {
    const derived = suggestedName || deriveCategoryName(request.description);
    // Don't propose "Other" itself as a new category
    if (derived.toLowerCase() !== 'other') {
      return {
        kind: 'create_new',
        choice: {
          categoryName: otherCategory?.name ?? matched?.name ?? 'Other',
          categoryId: otherCategory?.id ?? matched?.id ?? null,
          confidence,
          reasoning: raw.reasoning || `No good match for "${request.description}".`,
        },
        shouldCreateNew: true,
        newCategory: normalizeProposal(
          {
            ...raw,
            suggestedNewCategory: {
              name: derived,
              icon: raw.suggestedNewCategory?.icon,
              color: raw.suggestedNewCategory?.color,
            },
          },
          request.description,
        ),
        source: 'gemini',
      };
    }
  }

  // 3. Very low confidence with creation allowed -> also propose new instead of guessing
  if (
    opts.allowCreateNew &&
    confidence < CATEGORIZATION_DEFAULTS.LOW_CONFIDENCE_NEW_CATEGORY_THRESHOLD
  ) {
    return {
      kind: 'create_new',
      choice: {
        categoryName: matched?.name ?? otherCategory?.name ?? categories[0].name,
        categoryId: matched?.id ?? otherCategory?.id ?? null,
        confidence,
        reasoning: raw.reasoning || 'Low confidence match.',
      },
      shouldCreateNew: true,
      newCategory: normalizeProposal(
        {
          ...raw,
          suggestedNewCategory: {
            name: suggestedName || deriveCategoryName(request.description),
            icon: raw.suggestedNewCategory?.icon,
            color: raw.suggestedNewCategory?.color,
          },
        },
        request.description,
      ),
      source: 'gemini',
    };
  }

  // 4. Normal match
  if (matched) {
    return {
      kind: 'match',
      choice: {
        categoryName: matched.name,
        categoryId: matched.id,
        confidence,
        reasoning: raw.reasoning || '',
      },
      shouldCreateNew: false,
      newCategory: null,
      source: 'gemini',
    };
  }

  // 5. Defensive fallback (should be rare: model returned unknown name)
  const fallback = otherCategory ?? categories[0];
  return {
    kind: 'match',
    choice: {
      categoryName: fallback.name,
      categoryId: fallback.id,
      confidence: Math.min(confidence, 0.3),
      reasoning: `Unknown model choice "${raw.categoryName}", fell back to ${fallback.name}.`,
    },
    shouldCreateNew: false,
    newCategory: null,
    source: 'gemini',
  };
}

// ============================================================================
// Keyword fallback (offline / no API key)
// ============================================================================

function keywordFallback(
  request: CategorizeRequest,
  categories: Category[],
  allowCreateNew: boolean,
): CategorizationOutcome {
  const haystack = `${request.description} ${request.merchantHint ?? ''}`.toLowerCase();
  const otherCategory = categories.find((c) => c.name.toLowerCase() === 'other') ?? null;

  for (const entry of KEYWORD_CATEGORY_MAP) {
    if (entry.keywords.some((k) => haystack.includes(k))) {
      const matched = matchCategoryName(entry.category, categories);
      if (matched && matched.name.toLowerCase() !== 'other') {
        return {
          kind: 'match',
          choice: {
            categoryName: matched.name,
            categoryId: matched.id,
            confidence: 0.65,
            reasoning: `Keyword match for "${request.description}".`,
          },
          shouldCreateNew: false,
          newCategory: null,
          source: 'keyword_fallback',
        };
      }
    }
  }

  // No keyword hit -> propose on-demand category instead of silently using Other
  if (allowCreateNew) {
    const name = deriveCategoryName(request.description);
    if (name.toLowerCase() !== 'other') {
      return {
        kind: 'create_new',
        choice: {
          categoryName: otherCategory?.name ?? categories[0].name,
          categoryId: otherCategory?.id ?? null,
          confidence: 0.35,
          reasoning: 'No keyword match; new category suggested.',
        },
        shouldCreateNew: true,
        newCategory: buildProposal(name, request.description),
        source: 'keyword_fallback',
      };
    }
  }

  const fallback = otherCategory ?? categories[0];
  return {
    kind: 'match',
    choice: {
      categoryName: fallback.name,
      categoryId: fallback.id,
      confidence: 0.3,
      reasoning: 'No keyword match.',
    },
    shouldCreateNew: false,
    newCategory: null,
    source: 'keyword_fallback',
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function resolveCategories(
  type: CategoryType,
  options: CategorizationOptions,
): Promise<Category[]> {
  if (options.categories) {
    return options.categories.filter((c) => c.type === type);
  }
  if (!options.userId) {
    return [];
  }
  const repo = new CategoryRepository();
  return repo.findByUserAndType(options.userId, type);
}

function matchCategoryName(name: string | null | undefined, categories: Category[]): Category | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  return (
    categories.find((c) => c.name.toLowerCase() === normalized) ??
    categories.find((c) => c.name.toLowerCase().includes(normalized) || normalized.includes(c.name.toLowerCase())) ??
    null
  );
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeProposal(raw: RawCategoryModelResponse, description: string): NewCategoryProposal {
  const name = toTitleCase(raw.suggestedNewCategory?.name?.trim() || deriveCategoryName(description));
  return buildProposal(name, description, raw.suggestedNewCategory?.icon, raw.suggestedNewCategory?.color);
}

function buildProposal(name: string, description: string, icon?: string, color?: string): NewCategoryProposal {
  const cleanName = toTitleCase(name).slice(0, 30) || 'Miscellaneous';
  return {
    name: cleanName,
    icon: icon || guessIcon(`${cleanName} ${description}`),
    color: color || guessColor(cleanName),
    reasoning: `Proposed new category "${cleanName}" for "${description}".`,
  };
}

/** Derive a Title-Case category name from free text (max 3 words). */
export function deriveCategoryName(description: string): string {
  const stopwords = new Set(['the', 'a', 'an', 'at', 'to', 'for', 'of', 'and', 'my', 'on', 'in']);
  const words = description
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !stopwords.has(w.toLowerCase()) && isNaN(Number(w)))
    .slice(0, 3);
  if (words.length === 0) return 'Miscellaneous';
  return toTitleCase(words.join(' '));
}

function guessIcon(text: string): string {
  const lower = text.toLowerCase();
  for (const entry of KEYWORD_ICON_HINTS) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.icon;
  }
  return 'shopping';
}

function guessColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return NEW_CATEGORY_COLORS[hash % NEW_CATEGORY_COLORS.length];
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** True when the app may auto-apply the suggestion without asking. */
export function isAutoApplicable(
  outcome: CategorizationOutcome,
  autoThreshold = CATEGORIZATION_DEFAULTS.AUTO_THRESHOLD,
): boolean {
  return outcome.kind === 'match' && outcome.choice.confidence >= autoThreshold;
}

/** True when the app should show the suggestion for confirmation. */
export function needsConfirmation(
  outcome: CategorizationOutcome,
  suggestThreshold = CATEGORIZATION_DEFAULTS.SUGGEST_THRESHOLD,
): boolean {
  if (outcome.kind === 'create_new') return true;
  return outcome.choice.confidence >= suggestThreshold;
}
