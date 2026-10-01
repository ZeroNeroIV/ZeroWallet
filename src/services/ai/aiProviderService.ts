/**
 * Purpose: Unified Multi-Provider AI Service
 *
 * Supports:
 *   1. Groq Cloud (Ultra-fast mobile inference with Llama 3.2 SLMs: 1B, 3B, 8B, 70B)
 *   2. Google Gemini (Gemini 2.5 Flash, 1.5 Flash, 1.5 Pro)
 *   3. Custom / Local OpenAI-compatible (Ollama with SmolLM2, LM Studio, vLLM)
 *
 * Dispatches functions, builds financial context, and handles tool calling.
 */

import type { AIConversationContext, AISettings } from '../../types/ai';
import { GeminiService } from './geminiService';
import { DataQueryService } from './dataQueryService';
import { DataMutationService } from './dataMutationService';
import { buildSystemPrompt } from './systemPrompt';
import { FUNCTION_DEFINITIONS, WRITE_FUNCTION_NAMES_SET } from './functionRegistry';
import { GROQ_API_URL } from '../../constants/aiProviders';

export interface AIProviderResponse {
  text: string;
  pendingActions?: any[];
  engineBadge?: 'system1' | 'system2';
}

export class AIProviderService {
  private settings: AISettings;
  private accountId: string;
  private userId: string;
  private dataQuery: DataQueryService;
  private dataMutation: DataMutationService;
  private writeHandlers: Map<string, (params: any) => Promise<any>>;

