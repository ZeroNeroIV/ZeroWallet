/**
 * Purpose: Automatic transaction categorization with LAYA (on-device engine)
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
 *   - Queries CategoryRepository when categories are not supplied
 *   - No network calls, no API key needed — works fully offline
 */

import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { config } from '../../config';
import type { Category, CategoryType } from '../../types/models';
import type {
  CategorizationOptions,
  CategorizationOutcome,
  CategorizeRequest,
  NewCategoryProposal,
} from '../../types/categorization';
import { CATEGORIZATION_DEFAULTS } from '../../types/categorization';

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
  { keywords: ['coffee', 'cafe', 'starbucks', 'restaurant', 'food', 'pizza', 'burger', 'dining', 'grocery', 'supermarket', 'market', 'bakery', 'kfc', 'mcdonald'], icon: 'food' },
  { keywords: ['uber', 'taxi', 'bus', 'train', 'metro', 'fuel', 'gas', 'parking', 'flight', 'airline', 'transport', 'careem', 'jett'], icon: 'car' },
  { keywords: ['netflix', 'spotify', 'cinema', 'movie', 'game', 'concert', 'theater', 'entertainment', 'shahid', 'osn', 'disney'], icon: 'movie' },
  { keywords: ['electric', 'water', 'internet', 'phone', 'rent', 'utility', 'bill', 'gas bill', 'umneya', 'zain', 'orange', 'maintenance'], icon: 'receipt' },
  { keywords: ['pharmacy', 'doctor', 'hospital', 'clinic', 'health', 'gym', 'fitness', 'dentist', 'medicine'], icon: 'medical-bag' },
  { keywords: ['school', 'course', 'book', 'tuition', 'education', 'udemy', 'university', 'stationery'], icon: 'school' },
  { keywords: ['salary', 'payroll', 'wage', 'paycheck'], icon: 'briefcase' },
  { keywords: ['freelance', 'upwork', 'fiverr', 'contract'], icon: 'laptop' },
  { keywords: ['gift', 'donation', 'charity', 'zakat'], icon: 'gift' },
  { keywords: ['shop', 'mall', 'amazon', 'clothing', 'shoes', 'store', 'shein', 'noon', 'talabat', 'careem now'], icon: 'shopping' },
  { keywords: ['barber', 'salon', 'haircut', 'spa'], icon: 'content-cut' },
  { keywords: ['baby', 'kids', 'toy'], icon: 'baby-face-outline' },
  { keywords: ['pet', 'vet'], icon: 'paw' },
  { keywords: ['desk', 'chair', 'sofa', 'furniture', 'table', 'bed'], icon: 'sofa' },
  { keywords: ['shirt', 'pants', 'shoes', 'dress', 'clothing', 'jacket'], icon: 'tshirt-crew' },
  { keywords: ['phone', 'laptop', 'electronics', 'charger', 'camera'], icon: 'laptop' },
];

