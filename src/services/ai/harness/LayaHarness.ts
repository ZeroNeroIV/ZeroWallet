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

interface GeminiAPIPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  thought_signature?: string;
  functionCall?: {
    id?: string;
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, any>;
  };
  [key: string]: any;
}

interface GeminiAPIMessage {
  role: 'user' | 'model';
  parts: GeminiAPIPart[];
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
    conversationContext?: AIConversationContext,
    options?: { forceSystem2?: boolean }
  ): Promise<AgentResponse> {
    const cleanPrompt = userPrompt.trim();

    // ──────────────────────────────────────────────────────────
    // 1. SYSTEM-1: Fast Intent Classifier (<15ms)
    // Only used for instant reflex transaction logging (e.g., "spent 15 on lunch")
    // Conversational, analytical, and voice queries pass directly to System-2 LLM
    // ──────────────────────────────────────────────────────────
    if (!options?.forceSystem2 && this.settings.system1Enabled !== false) {
      const system1Router = new LayaSystem1Router(this.accountId, this.userId, this.currency);
      const s1Result = await system1Router.route(cleanPrompt);

      if (s1Result.handled && s1Result.intent === 'CREATE_TRANSACTION') {
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
   * Ensure selected model is a valid Gemini chat model identifier
   */
  private resolveGeminiModel(selectedModel?: string): string {
    const trimmed = (selectedModel || '').trim();
    if (
      trimmed.startsWith('gemini-') &&
      !trimmed.includes('-tts') &&
      !trimmed.includes('embedding') &&
      !trimmed.includes('imagen')
    ) {
      return trimmed;
    }
    return 'gemini-2.5-flash';
  }

  /**
   * Build strictly alternating user/model contents array starting with user role
   */
  public buildGeminiContents(
    prompt: string,
    context?: AIConversationContext
  ): GeminiAPIMessage[] {
    const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [];

    if (context?.recentMessages && Array.isArray(context.recentMessages)) {
      const validRecent = context.recentMessages
        .filter(
          (msg) =>
            !msg.isError &&
            typeof msg.content === 'string' &&
            msg.content.trim().length > 0
        )
        .slice(-6);

      // Avoid duplicating current user prompt if already present at tail of recentMessages
      if (
        validRecent.length > 0 &&
        validRecent[validRecent.length - 1].role === 'user' &&
        validRecent[validRecent.length - 1].content.trim() === prompt.trim()
      ) {
        validRecent.pop();
      }

      for (const msg of validRecent) {
        rawTurns.push({
          role: msg.role === 'user' ? 'user' : 'model',
          text: msg.content.trim(),
        });
      }
    }

    rawTurns.push({ role: 'user', text: prompt.trim() });

    // Drop any leading 'model' turns so conversation strictly begins with 'user'
    while (rawTurns.length > 0 && rawTurns[0].role === 'model') {
      rawTurns.shift();
    }

    // Ensure strict role alternation (user -> model -> user)
    const normalized: GeminiAPIMessage[] = [];
    for (const turn of rawTurns) {
      const prev = normalized[normalized.length - 1];
      if (!prev) {
        normalized.push({ role: turn.role, parts: [{ text: turn.text }] });
      } else if (prev.role === turn.role) {
        if (turn.role === 'user') {
          // Previous user turn had no valid model response (e.g. prior failed attempt); replace with latest user prompt
          prev.parts = [{ text: turn.text }];
        } else {
          prev.parts = [{ text: `${prev.parts[0]?.text || ''}\n\n${turn.text}`.trim() }];
        }
      } else {
        normalized.push({ role: turn.role, parts: [{ text: turn.text }] });
      }
    }

    return normalized;
  }

  /**
   * Gemini Agentic Loop with dynamic tool execution
   */
  private async executeGeminiAgentLoop(
    prompt: string,
    context?: AIConversationContext
  ): Promise<AgentResponse> {
    const apiKey = (this.settings.geminiApiKey || this.settings.apiKey || '').trim();
    if (!apiKey) {
      throw new Error('Google Gemini API key not configured. Please add your key in AI Settings.');
    }

    const model = this.resolveGeminiModel(this.settings.selectedModel);
    const systemPrompt = buildLayaSystemPrompt({
      accountId: this.accountId,
      currency: this.currency,
      balance: this.balance,
      modelName: model,
    });

    const execContext: AgentExecutionContext = {
      accountId: this.accountId,
      userId: this.userId,
      currency: this.currency,
      balance: this.balance,
    };

    const baseMessages = this.buildGeminiContents(prompt, context);
    const messages: GeminiAPIMessage[] = [...baseMessages];

    const accumulatedWidgets: FinancialWidget[] = [];
    const accumulatedActions: PendingAction[] = [];
    const toolDefs = this.toolRegistry.getToolDefinitions();

    // ReAct Loop (up to 4 steps)
    let turns = 0;
    const maxTurns = 4;
    let finalAnswer = '';
    let lastObservationSummary: any[] = [];

    while (turns < maxTurns) {
      turns++;

      let response: {
        text?: string;
        functionCalls?: Array<{ id?: string; name: string; args: any }>;
        rawModelContent?: GeminiAPIMessage;
      };

      try {
        response = await this.callGeminiRaw(apiKey, model, systemPrompt, messages, toolDefs);
      } catch (err) {
        // If a post-tool synthesis turn failed due to structured functionResponse/signature constraints,
        // fallback to a clean text-only synthesis request without tools
        if (turns > 1 && lastObservationSummary.length > 0) {
          const fallbackMessages: GeminiAPIMessage[] = [
            ...baseMessages,
            {
              role: 'model',
              parts: [{ text: 'I will inspect your financial records now.' }],
            },
            {
              role: 'user',
              parts: [
                {
                  text: `Tool execution observation:\n${JSON.stringify(lastObservationSummary, null, 2)}\n\nSynthesize a clear, helpful response explaining what you found or proposed.`,
                },
              ],
            },
          ];
          const synthRes = await this.callGeminiRaw(apiKey, model, systemPrompt, fallbackMessages, []).catch(
            () => ({ text: '' })
          );
          if (synthRes.text) {
            finalAnswer = synthRes.text;
          }
          break;
        }
        throw err;
      }

      // If model wants to call tools
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponseParts: GeminiAPIPart[] = [];
        lastObservationSummary = [];

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

          const resultPayload = toolResult.data || {
            success: toolResult.success,
            error: toolResult.error,
          };

          lastObservationSummary.push({
            name: call.name,
            result: resultPayload,
          });

          functionResponseParts.push({
            functionResponse: {
              ...(call.id ? { id: call.id } : {}),
              name: call.name,
              response: {
                result: resultPayload,
              },
            },
          });
        }

        // Preserve exact model response parts (including thoughtSignature and functionCall)
        if (response.rawModelContent && Array.isArray(response.rawModelContent.parts)) {
          messages.push({
            role: 'model',
            parts: response.rawModelContent.parts,
          });
        } else {
          messages.push({
            role: 'model',
            parts: response.functionCalls.map((fc) => ({
              functionCall: {
                ...(fc.id ? { id: fc.id } : {}),
                name: fc.name,
                args: fc.args || {},
              },
            })),
          });
        }

        // Push structured functionResponse parts as user turn
        messages.push({
          role: 'user',
          parts: functionResponseParts,
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
   * Raw call to Google Gemini endpoint with automatic model & tool fallback
   */
  private async callGeminiRaw(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: GeminiAPIMessage[],
    tools: any[]
  ): Promise<{
    text?: string;
    functionCalls?: Array<{ id?: string; name: string; args: any }>;
    rawModelContent?: GeminiAPIMessage;
  }> {
    const candidateModels = Array.from(
      new Set([
        this.resolveGeminiModel(model),
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ])
    );

    let lastError: Error | null = null;

    for (const candidateModel of candidateModels) {
      try {
        return await this.sendSingleGeminiRequest(
          apiKey,
          candidateModel,
          systemPrompt,
          messages,
          tools
        );
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const status = (err as any)?.status;
        const msg = lastError.message.toLowerCase();

        // Do not retry on invalid API key errors
        if (status === 401 || status === 403 || msg.includes('api key not valid') || msg.includes('api_key_invalid')) {
          throw lastError;
        }

        console.warn(
          `[LayaHarness] Gemini call failed on model ${candidateModel} (status ${status ?? 'unknown'}): ${lastError.message}`
        );
      }
    }

    // Final resilience fallback: if tool declarations caused an error across models, retry once without tools
    if (tools && tools.length > 0) {
      const hasFunctionTurn = messages.some((m) =>
        m.parts.some((p) => p.functionCall || p.functionResponse)
      );
      if (!hasFunctionTurn) {
        for (const candidateModel of candidateModels) {
          try {
            return await this.sendSingleGeminiRequest(
              apiKey,
              candidateModel,
              systemPrompt,
              messages,
              []
            );
          } catch {
            // continue
          }
        }
      }
    }

    throw lastError || new Error('Gemini API request failed.');
  }

  /**
   * Execute a single HTTP request to Gemini generateContent
   */
  private async sendSingleGeminiRequest(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: GeminiAPIMessage[],
    tools: any[]
  ): Promise<{
    text?: string;
    functionCalls?: Array<{ id?: string; name: string; args: any }>;
    rawModelContent?: GeminiAPIMessage;
  }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const isGemini3 = model.startsWith('gemini-3');
    const body: any = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: messages,
      generationConfig: {
        temperature: isGemini3 ? 1.0 : 0.4,
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
      const err: any = new Error(
        errJson.error?.message || `Gemini API call failed with status ${res.status}`
      );
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return { text: 'No response generated from Gemini.' };
    }

    const parts: GeminiAPIPart[] = candidate.content?.parts || [];
    const functionCalls: Array<{ id?: string; name: string; args: any }> = [];
    let text = '';

    for (const part of parts) {
      if (part.functionCall) {
        functionCalls.push({
          id: part.functionCall.id,
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
      if (part.text && !part.thought) {
        text += part.text;
      }
    }

    return {
      text: text.trim(),
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      rawModelContent: candidate.content,
    };
  }

  /**
   * Fallback for OpenAI-compatible providers (Groq / Ollama)
   */
  private async executeOpenAICompatibleAgentLoop(
    prompt: string,
    context?: AIConversationContext
  ): Promise<AgentResponse> {
    const isGroq = this.settings.provider === 'groq';
    const apiKey = (
      isGroq
        ? this.settings.groqApiKey || this.settings.apiKey || ''
        : this.settings.customApiKey || ''
    ).trim();
    const endpoint = isGroq
      ? GROQ_API_URL
      : `${(this.settings.customBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '')}/chat/completions`;

    if (isGroq && !apiKey) {
      throw new Error('Groq Cloud API key not configured. Please add your key in AI Settings.');
    }

    const rawSelected = (this.settings.selectedModel || '').trim();
    const primaryModel = isGroq
      ? rawSelected && !rawSelected.startsWith('gemini-')
        ? rawSelected
        : 'llama-3.3-70b-versatile'
      : rawSelected && !rawSelected.startsWith('gemini-')
      ? rawSelected
      : 'llama3.2:3b';

    const systemPrompt = buildLayaSystemPrompt({
      accountId: this.accountId,
      currency: this.currency,
      balance: this.balance,
      modelName: primaryModel,
    });

    const chatMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (context?.recentMessages && Array.isArray(context.recentMessages)) {
      context.recentMessages
        .filter((m) => !m.isError && typeof m.content === 'string' && m.content.trim().length > 0)
        .slice(-6)
        .forEach((m) => {
          if (m.role === 'user' && m.content.trim() === prompt.trim()) return;
          chatMessages.push({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content.trim(),
          });
        });
    }

    chatMessages.push({ role: 'user', content: prompt });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const candidateModels = isGroq
      ? Array.from(new Set([primaryModel, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.2-3b-preview']))
      : [primaryModel];

    let lastErr: Error | null = null;
    for (const candidateModel of candidateModels) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: candidateModel,
          messages: chatMessages,
          temperature: 0.5,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content || 'Unable to generate response.';
        return {
          text: content,
          engineBadge: 'system2',
        };
      }

      const errJson = await res.json().catch(() => ({}));
      lastErr = new Error(
        errJson.error?.message || `Inference provider failed with status ${res.status}`
      );
      if (res.status === 401 || res.status === 403) {
        throw lastErr;
      }
    }

    throw lastErr || new Error('Inference provider request failed');
  }
}