  constructor(settings: AISettings, accountId: string, userId: string) {
    this.settings = settings;
    this.accountId = accountId;
    this.userId = userId;
    this.dataQuery = new DataQueryService(accountId);
    this.dataMutation = new DataMutationService(accountId, userId);

    this.writeHandlers = new Map<string, (params: any) => Promise<any>>([
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
   * Main dispatch method
   */
  async sendMessage(message: string, context: AIConversationContext): Promise<AIProviderResponse> {
    const provider = this.settings.provider || 'gemini';

    if (provider === 'gemini') {
      const apiKey = this.settings.geminiApiKey || this.settings.apiKey;
      if (!apiKey) {
        throw new Error('Google Gemini API key not configured. Please set your API key in AI settings.');
      }
      const geminiService = new GeminiService(
        apiKey,
        this.accountId,
        this.userId,
        (this.settings.selectedModel as any) || 'gemini-2.5-flash'
      );
      const res = await geminiService.sendMessage(message, context);
      return {
        text: res.text,
        pendingActions: res.pendingActions,
        engineBadge: 'system2',
      };
    }

    if (provider === 'groq') {
      const apiKey = this.settings.groqApiKey || this.settings.apiKey;
      if (!apiKey) {
        throw new Error('Groq Cloud API key not configured. Please enter your free Groq key in AI settings.');
      }
      return await this.callOpenAICompatibleAPI({
        endpoint: GROQ_API_URL,
        apiKey,
        model: this.settings.selectedModel || 'llama-3.2-3b-preview',
        message,
        context,
      });
    }

    if (provider === 'custom_openai') {
      let endpoint = (this.settings.customBaseUrl || 'http://localhost:11434/v1').trim();
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }
      return await this.callOpenAICompatibleAPI({
        endpoint,
        apiKey: this.settings.customApiKey || this.settings.apiKey || 'ollama',
        model: this.settings.selectedModel || 'smollm2:1.7b',
        message,
        context,
      });
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  /**
   * Universal OpenAI-compatible chat completions caller with tool support
   */
  private async callOpenAICompatibleAPI(params: {
    endpoint: string;
    apiKey: string;
    model: string;
    message: string;
    context: AIConversationContext;
  }): Promise<AIProviderResponse> {
    const systemPrompt = buildSystemPrompt({
      accountId: params.context.accountId,
      currency: params.context.accountCurrency,
      balance: params.context.accountBalance,
    });

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Include recent messages
    for (const msg of params.context.recentMessages) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // Add current user prompt
    messages.push({ role: 'user', content: params.message });

    // Format tools
    const tools = FUNCTION_DEFINITIONS.map((f) => ({
      type: 'function',
      function: {
        name: f.name,
        description: f.description,
        parameters: f.parameters,
      },
    }));

    const body: Record<string, any> = {
      model: params.model,
      messages,
      tools,
      temperature: 0.3,
      max_tokens: 1024,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (params.apiKey && params.apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${params.apiKey.trim()}`;
    }

    const response = await fetch(params.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `HTTP ${response.status}: ${errText}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) errorMsg = parsed.error.message;
      } catch {}
      throw new Error(`AI Provider Error: ${errorMsg}`);
    }

    const json = await response.json();
    const choice = json.choices?.[0];
    if (!choice) {
      return { text: 'I received an empty response from the AI provider.', engineBadge: 'system2' };
    }

    const toolCalls = choice.message?.tool_calls;
    if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
      return await this.handleToolCalls(toolCalls, messages, params);
    }

    return {
      text: choice.message?.content || 'I completed your request.',
      engineBadge: 'system2',
    };
  }

  /**
   * Handle tool calls from OpenAI/Groq
   */
  private async handleToolCalls(
    toolCalls: any[],
    previousMessages: any[],
    params: { endpoint: string; apiKey: string; model: string; context: AIConversationContext }
  ): Promise<AIProviderResponse> {
    const pendingActions: any[] = [];
    const toolOutputs: any[] = [];

    for (const call of toolCalls) {
      const fnName = call.function?.name;
      let fnArgs: Record<string, any> = {};
      try {
        fnArgs = JSON.parse(call.function?.arguments || '{}');
      } catch {
        fnArgs = {};
      }

      if (WRITE_FUNCTION_NAMES_SET.has(fnName)) {
        const handler = this.writeHandlers.get(fnName);
        if (handler) {
          try {
            const pendingAction = await handler(fnArgs);
            pendingActions.push(pendingAction);
            toolOutputs.push({
              tool_call_id: call.id,
              role: 'tool',
              name: fnName,
              content: JSON.stringify({
                status: 'pending_confirmation',
                message: 'Action created and requires user confirmation',
                actionId: pendingAction.id,
              }),
            });
          } catch (err: any) {
            toolOutputs.push({
              tool_call_id: call.id,
              role: 'tool',
              name: fnName,
              content: JSON.stringify({ error: err.message }),
            });
          }
        }
      } else {
        // Read function
        try {
          const result = await this.dataQuery.executeFunction(fnName, fnArgs);
          toolOutputs.push({
            tool_call_id: call.id,
            role: 'tool',
            name: fnName,
            content: JSON.stringify(result.data),
          });
        } catch (err: any) {
          toolOutputs.push({
            tool_call_id: call.id,
            role: 'tool',
            name: fnName,
            content: JSON.stringify({ error: err.message }),
          });
        }
      }
    }

    // Secondary call to synthesize final message
    const followUpMessages = [
      ...previousMessages,
      {
        role: 'assistant',
        tool_calls: toolCalls,
      },
      ...toolOutputs,
    ];

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey.trim()}`;

      const res = await fetch(params.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: params.model,
          messages: followUpMessages,
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const finalText = json.choices?.[0]?.message?.content || 'I processed your request.';
        return {
          text: finalText,
          pendingActions,
          engineBadge: 'system2',
        };
      }
    } catch (err) {
      console.warn('[AIProviderService] Tool synthesis fallback:', err);
    }

    return {
      text:
        pendingActions.length > 0
          ? `I prepared ${pendingActions.length} action(s) for your confirmation. Please review and confirm below:`
          : 'I completed the requested operation.',
      pendingActions,
      engineBadge: 'system2',
    };
  }
}
