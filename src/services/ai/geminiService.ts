/**
 * Purpose: Handle Google Gemini API requests with function calling support
 *
 * Inputs:
 *   - apiKey (string): Google AI Studio API key
 *   - accountId (string): Current account ID
 *   - modelId (GeminiModel): Model to use
 *
 * Outputs:
 *   - Returns (GeminiService): Service instance for AI requests
 *
 * Side effects:
 *   - Makes HTTP requests to Google Gemini API
 *   - Executes database queries via DataQueryService
 *   - Logs API calls for debugging
 */

import type { AIConversationContext, GeminiModel } from '../../types/ai';
import { DataQueryService } from './dataQueryService';
import { DataMutationService } from './dataMutationService';
import { buildSystemPrompt } from './systemPrompt';
import { FUNCTION_DEFINITIONS, WRITE_FUNCTION_NAMES_SET } from './functionRegistry';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export class GeminiService {
  private apiKey: string;
  private accountId: string;
  private userId: string;
  private modelId: GeminiModel;
  private dataQuery: DataQueryService;
  private dataMutation: DataMutationService;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private writeHandlers: Map<string, (params: Record<string, any>) => Promise<any>>;

  constructor(apiKey: string, accountId: string, userId: string, modelId: GeminiModel) {
    this.apiKey = apiKey;
    this.accountId = accountId;
    this.userId = userId;
    this.modelId = modelId;
    this.dataQuery = new DataQueryService(accountId);
    this.dataMutation = new DataMutationService(accountId, userId);
    this.writeHandlers = new Map([
      ['createTransaction', this.dataMutation.createTransactionAction.bind(this.dataMutation)],
      ['updateTransaction', this.dataMutation.updateTransactionAction.bind(this.dataMutation)],
      ['deleteTransaction', this.dataMutation.deleteTransactionAction.bind(this.dataMutation)],
      ['createGoal', this.dataMutation.createGoalAction.bind(this.dataMutation)],
      ['updateGoal', this.dataMutation.updateGoalAction.bind(this.dataMutation)],
      ['updateGoalProgress', this.dataMutation.updateGoalProgressAction.bind(this.dataMutation)],
      ['completeGoal', this.dataMutation.completeGoalAction.bind(this.dataMutation)],
      ['deleteGoal', this.dataMutation.deleteGoalAction.bind(this.dataMutation)],
      ['createDebt', this.dataMutation.createDebtAction.bind(this.dataMutation)],
      ['updateDebt', this.dataMutation.updateDebtAction.bind(this.dataMutation)],
      ['recordDebtPayment', this.dataMutation.recordDebtPaymentAction.bind(this.dataMutation)],
      ['markDebtAsPaid', this.dataMutation.markDebtAsPaidAction.bind(this.dataMutation)],
      ['deleteDebt', this.dataMutation.deleteDebtAction.bind(this.dataMutation)],
      ['createSubscription', this.dataMutation.createSubscriptionAction.bind(this.dataMutation)],
      ['updateSubscription', this.dataMutation.updateSubscriptionAction.bind(this.dataMutation)],
      ['toggleSubscription', this.dataMutation.toggleSubscriptionAction.bind(this.dataMutation)],
      ['deleteSubscription', this.dataMutation.deleteSubscriptionAction.bind(this.dataMutation)],
      ['createRecurringExpense', this.dataMutation.createRecurringExpenseAction.bind(this.dataMutation)],
      ['updateRecurringExpense', this.dataMutation.updateRecurringExpenseAction.bind(this.dataMutation)],
      ['deleteRecurringExpense', this.dataMutation.deleteRecurringExpenseAction.bind(this.dataMutation)],
      ['createCategory', this.dataMutation.createCategoryAction.bind(this.dataMutation)],
      ['updateCategory', this.dataMutation.updateCategoryAction.bind(this.dataMutation)],
      ['deleteCategory', this.dataMutation.deleteCategoryAction.bind(this.dataMutation)],
    ]);
  }

  /**
   * Send a message to Gemini and get a response
   */
  async sendMessage(
    message: string,
    context: AIConversationContext
  ): Promise<{ text: string; pendingActions?: any[] }> {
    console.log('[GeminiService] Sending message:', message);

    try {
      // Build system prompt
      const systemPrompt = buildSystemPrompt({
        accountId: context.accountId,
        currency: context.accountCurrency,
        balance: context.accountBalance,
      });

      // Build message array
      const messages = this.buildMessageArray(systemPrompt, context, message);

      // Make API request
      const response = await this.callGeminiAPI(messages, true); // Enable function calling

      // Check if AI wants to call a function
      if (response.functionCalls && response.functionCalls.length > 0) {
        console.log('[GeminiService] AI requested function calls');
        return await this.handleFunctionCalls(
          response.functionCalls,
          messages,
          systemPrompt
        );
      }

      // Return direct response
      return {
        text: response.text || 'I apologize, but I was unable to generate a response.',
      };
    } catch (error: any) {
      console.error('[GeminiService] Error sending message:', error);
      throw new Error(
        error.message || 'Failed to communicate with AI. Please check your API key and try again.'
      );
    }
  }

  /**
   * Handle function calls (2-step process)
   */
  private async handleFunctionCalls(
    functionCalls: FunctionCall[],
    previousMessages: GeminiMessage[],
    systemPrompt: string
  ): Promise<{ text: string; pendingActions?: any[] }> {
    console.log('[GeminiService] Handling', functionCalls.length, 'function calls');

    // Execute all function calls
    const functionResults = [];
    const pendingActions = [];

    for (const call of functionCalls) {
      // Check if this is a write function
      if (WRITE_FUNCTION_NAMES_SET.has(call.name)) {
        // For write functions, create pending action instead of executing
        console.log('[GeminiService] Write function detected:', call.name);
        const result = await this.handleWriteFunction(call.name, call.args);

        // Collect pending action if created successfully
        if (result.pendingAction) {
          pendingActions.push(result.pendingAction);
        }

        // Send simplified response to AI (just the summary, not full action structure)
        const simplifiedResult = result.error
          ? { success: false, error: result.error }
          : { success: true, summary: result.pendingAction?.summary };

        functionResults.push({
          name: call.name,
          content: JSON.stringify(simplifiedResult),
        });
      } else {
        // For read functions, execute normally
        const result = await this.dataQuery.executeFunction(
          call.name,
          call.args
        );
        functionResults.push({
          name: call.name,
          content: JSON.stringify(result.data),
        });
      }
    }

    // Build new message array with function results
    const messagesWithResults = [
      ...previousMessages,
      {
        role: 'model' as const,
        parts: [
          {
            text: `[Function calls executed: ${functionCalls.map((c) => c.name).join(', ')}]`,
          },
        ],
      },
      {
        role: 'user' as const,
        parts: [
          {
            text: `Here are the results of the function calls:\n${JSON.stringify(functionResults, null, 2)}\n\nIMPORTANT: You MUST provide a natural, conversational response to the user. If a pending action was created, explain what you want to do and ask the user to confirm it. Always respond with helpful text - never leave your response empty.`,
          },
        ],
      },
    ];

    // Get final response from AI
    const finalResponse = await this.callGeminiAPI(messagesWithResults, false);

    // Log if response is empty for debugging
    if (!finalResponse.text) {
      console.warn('[GeminiService] AI returned empty response after function calls');
      console.warn('[GeminiService] Function results:', JSON.stringify(functionResults, null, 2));
    }

    // Provide helpful fallback based on what happened
    let fallbackText = 'I processed your request, but had trouble forming a response.';
    if (pendingActions.length > 0) {
      const action = pendingActions[0];
      fallbackText = `I want to ${action.summary}. Please review and confirm this action above.`;
    }

    return {
      text: finalResponse.text || fallbackText,
      pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
    };
  }

  /**
   * Handle write function calls by creating pending actions
   */
  private async handleWriteFunction(
    functionName: string,
    params: Record<string, any>
  ): Promise<{ pendingAction: any; error?: string }> {
    try {
      const handler = this.writeHandlers.get(functionName);
      if (!handler) {
        throw new Error(`Unknown write function: ${functionName}`);
      }
      const pendingAction = await handler(params);
      return { pendingAction };
    } catch (error: any) {
      console.error(`[GeminiService] Error in write function ${functionName}:`, error);
      return {
        pendingAction: null,
        error: error.userMessage || error.message || 'Failed to create action',
      };
    }
  }

  /**
   * Call Gemini API
   */
  private async callGeminiAPI(
    messages: GeminiMessage[],
    enableFunctions: boolean
  ): Promise<{ text?: string; functionCalls?: FunctionCall[] }> {
    const url = `${this.baseUrl}/${this.modelId}:generateContent?key=${this.apiKey}`;

    // Determine max tokens based on model
    const maxOutputTokens = this.modelId === 'gemini-1.5-pro' ? 2048 : 1024;

    const body: any = {
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens,
      },
    };

    // Add function definitions if enabled
    if (enableFunctions) {
      body.tools = [
        {
          function_declarations: this.getFunctionDefinitions(),
        },
      ];
    }

    console.log('[GeminiService] Making API request to:', this.modelId);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || `API request failed: ${response.status}`
      );
    }

    const data = await response.json();

    // Parse response
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from AI');
    }

    const part = candidate.content?.parts?.[0];

    // Check for function call
    if (part?.functionCall) {
      return {
        functionCalls: [
          {
            name: part.functionCall.name,
            args: part.functionCall.args || {},
          },
        ],
      };
    }

    // Regular text response
    return {
      text: part?.text || '',
    };
  }

  /**
   * Build message array for API request
   */
  private buildMessageArray(
    systemPrompt: string,
    context: AIConversationContext,
    newMessage: string
  ): GeminiMessage[] {
    const messages: GeminiMessage[] = [];

    // Add system prompt as first user message
    messages.push({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });

    // Add acknowledgment from model
    messages.push({
      role: 'model',
      parts: [{ text: 'Understood. I will help you with your finances.' }],
    });

    // Add conversation summary if exists
    if (context?.conversationSummary) {
      messages.push({
        role: 'user',
        parts: [{ text: `Previous conversation summary:\n${context.conversationSummary}` }],
      });
    }

    // Add recent messages from context
    if (context?.recentMessages && Array.isArray(context.recentMessages)) {
      context.recentMessages.forEach((msg) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      });
    }

    // Add new message
    messages.push({
      role: 'user',
      parts: [{ text: newMessage }],
    });

    return messages;
  }

  private getFunctionDefinitions() {
    return FUNCTION_DEFINITIONS;
  }

  /**
   * Validate API key
   */
  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