// General concepts: specific things roll up into a broad category name
// (e.g. desk OR chair -> Furniture). Each concept optionally maps to an
// existing default category; otherwise LAYA matches/creates by concept name.
const GENERALIZATIONS: Array<{ concept: string; icon: string; category?: string; keywords: string[] }> = [
  { concept: 'Furniture', icon: 'sofa', keywords: ['desk', 'chair', 'sofa', 'couch', 'table', 'bed', 'mattress', 'wardrobe', 'closet', 'shelf', 'shelves', 'lamp', 'furniture', 'drawer', 'cabinet', 'curtain', 'rug', 'carpet', 'pillow', 'blanket', 'office chair'] },
  { concept: 'Clothing', icon: 'tshirt-crew', keywords: ['shirt', 'pants', 'jeans', 'dress', 'shoes', 'sneakers', 'jacket', 'coat', 'sweater', 'tshirt', 't-shirt', 'skirt', 'suit', 'tie', 'clothing', 'apparel', 'boutique', 'tailor', 'socks', 'hat', 'cap', 'bag', 'handbag', 'wallet'] },
  { concept: 'Electronics', icon: 'laptop', keywords: ['phone', 'mobile', 'laptop', 'charger', 'cable', 'headphones', 'earbuds', 'tablet', 'camera', 'monitor', 'keyboard', 'mouse', 'speaker', 'television', 'console', 'electronics', 'gadget', 'smartwatch', 'printer', 'router', 'hard drive', 'ssd'] },
  { concept: 'Groceries', icon: 'cart', category: 'Food & Dining', keywords: ['produce', 'meat', 'milk', 'bread', 'eggs', 'cheese', 'vegetable', 'fruit', 'grocery', 'groceries', 'butcher', 'dairy'] },
  { concept: 'Transport', icon: 'car', category: 'Transportation', keywords: ['car wash', 'carwash', 'toll', 'parking ticket', 'license', 'registration', 'mechanic', 'oil change', 'tires'] },
  { concept: 'Pets', icon: 'paw', keywords: ['pet', 'dog', 'cat', 'vet', 'puppy', 'kitten', 'bird', 'fish tank'] },
  { concept: 'Kids', icon: 'baby-face-outline', keywords: ['baby', 'diaper', 'kids', 'toy', 'toys', 'child', 'stroller', 'school bus'] },
  { concept: 'Beauty', icon: 'content-cut', keywords: ['salon', 'barber', 'cosmetics', 'perfume', 'skincare', 'haircut', 'spa', 'manicure', 'makeup', 'beauty'] },
  { concept: 'Sports', icon: 'dumbbell', keywords: ['football', 'basketball', 'tennis', 'swimming', 'sport', 'sports', 'stadium', 'jersey', 'ball', 'racket'] },
  { concept: 'Home', icon: 'home', keywords: ['cleaning', 'detergent', 'repair', 'plumber', 'electrician', 'decor', 'kitchen', 'bathroom', 'paint', 'faucet', 'locksmith'] },
  { concept: 'Travel', icon: 'airplane', keywords: ['hotel', 'vacation', 'trip', 'booking', 'travel', 'resort', 'passport', 'visa', 'luggage', 'tour'] },
  { concept: 'Finance', icon: 'bank', keywords: ['bank', 'fee', 'fees', 'atm', 'commission', 'tax', 'insurance', 'loan', 'interest charge', 'overdraft'] },
  { concept: 'Work', icon: 'briefcase', keywords: ['office', 'supplies', 'software', 'license key', 'coworking', 'printing'] },
];

// Keyword -> existing default category name (LAYA local matching)
const KEYWORD_CATEGORY_MAP: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['grocery', 'groceries', 'supermarket', 'market', 'food', 'restaurant', 'dining', 'pizza', 'burger', 'cafe', 'coffee', 'starbucks', 'bakery', 'kfc', 'mcdonald', 'talabat', 'breakfast', 'lunch', 'dinner'], category: 'Food & Dining' },
  { keywords: ['uber', 'taxi', 'bus', 'train', 'metro', 'fuel', 'gas station', 'parking', 'flight', 'airline', 'transport', 'careem', 'jett', 'car wash', 'carwash'], category: 'Transportation' },
  { keywords: ['netflix', 'spotify', 'cinema', 'movie', 'game', 'concert', 'entertainment', 'subscription', 'shahid', 'osn', 'disney', 'playstation', 'steam'], category: 'Entertainment' },
  { keywords: ['electric', 'water', 'internet', 'phone bill', 'rent', 'utility', 'utilities', 'bill', 'umneya', 'zain', 'orange', 'maintenance', 'gas bill'], category: 'Bills & Utilities' },
  { keywords: ['pharmacy', 'doctor', 'hospital', 'clinic', 'health', 'medical', 'gym', 'dentist', 'medicine', 'optics'], category: 'Healthcare' },
  { keywords: ['school', 'course', 'book', 'tuition', 'education', 'udemy', 'university', 'stationery'], category: 'Education' },
  { keywords: ['salary', 'payroll', 'wage', 'paycheck', 'income'], category: 'Salary' },
  { keywords: ['freelance', 'upwork', 'fiverr', 'contract'], category: 'Freelance' },
  { keywords: ['dividend', 'interest', 'investment', 'stocks'], category: 'Investment' },
  { keywords: ['gift'], category: 'Gift' },
  { keywords: ['amazon', 'mall', 'clothing', 'shoes', 'shopping', 'store', 'shop', 'shein', 'noon', 'fashion'], category: 'Shopping' },
  { keywords: ['barber', 'salon', 'haircut', 'spa'], category: 'Shopping' },
];

/**
 * Main entry: categorize a single transaction description with LAYA.
 * Fully offline — no AI service or API key required.
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

  return layaMatch(request, categories, allowCreateNew);
}

/**
 * Categorize multiple descriptions.
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
 * Create a category by name on demand (used when LAYA suggests a
 * category that doesn't exist in the user's list).
 */
