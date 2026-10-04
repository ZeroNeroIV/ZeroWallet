/**
 * Purpose: Type definitions for AI chat integration with Google Gemini, Groq SLMs,
 * and Laya System-1 fast decision router.
 *
 * Outputs:
 *   - Exports all TypeScript types and interfaces for AI features
 */

/**
 * Supported AI Providers
 */
export type AIProvider = 'gemini' | 'groq' | 'custom_openai';

/**
 * Available Gemini model identifiers (including latest Gemini 3.8 and 3.5 series)
 */
export type GeminiModel =
  | 'gemini-3.8-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-pro-preview'
  | 'gemini-2.5-flash'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro';

/**
 * Interactive financial generative UI widgets
 */
export type FinancialWidget =
  | {
      type: 'chart';
      chartType: 'donut' | 'pie' | 'bar' | 'line';
      title: string;
      data: Array<{
        label: string;
        value: number;
        color?: string;
        secondaryValue?: number;
      }>;
      summary?: string;
      total?: number;
      currency?: string;
    }
  | {
      type: 'transaction_proposal';
      transaction: {
        type: 'income' | 'expense';
        amount: number;
        currency: string;
        categoryName: string;
        vaultType: string;
        date: string;
        description: string;
      };
      pendingActionId?: string;
    }
  | {
      type: 'health_score';
      score: number; // 0 - 100
      grade: 'EXCELLENT' | 'STABLE' | 'NEEDS_ATTENTION' | 'CRITICAL';
      runwayMonths: number;
      savingsRate: number;
      burnRate: number;
      recommendations: string[];
    }
  | {
      type: 'budget_gauge';
      categoryName: string;
      spent: number;
      limit: number;
      remaining: number;
      percentage: number;
      currency?: string;
    };

/**
 * Available Groq SLM/LLM model identifiers
 */
export type GroqModel =
  | 'llama-3.2-1b-preview'
  | 'llama-3.2-3b-preview'
  | 'llama-3.1-8b-instant'
  | 'llama-3.3-70b-versatile';

/**
 * Detailed information about an AI model
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider?: AIProvider;
  description: string;
  speed: number; // 1-3 (1 = slowest, 3 = fastest)
  accuracy: number; // 1-4 (1 = basic, 4 = best)
  tokensPerMinute?: number;
  maxOutputTokens?: number;
  bestFor: string;
  recommended: boolean;
}

/**
 * User AI settings stored in settings store
 */
export interface AISettings {
  provider: AIProvider; // Currently selected provider
  apiKey: string | null; // Active or Gemini API key
  geminiApiKey?: string | null;
  groqApiKey?: string | null;
  customApiKey?: string | null;
  customBaseUrl?: string; // Custom endpoint (e.g., http://localhost:11434/v1)
  selectedModel: string; // Model identifier
  system1Enabled: boolean; // Whether Laya System-1 fast decision router is active
  isConfigured: boolean; // Whether active provider is configured
  totalTokensUsed: number; // Total tokens consumed (for stats)
  conversationCount: number; // Number of conversations started
  lastUsed: number | null; // Timestamp of last usage
}

/**
 * Message role in conversation
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Single message in AI conversation
 */
export interface AIMessage {
  id: string; // Unique message ID
  role: MessageRole; // Who sent the message
  content: string; // Message text
  timestamp: number; // Unix timestamp
  isError?: boolean; // Whether this is an error message
  functionCalls?: string[]; // Names of functions called (for debugging)
  pendingActionId?: string; // ID of pending action associated with this message
  engineBadge?: string; // Which engine/model generated this response (e.g., 'GEMINI 3.8 FLASH', 'LAYA (<20MS)')
  widgets?: FinancialWidget[]; // Interactive generative UI widgets (charts, proposals, gauges)
}

/**
 * Context provided to AI for conversation continuity
 */
export interface AIConversationContext {
  accountId: string; // Current user's account ID
  accountCurrency: string; // Account currency code
  accountBalance: number; // Current total balance
  conversationSummary?: string; // Summary of older messages (for context)
  recentMessages: AIMessage[]; // Last N messages in full detail
  timestamp: number; // When context was created
}

/**
 * Response from a data query function
 */
export interface DataQueryResult {
  functionName: string; // Name of the function called
  data: any; // Result data (varies by function)
  error?: string; // Error message if query failed
}

/**
 * AI service configuration
 */
export interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  accountId: string;
  userId: string;
  modelId: string;
  customBaseUrl?: string;
}
