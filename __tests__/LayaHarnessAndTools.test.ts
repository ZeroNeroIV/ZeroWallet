import { FinancialToolRegistry } from '../src/services/ai/harness/tools/financialTools';
import { LayaHarness } from '../src/services/ai/harness/LayaHarness';
import type { AIConversationContext, AISettings } from '../src/types/ai';

describe('FinancialToolRegistry & LayaHarness Gemini Compatibility', () => {
  const defaultSettings: AISettings = {
    provider: 'gemini',
    apiKey: 'test-gemini-key',
    geminiApiKey: 'test-gemini-key',
    selectedModel: 'gemini-3.8-flash',
    system1Enabled: false,
    isConfigured: true,
    totalTokensUsed: 0,
    conversationCount: 0,
    lastUsed: null,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('FinancialToolRegistry produces valid Gemini OpenAPI function_declarations without empty or bare object schemas', () => {
    const registry = new FinancialToolRegistry('acc-1', 'user-1');
    const defs = registry.getToolDefinitions();

    expect(defs.length).toBeGreaterThanOrEqual(25);

    for (const def of defs) {
      expect(typeof def.name).toBe('string');
      expect(typeof def.description).toBe('string');

      if (def.parameters !== undefined) {
        expect(def.parameters.type).toBe('object');
        const propEntries = Object.entries(def.parameters.properties || {});
        // Parameterized tools must have at least one defined property
        expect(propEntries.length).toBeGreaterThan(0);

        // No nested property may be { type: 'object' } without its own non-empty properties
        for (const [, propSchema] of propEntries as Array<[string, any]>) {
          if (propSchema.type === 'object') {
            expect(Object.keys(propSchema.properties || {}).length).toBeGreaterThan(0);
          }
          if (propSchema.type === 'array' && propSchema.items?.type === 'object') {
            expect(Object.keys(propSchema.items.properties || {}).length).toBeGreaterThan(0);
          }
        }
      }
    }

    // Parameterless tools omit `parameters` so Gemini schema compiler never rejects empty properties
    const balanceTool = defs.find((d) => d.name === 'getAccountBalance');
    expect(balanceTool).toBeDefined();
    expect(balanceTool.parameters).toBeUndefined();

    // Mutation tools expose their real domain arguments
    const createTxTool = defs.find((d) => d.name === 'createTransaction');
    expect(createTxTool).toBeDefined();
    expect(createTxTool.parameters.properties).toHaveProperty('amount');
    expect(createTxTool.parameters.properties).toHaveProperty('categoryName');
    expect(createTxTool.parameters.properties).toHaveProperty('type');
  });

  test('buildGeminiContents filters error messages and guarantees strict user/model role alternation', () => {
    const harness = new LayaHarness(defaultSettings, 'acc-1', 'user-1', 'USD', 1000);
    const context: AIConversationContext = {
      accountId: 'acc-1',
      accountCurrency: 'USD',
      accountBalance: 1000,
      timestamp: Date.now(),
      recentMessages: [
        {
          id: '1',
          role: 'assistant',
          content: 'Leading model greeting',
          timestamp: 1,
        },
        {
          id: '2',
          role: 'user',
          content: 'First failed prompt',
          timestamp: 2,
        },
        {
          id: '3',
          role: 'assistant',
          content: 'Internal error encountered.',
          timestamp: 3,
          isError: true,
        },
        {
          id: '4',
          role: 'user',
          content: 'What is my balance?',
          timestamp: 4,
        },
        {
          id: '5',
          role: 'assistant',
          content: 'Your balance is $1,000.',
          timestamp: 5,
        },
        {
          id: '6',
          role: 'user',
          content: 'How much did I spend this month?',
          timestamp: 6,
        },
      ],
    };

    const contents = harness.buildGeminiContents('How much did I spend this month?', context);

    // Must start with 'user' and strictly alternate user -> model -> user
    expect(contents.length).toBe(3);
    expect(contents[0]).toEqual({
      role: 'user',
      parts: [{ text: 'What is my balance?' }],
    });
    expect(contents[1]).toEqual({
      role: 'model',
      parts: [{ text: 'Your balance is $1,000.' }],
    });
    expect(contents[2]).toEqual({
      role: 'user',
      parts: [{ text: 'How much did I spend this month?' }],
    });
  });

  test('automatically falls back to gemini-2.5-flash when primary model returns 500 Internal error encountered.', async () => {
    const fetchMock = jest
      .fn()
      // First model fails with 500 Internal error encountered.
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: 500,
            message: 'Internal error encountered.',
            status: 'INTERNAL',
          },
        }),
      })
      // Fallback model succeeds
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Your total balance across all vaults is $1,250.00.' }],
              },
            },
          ],
        }),
      });

    (global as any).fetch = fetchMock;

    const harness = new LayaHarness(defaultSettings, 'acc-1', 'user-1', 'USD', 1250);
    const res = await harness.processMessage('What is my balance?');

    expect(res.text).toBe('Your total balance across all vaults is $1,250.00.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('models/gemini-3.8-flash:generateContent');
    expect(fetchMock.mock.calls[1][0]).toContain('models/gemini-2.5-flash:generateContent');

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.systemInstruction).toBeDefined();
    expect(sentBody.contents[0].role).toBe('user');
  });

  test('preserves thoughtSignature and sends structured functionResponse during tool execution', async () => {
    const fetchMock = jest
      .fn()
      // Turn 1: model emits functionCall with thoughtSignature
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    thoughtSignature: 'sig-encrypted-123',
                    functionCall: {
                      id: 'call-1',
                      name: 'generateChart',
                      args: {
                        chartType: 'donut',
                        title: 'Spending Breakdown',
                        data: [{ label: 'Food', value: 120 }],
                      },
                    },
                  },
                ],
              },
            },
          ],
        }),
      })
      // Turn 2: model synthesizes final text
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Here is your spending breakdown chart.' }],
              },
            },
          ],
        }),
      });

    (global as any).fetch = fetchMock;

    const harness = new LayaHarness(defaultSettings, 'acc-1', 'user-1', 'USD', 1000);
    const res = await harness.processMessage('Show me a spending chart');

    expect(res.text).toBe('Here is your spending breakdown chart.');
    expect(res.widgets).toHaveLength(1);
    expect(res.widgets?.[0].type).toBe('chart');

    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    // Contents should be: [user prompt, model functionCall with thoughtSignature, user functionResponse]
    expect(secondCallBody.contents).toHaveLength(3);
    expect(secondCallBody.contents[1].role).toBe('model');
    expect(secondCallBody.contents[1].parts[0].thoughtSignature).toBe('sig-encrypted-123');
    expect(secondCallBody.contents[2].role).toBe('user');
    expect(secondCallBody.contents[2].parts[0].functionResponse).toEqual({
      id: 'call-1',
      name: 'generateChart',
      response: {
        result: {
          generated: true,
          title: 'Spending Breakdown',
          totalPoints: 1,
        },
      },
    });
  });
});
