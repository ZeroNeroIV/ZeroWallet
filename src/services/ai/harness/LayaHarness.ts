/**
 * LayaHarness — Master Financial Agent Harness
 *
 * Implements a modern dual-system architecture:
 *  - System-1: <15ms deterministic reflex router for instant mobile queries & mutations
 *  - System-2: Multi-turn ReAct agent loop powered by Gemini 3.8 Flash (with Groq & local SLM fallbacks)
 *
 * Emits Generative UI visual widgets (interactive charts, transaction cards, health meters).
 */

import type { AIConversationContext, AISettings, FinancialWidget } from '../../../types/ai';
import type { PendingAction } from '../../../types/aiMutations';
import type { AgentResponse, AgentExecutionContext, ToolExecutionResult } from './types';
import { FinancialToolRegistry } from './tools/financialTools';
import { buildLayaSystemPrompt } from './prompts/layaSystemPrompt';
import { LayaSystem1Router } from '../layaSystem1';
import { GROQ_API_URL } from '../../../constants/aiProviders';

interface GeminiAPIMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    functionCall?: {
      name: string;
      args: Record<string, any>;
    };
    functionResponse?: {
      name: string;
      response: Record<string, any>;
    };
  }>;
}

export class LayaHarness {
  private settings: AISettings;
  private accountId: string;
  private userId: string;
  private currency: string;
  private balance: number;
  private toolRegistry: FinancialToolRegistry;

  constructor(
    settings: AISettings,
    accountId: string,
    userId: string,
    currency: string = 'USD',
    balance: number = 0
  ) {
    this.settings = settings;
    this.accountId = accountId;
    this.userId = userId;
    this.currency = currency;
    this.balance = balance;
    this.toolRegistry = new FinancialToolRegistry(accountId, userId);
  }

  /**
   * Main entrypoint for processing user financial intent
   */
  async processMessage(
    userPrompt: string,
    conversationContext?: AIConversationContext
  ): Promise<AgentResponse> {
    const cleanPrompt = userPrompt.trim();

    // ──────────────────────────────────────────────────────────
    // 1. SYSTEM-1: Instant Reflex Classifier (<15ms)
    // ──────────────────────────────────────────────────────────
    if (this.settings.system1Enabled !== false) {
      const system1Router = new LayaSystem1Router(this.accountId, this.userId, this.currency);
      const s1Result = await system1Router.route(cleanPrompt);

      if (s1Result.handled) {
        const widgets: FinancialWidget[] = [];
        const pendingActions: PendingAction[] = s1Result.pendingActions || [];

        // Synthesize transaction proposal widget if a pending transaction was formed
        if (pendingActions.length > 0) {
          const act = pendingActions[0];
          if (act.entityType === 'transaction' && act.resolvedData) {
            widgets.push({
              type: 'transaction_proposal',
              transaction: {
                type: act.resolvedData.type || 'expense',
                amount: act.resolvedData.amount || 0,
                currency: this.currency,
                categoryName: act.resolvedData.categoryName || 'General',
                vaultType: act.resolvedData.vaultType || 'main',
                date: act.resolvedData.date || new Date().toISOString().split('T')[0],
                description: act.resolvedData.description || '',
              },
              pendingActionId: act.id,
            });
          }
        }

        return {
          text: s1Result.text,
          widgets: widgets.length > 0 ? widgets : undefined,
          pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
          engineBadge: 'system1',
        };
      }
    }

    // ──────────────────────────────────────────────────────────
    // 2. SYSTEM-2: Agentic Multi-Turn Reasoning Loop
    // ──────────────────────────────────────────────────────────
    const provider = this.settings.provider || 'gemini';

    if (provider === 'gemini') {
      return await this.executeGeminiAgentLoop(cleanPrompt, conversationContext);
    } else {
      return await this.executeOpenAICompatibleAgentLoop(cleanPrompt, conversationContext);
    }
  }

  /**
   * Gemini 3.8 Agentic Loop with dynamic tool execution
   */
  private async executeGeminiAgentLoop(
    prompt: string,
    context?: AIConversationContext
  ): Promise<AgentResponse> {
    const apiKey = this.settings.geminiApiKey || this.settings.apiKey;
    if (!apiKey) {
      throw new Error('Google Gemini API key not configured. Please add your key in AI Settings.');
    }

    const model = this.settings.selectedModel || 'gemini-3.8-flash';
    const systemPrompt = buildLayaSystemPrompt({
      accountId: this.accountId,
      currency: this.currency,
      balance: this.balance,
    });

    const execContext: AgentExecutionContext = {
      accountId: this.accountId,
      userId: this.userId,
      currency: this.currency,
      balance: this.balance,
    };

    const messages: GeminiAPIMessage[] = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. LAYA agent initialized and ready to inspect and optimize your financial ledger.' }] },
    ];

