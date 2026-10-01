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
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      description: 'Latest Google model with balanced speed and deep understanding',
      speed: 2,
      accuracy: 3,
      bestFor: 'Financial questions, analysis, and insights',
      recommended: true,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'gemini',
      description: 'Fast and light model with large context',
      speed: 3,
      accuracy: 2,
      bestFor: 'Quick replies and high volume chatting',
      recommended: false,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'gemini',
      description: 'Google’s most powerful reasoning model',
      speed: 1,
      accuracy: 4,
      bestFor: 'Deep financial audits and complex reports',
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