export async function createCategoryByName(
  userId: string,
  type: CategoryType,
  name: string,
): Promise<Category> {
  const cleanName = toTitleCase(name).slice(0, 30) || 'Miscellaneous';
  return createProposedCategory(userId, type, {
    name: cleanName,
    icon: guessIcon(cleanName),
    color: guessColor(cleanName),
    reasoning: `LAYA created "${cleanName}" on demand.`,
  });
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
// LAYA local matching — score keyword hits, never settle for "Other"
// ============================================================================

function layaMatch(
  request: CategorizeRequest,
  categories: Category[],
  allowCreateNew: boolean,
): CategorizationOutcome {
  const haystack = `${request.description} ${request.merchantHint ?? ''}`.toLowerCase();
  const otherCategory = categories.find((c) => c.name.toLowerCase() === 'other') ?? null;

  let best: { category: string; hits: number } | null = null;
  for (const entry of KEYWORD_CATEGORY_MAP) {
    const hits = entry.keywords.filter((k) => haystack.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { category: entry.category, hits };
    }
  }

  if (best) {
    const matched = matchCategoryName(best.category, categories);
    if (matched && matched.name.toLowerCase() !== 'other') {
      const confidence = Math.min(0.9, 0.6 + best.hits * 0.1);
      return {
        kind: 'match',
        choice: {
          categoryName: matched.name,
          categoryId: matched.id,
          confidence,
          reasoning: `LAYA matched "${request.description}" to ${matched.name}.`,
        },
        shouldCreateNew: false,
        newCategory: null,
        source: 'laya',
      };
    }
  }

  // No direct match -> generalize: roll specifics up to a broad concept
  // (desk OR chair -> Furniture), then prefer an already-created category
  // before proposing anything new.
  let generalized: { concept: string; icon: string; category?: string; hits: number } | null = null;
  for (const entry of GENERALIZATIONS) {
    const hits = entry.keywords.filter((k) => haystack.includes(k)).length;
    if (hits > 0 && (!generalized || hits > generalized.hits)) {
      generalized = { concept: entry.concept, icon: entry.icon, category: entry.category, hits };
    }
  }

  if (generalized) {
    // 1. Concept maps to a known default -> match it when present
    // 2. Concept name matches a user-created category -> match that
    const candidate = generalized.category ?? generalized.concept;
    const matched = matchCategoryName(candidate, categories);
    if (matched && matched.name.toLowerCase() !== 'other') {
      return {
        kind: 'match',
        choice: {
          categoryName: matched.name,
          categoryId: matched.id,
          confidence: 0.6,
          reasoning: `LAYA generalized "${request.description}" to ${matched.name}.`,
        },
        shouldCreateNew: false,
        newCategory: null,
        source: 'laya',
      };
    }
    // 3. Nothing suitable exists -> propose the GENERAL concept as new
    if (allowCreateNew) {
      return {
        kind: 'create_new',
        choice: {
          categoryName: otherCategory?.name ?? categories[0].name,
          categoryId: otherCategory?.id ?? null,
          confidence: 0.45,
          reasoning: `LAYA generalized "${request.description}" to ${generalized.concept}.`,
        },
        shouldCreateNew: true,
        newCategory: buildProposal(generalized.concept, request.description, generalized.icon),
        source: 'laya',
      };
    }
  }

  // No good match and no concept -> propose on-demand category from the
  // description instead of using Other
  if (allowCreateNew) {
    const name = deriveCategoryName(request.description);
    if (name.toLowerCase() !== 'other') {
      return {
        kind: 'create_new',
        choice: {
          categoryName: otherCategory?.name ?? categories[0].name,
          categoryId: otherCategory?.id ?? null,
          confidence: 0.35,
          reasoning: `LAYA found no good match for "${request.description}".`,
        },
        shouldCreateNew: true,
        newCategory: buildProposal(name, request.description),
        source: 'laya',
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
      reasoning: 'LAYA found no keyword match.',
    },
    shouldCreateNew: false,
    newCategory: null,
    source: 'laya',
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

function buildProposal(name: string, description: string, icon?: string, color?: string): NewCategoryProposal {
  const cleanName = toTitleCase(name).slice(0, 30) || 'Miscellaneous';
  return {
    name: cleanName,
    icon: icon || guessIcon(`${cleanName} ${description}`),
    color: color || guessColor(cleanName),
    reasoning: `LAYA proposes new category "${cleanName}" for "${description}".`,
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
