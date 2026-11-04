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
import { GROQ_API_URL, OPENROUTER_API_URL } from '../../../constants/aiProviders';

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
    if (!trimmed || trimmed.startsWith('gemini-1.5') || trimmed === 'gemini-2.0-flash-lite') {
      return 'gemini-3.8-flash';
    }
    if (
      trimmed.startsWith('gemini-') &&
      !trimmed.includes('-tts') &&
      !trimmed.includes('embedding') &&
      !trimmed.includes('imagen')
    ) {
      return trimmed;
    }
    return 'gemini-3.8-flash';
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
        'gemini-3.5-flash-lite',
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
          functionDeclarations: tools,
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
   * Universal Agent Loop for OpenAI-compatible providers (Groq, OpenRouter, Ollama, LM Studio)
   * Executes multi-turn ReAct reasoning loop with tools, financial widgets, and mutation tickets.
   */
  private async executeOpenAICompatibleAgentLoop(
    prompt: string,
    context?: AIConversationContext
  ): Promise<AgentResponse> {
    const provider = this.settings.provider;
    const isGroq = provider === 'groq';
    const isOpenRouter = provider === 'openrouter';

    let apiKey = '';
    let endpoint = '';

    if (isGroq) {
      apiKey = (this.settings.groqApiKey || this.settings.apiKey || '').trim();
      endpoint = GROQ_API_URL;
      if (!apiKey) {
        throw new Error('Groq Cloud API key not configured. Please add your free key in AI Settings.');
      }
    } else if (isOpenRouter) {
      apiKey = (this.settings.openrouterApiKey || this.settings.apiKey || '').trim();
      endpoint = OPENROUTER_API_URL;
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured. Please add your key in AI Settings.');
      }
    } else {
      apiKey = (this.settings.customApiKey || this.settings.apiKey || '').trim();
      let base = (this.settings.customBaseUrl || 'http://localhost:11434/v1').trim();
      if (!base.endsWith('/chat/completions')) {
        base = base.replace(/\/+$/, '') + '/chat/completions';
      }
      endpoint = base;
    }

    const rawSelected = (this.settings.selectedModel || '').trim();
    let primaryModel = rawSelected;
    if (!primaryModel || primaryModel.startsWith('gemini-')) {
      if (isGroq) primaryModel = 'llama-3.3-70b-versatile';
      else if (isOpenRouter) primaryModel = 'deepseek/deepseek-r1';
      else primaryModel = 'llama3.2:3b';
    }

    const systemPrompt = buildLayaSystemPrompt({
      accountId: this.accountId,
      currency: this.currency,
      balance: this.balance,
      modelName: primaryModel,
    });

    const execContext: AgentExecutionContext = {
      accountId: this.accountId,
      userId: this.userId,
      currency: this.currency,
      balance: this.balance,
    };

    const chatMessages: Array<any> = [
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    if (isOpenRouter) {
      headers['HTTP-Referer'] = 'https://github.com/ZeroWallet';
      headers['X-Title'] = 'ZeroWallet AI Copilot';
    }

    // Format tool definitions for OpenAI tool calling spec
    const openAITools = this.toolRegistry.getToolDefinitions().map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters || { type: 'object', properties: {} },
      },
    }));

    const accumulatedWidgets: FinancialWidget[] = [];
    const accumulatedActions: PendingAction[] = [];

    let turns = 0;
    const maxTurns = 4;
    let finalAnswer = '';

    while (turns < maxTurns) {
      turns++;

      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: primaryModel,
            messages: chatMessages,
            tools: openAITools,
            temperature: 0.3,
            max_tokens: 1024,
          }),
        });
      } catch (networkErr: any) {
        throw new Error(`Failed to reach ${provider}: ${networkErr.message || 'Network error'}`);
      }

      if (!res.ok) {
        // Fallback: If model doesn't support tools (e.g. small local SLM on Ollama), retry once without tools
        if (turns === 1 && res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403) {
          try {
            const noToolsRes = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: primaryModel,
                messages: chatMessages,
                temperature: 0.5,
              }),
            });
            if (noToolsRes.ok) {
              const noToolsJson = await noToolsRes.json();
              return {
                text: noToolsJson.choices?.[0]?.message?.content || 'Ledger review complete.',
                engineBadge: 'system2',
              };
            }
          } catch {}
        }

        const errJson = await res.json().catch(() => ({}));
        const errorMsg = errJson.error?.message || `Provider returned HTTP ${res.status}`;
        throw new Error(`${provider.toUpperCase()} Error: ${errorMsg}`);
      }

      const json = await res.json();
      const choice = json.choices?.[0];
      if (!choice) break;

      const messageObj = choice.message;
      const toolCalls = messageObj?.tool_calls;

      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        chatMessages.push(messageObj);

        for (const call of toolCalls) {
          const fnName = call.function?.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(call.function?.arguments || '{}');
          } catch {
            fnArgs = {};
          }

          const tool = this.toolRegistry.getExecutableTool(fnName);
          let toolResult;

          if (tool) {
            toolResult = await tool.execute(fnArgs, execContext);
          } else {
            toolResult = { success: false, error: `Unknown tool: ${fnName}` };
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

          chatMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: fnName,
            content: JSON.stringify(resultPayload),
          });
        }
      } else {
        finalAnswer = messageObj?.content || 'I completed your financial request.';
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
}
