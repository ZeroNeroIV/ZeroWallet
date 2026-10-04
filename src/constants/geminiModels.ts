/**
 * Purpose: Define available Gemini AI models with their specifications and capabilities
 *
 * Outputs:
 *   - GEMINI_MODELS: Array of all available models with details
 *   - TOKENS_EXPLANATION: User-friendly explanation of what tokens are
 *
 * Side effects: None
 */

import { ModelInfo } from '../types/ai';

/**
 * Available Gemini models with detailed specifications
 *
 * Speed: ⚡⚡⚡ (3) = Fastest, ⚡⚡ (2) = Fast, ⚡ (1) = Balanced
 * Accuracy: ⭐⭐⭐⭐ (4) = Best, ⭐⭐⭐ (3) = Great, ⭐⭐ (2) = Good
 */
export const GEMINI_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Flagship agentic model with fast reasoning, 1M context, and native tool execution',
    speed: 3,
    accuracy: 4,
    tokensPerMinute: 4000000,
    maxOutputTokens: 8192,
    bestFor: 'Autonomous financial analysis, tool calling, and chart generation',
    recommended: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Ultra-fast low-latency execution for mobile instant ledger updates',
    speed: 3,
    accuracy: 3,
    tokensPerMinute: 4000000,
    maxOutputTokens: 8192,
    bestFor: 'Rapid mobile responses and high-frequency queries',
    recommended: false,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    description: 'Deep mathematical reasoning and multi-month portfolio planning',
    speed: 1,
    accuracy: 4,
    tokensPerMinute: 2000000,
    maxOutputTokens: 8192,
    bestFor: 'Complex financial audits, runway modeling, and debt strategies',
    recommended: false,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Balanced speed and accuracy fallback',
    speed: 2,
    accuracy: 3,
    tokensPerMinute: 4000000,
    maxOutputTokens: 8192,
    bestFor: 'General financial queries and transaction summaries',
    recommended: false,
  },
];

/**
 * Friendly explanation of what tokens are for users
 */
export const TOKENS_EXPLANATION = `Think of tokens like "word pieces" that the AI reads and writes.

For example, "spending" might be 1 token, while "budget analysis" could be 2-3 tokens.

**What you need to know:**
• The AI can read ~4 million tokens per minute (that's A LOT! 📚)
• A typical conversation uses 500-2000 tokens total
• Google gives you this for FREE - no limits for personal use
• You won't run out! The limits are very generous

**Bottom line:** Don't worry about tokens! Just chat naturally. The free tier is more than enough for daily use. 😊`;

/**
 * Get model info by ID
 */
export const getModelById = (modelId: string): ModelInfo | undefined => {
  return GEMINI_MODELS.find((model) => model.id === modelId);
};

/**
 * Get the recommended model
 */
export const getRecommendedModel = (): ModelInfo => {
  return GEMINI_MODELS.find((model) => model.recommended) || GEMINI_MODELS[1];
};
