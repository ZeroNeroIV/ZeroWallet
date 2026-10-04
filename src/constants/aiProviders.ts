/**
 * Purpose: Define AI providers, models, and specifications for Gemini and Groq SLMs
 */

import type { AIProvider, ModelInfo } from '../types/ai';

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434/v1';

export const PROVIDER_LABELS: Record<AIProvider, { name: string; subtitle: string; icon: string }> = {
  gemini: {
    name: 'Google Gemini',
    subtitle: 'Multimodal, deep reasoning & native tool calling',
    icon: 'google',
  },
  groq: {
    name: 'Groq Cloud (Fast SLM)',
    subtitle: 'Ultra-fast mobile inference with Llama 3.2 (~150ms)',
    icon: 'lightning-bolt',
  },
  custom_openai: {
    name: 'Local SLM / Custom',
    subtitle: 'Self-hosted Ollama, LM Studio, or OpenAI endpoint',
    icon: 'server',
  },
};

export const PROVIDER_MODELS: Record<AIProvider, ModelInfo[]> = {
  groq: [
    {
      id: 'llama-3.2-1b-preview',
      name: 'Llama 3.2 1B (Ultra-Light SLM)',
      provider: 'groq',
      description: 'Extremely fast compact model, ideal for mobile devices',
      speed: 3,
      accuracy: 2,
      bestFor: 'Instant mobile answers and low battery usage',
      recommended: false,
    },
    {
      id: 'llama-3.2-3b-preview',
      name: 'Llama 3.2 3B (Fast SLM)',
      provider: 'groq',
      description: 'Best-in-class small language model for structured finance tasks',
      speed: 3,
      accuracy: 3,
      bestFor: 'High accuracy expense parsing and advice',
      recommended: true,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      provider: 'groq',
      description: 'Balanced speed and high reasoning capability',
      speed: 2,
      accuracy: 3,
      bestFor: 'Detailed financial insights and multi-step planning',
      recommended: false,
    },
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile',
      provider: 'groq',
      description: 'Flagship open-weights model for complex financial analysis',
      speed: 2,
      accuracy: 4,
      bestFor: 'Comprehensive budgeting and debt payoff strategy',
      recommended: false,
    },
  ],
  gemini: [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      provider: 'gemini',
      description: 'Google’s state-of-the-art agentic model for tool calling, speed & multimodal reasoning',
      speed: 3,
      accuracy: 4,
      tokensPerMinute: 4000000,
      maxOutputTokens: 8192,
      bestFor: 'Agentic ledger management, tool execution, and interactive charts',
      recommended: true,
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash Lite',
      provider: 'gemini',
      description: 'Ultra-fast, lowest latency model for rapid mobile financial execution',
      speed: 3,
      accuracy: 3,
      tokensPerMinute: 4000000,
      maxOutputTokens: 8192,
      bestFor: 'Instant queries, quick calculations, and high-frequency usage',
      recommended: false,
    },
    {
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini 3.1 Pro',
      provider: 'gemini',
      description: 'Highest reasoning capability for complex multi-month forecasting & audits',
      speed: 1,
      accuracy: 4,
      tokensPerMinute: 2000000,
      maxOutputTokens: 8192,
      bestFor: 'Deep financial planning, debt payoff strategies, and audits',
      recommended: false,
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      description: 'Reliable fast model with balanced intelligence',
      speed: 2,
      accuracy: 3,
      tokensPerMinute: 4000000,
      maxOutputTokens: 8192,
      bestFor: 'General financial questions and transaction queries',
      recommended: false,
    },
  ],
  custom_openai: [
    {
      id: 'smollm2:1.7b',
      name: 'SmolLM2 1.7B (Local SLM)',
      provider: 'custom_openai',
      description: 'Local on-device or LAN SLM by HuggingFace',
      speed: 3,
      accuracy: 2,
      bestFor: 'Complete offline privacy on local Ollama server',
      recommended: true,
    },
    {
      id: 'llama3.2:3b',
      name: 'Llama 3.2 3B (Local SLM)',
      provider: 'custom_openai',
      description: 'Local Meta SLM via Ollama or LM Studio',
      speed: 2,
      accuracy: 3,
      bestFor: 'Local high accuracy',
      recommended: false,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini (OpenAI)',
      provider: 'custom_openai',
      description: 'Fast cloud model via official OpenAI API',
      speed: 2,
      accuracy: 3,
      bestFor: 'OpenAI ecosystem users',
      recommended: false,
    },
  ],
};