    // Inject conversation context
    if (context?.recentMessages && Array.isArray(context.recentMessages)) {
      context.recentMessages.slice(-6).forEach((msg) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      });
    }

    messages.push({ role: 'user', parts: [{ text: prompt }] });

    const accumulatedWidgets: FinancialWidget[] = [];
    const accumulatedActions: PendingAction[] = [];
    const toolDefs = this.toolRegistry.getToolDefinitions();

    // ReAct Loop (up to 4 steps)
    let turns = 0;
    const maxTurns = 4;
    let finalAnswer = '';

    while (turns < maxTurns) {
      turns++;

      const response = await this.callGeminiRaw(apiKey, model, messages, toolDefs);

      // If model wants to call tools
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponseParts: any[] = [];

        for (const call of response.functionCalls) {
          const tool = this.toolRegistry.getExecutableTool(call.name);
          let toolResult: ToolExecutionResult;

          if (tool) {
            toolResult = await tool.execute(call.args, execContext);
          } else {
            toolResult = { success: false, error: `Unknown tool: ${call.name}` };
          }

          if (toolResult.widget) {
            accumulatedWidgets.push(toolResult.widget);
          }
          if (toolResult.pendingAction) {
            accumulatedActions.push(toolResult.pendingAction);
          }

          functionResponseParts.push({
            name: call.name,
            content: toolResult.data || { success: toolResult.success, error: toolResult.error },
          });
        }

        // Push model function call turn
        messages.push({
          role: 'model',
          parts: response.functionCalls.map((fc) => ({
            text: `[Called ${fc.name}]`,
          })),
        });

        // Push tool responses turn
        messages.push({
          role: 'user',
          parts: [
            {
              text: `Tool execution observation:\n${JSON.stringify(functionResponseParts, null, 2)}\n\nNow synthesize a clear, helpful response explaining what you found or proposed. If an interactive chart or ticket was generated, briefly highlight the insights for the user.`,
            },
          ],
        });
      } else {
        // Model provided final text
        finalAnswer = response.text || 'I have analyzed your ledger.';
        break;
      }
    }

    if (!finalAnswer && accumulatedActions.length > 0) {
      finalAnswer = `I have drafted ${accumulatedActions[0].summary}. Please review the interactive ticket below.`;
    } else if (!finalAnswer && accumulatedWidgets.length > 0) {
      finalAnswer = `Here is your requested financial visualization.`;
    }

    return {
      text: finalAnswer || 'Ledger analysis complete.',
      widgets: accumulatedWidgets.length > 0 ? accumulatedWidgets : undefined,
      pendingActions: accumulatedActions.length > 0 ? accumulatedActions : undefined,
      engineBadge: 'system2',
    };
  }

  /**
   * Raw call to Google Gemini endpoint
   */
  private async callGeminiRaw(
    apiKey: string,
    model: string,
    messages: GeminiAPIMessage[],
    tools: any[]
  ): Promise<{ text?: string; functionCalls?: Array<{ name: string; args: any }> }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: any = {
      contents: messages,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = [
        {
          function_declarations: tools,
        },
      ];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Gemini API call failed with status ${res.status}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return { text: 'No response generated from Gemini.' };
    }

    const parts = candidate.content?.parts || [];
    const functionCalls: Array<{ name: string; args: any }> = [];
    let text = '';

    for (const part of parts) {
      if (part.functionCall) {
        functionCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
      if (part.text) {
        text += part.text;
      }
    }

    return {
      text: text.trim(),
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
    };
  }

  /**
   * Fallback for OpenAI-compatible providers (Groq / Ollama)
   */
  private async executeOpenAICompatibleAgentLoop(
    prompt: string,
    _context?: AIConversationContext
  ): Promise<AgentResponse> {
    const isGroq = this.settings.provider === 'groq';
    const apiKey = isGroq ? (this.settings.groqApiKey || this.settings.apiKey) : (this.settings.customApiKey || '');
    const endpoint = isGroq ? GROQ_API_URL : `${(this.settings.customBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '')}/chat/completions`;

    const systemPrompt = buildLayaSystemPrompt({
      accountId: this.accountId,
      currency: this.currency,
      balance: this.balance,
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.settings.selectedModel || (isGroq ? 'llama-3.2-3b-preview' : 'llama3.2:3b'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      throw new Error(`Inference provider failed with status ${res.status}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || 'Unable to generate response.';

    return {
      text: content,
      engineBadge: 'system2',
    };
  }
}
