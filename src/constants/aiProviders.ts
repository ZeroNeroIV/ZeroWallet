/**
 * Purpose: Define AI providers, models, specifications, and provider portal links
 */

import type { AIProvider, ModelInfo } from '../types/ai';

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434/v1';

export const GEMINI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';
export const GEMINI_DOCS_URL = 'https://ai.google.dev/gemini-api/docs';
export const GROQ_CONSOLE_URL = 'https://console.groq.com/keys';
export const GROQ_DOCS_URL = 'https://console.groq.com/docs';
export const OPENROUTER_CONSOLE_URL = 'https://openrouter.ai/keys';
export const OPENROUTER_DOCS_URL = 'https://openrouter.ai/docs';
export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';
export const OLLAMA_MODELS_URL = 'https://ollama.com/library';
export const LMSTUDIO_DOWNLOAD_URL = 'https://lmstudio.ai';

export interface ProviderLinkMeta {
  name: string;
  subtitle: string;
  icon: string;
  consoleUrl: string;
  consoleLabel: string;
  docsUrl: string;
  docsLabel: string;
  badge?: string;
  description: string;
  freeTier: string;
}

export const PROVIDER_PORTAL_LINKS: Record<AIProvider, ProviderLinkMeta> = {
  gemini: {
    name: 'Google Gemini',
    subtitle: 'Multimodal, deep reasoning & native tool calling',
    icon: 'google',
    consoleUrl: GEMINI_STUDIO_URL,
    consoleLabel: 'Google AI Studio',
    docsUrl: GEMINI_DOCS_URL,
    docsLabel: 'Gemini API Documentation',
    badge: 'RECOMMENDED',
    description: "Google's state-of-the-art multimodal AI with native tool calling, large context window, and generous free tier.",
    freeTier: 'Free tier available (up to 15 RPM / 1M TPM on Flash models)',
  },
  groq: {
    name: 'Groq Cloud',
    subtitle: 'Ultra-fast LPU inference with open weights (~150ms)',
    icon: 'lightning-bolt',
    consoleUrl: GROQ_CONSOLE_URL,
    consoleLabel: 'Groq Cloud Console',
    docsUrl: GROQ_DOCS_URL,
    docsLabel: 'Groq API Documentation',
    badge: 'ULTRA-FAST',
    description: 'Hardware-accelerated LPU chips offering unmatched token generation speed with Llama 3.3 and DeepSeek R1 distill.',
    freeTier: 'Generous free developer tier with no credit card required',
  },
  openrouter: {
    name: 'OpenRouter',
    subtitle: 'Unified gateway to 200+ models (Claude, DeepSeek, GPT-4o)',
    icon: 'hubspot',
    consoleUrl: OPENROUTER_CONSOLE_URL,
    consoleLabel: 'OpenRouter Keys Portal',
    docsUrl: OPENROUTER_DOCS_URL,
    docsLabel: 'OpenRouter Documentation',
    badge: 'UNIFIED GATEWAY',
    description: 'Single API key access to Claude 3.5/3.7, DeepSeek R1/V3, Llama 3.3, and all major frontier AI models.',
    freeTier: 'Includes free models (:free suffix) & pay-as-you-go credits',
  },
  custom_openai: {
    name: 'Local SLM / Custom',
    subtitle: 'Self-hosted Ollama, LM Studio, or OpenAI endpoint',
    icon: 'server',
    consoleUrl: OLLAMA_DOWNLOAD_URL,
    consoleLabel: 'Ollama Platform',
    docsUrl: OLLAMA_MODELS_URL,
    docsLabel: 'Ollama Model Library',
    badge: '100% PRIVATE',
    description: 'Runs on your own machine or local network for 100% offline financial privacy with zero data transmission.',
    freeTier: '100% Free & Open Source (runs on your hardware)',
  },
};

export const PROVIDER_LABELS: Record<AIProvider, { name: string; subtitle: string; icon: string }> = {
  gemini: {
    name: 'Google Gemini',
    subtitle: 'Multimodal, deep reasoning & native tool calling',
    icon: 'google',
  },
  groq: {
    name: 'Groq Cloud (Fast SLM)',
    subtitle: 'Ultra-fast mobile inference with Llama 3.3 (~150ms)',
    icon: 'lightning-bolt',
  },
  openrouter: {
    name: 'OpenRouter (Frontier Models)',
    subtitle: 'DeepSeek R1, Claude 3.5, and 200+ unified models',
    icon: 'hubspot',
  },
  custom_openai: {
    name: 'Local SLM / Custom',
    subtitle: 'Self-hosted Ollama, LM Studio, or OpenAI endpoint',
    icon: 'server',
  },
};

export interface EndpointPreset {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  defaultModel: string;
}

export const LOCAL_ENDPOINT_PRESETS: EndpointPreset[] = [
  {
    id: 'ollama_local',
    label: 'Ollama (Localhost)',
    description: 'Running on same machine (11434)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2:3b',
  },
  {
    id: 'ollama_android_emu',
    label: 'Ollama (Android Host 10.0.2.2)',
    description: 'Routes to host PC from Android Emulator',
    baseUrl: 'http://10.0.2.2:11434/v1',
    defaultModel: 'llama3.2:3b',
  },
  {
    id: 'lmstudio_local',
    label: 'LM Studio (Localhost 1234)',
    description: 'Running on local port 1234',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
  },
  {
    id: 'openai_official',
    label: 'OpenAI Platform',
    description: 'Official api.openai.com endpoint',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
];

export const PROVIDER_MODELS: Record<AIProvider, ModelInfo[]> = {
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile',
      provider: 'groq',
      description: 'Flagship open-weights model for complex financial analysis & tool calling',
      speed: 3,
      accuracy: 4,
      bestFor: 'Comprehensive budgeting, charts, and debt payoff strategy',
      recommended: true,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      provider: 'groq',
      description: 'Balanced ultra-fast inference and high financial reasoning capability',
      speed: 3,
      accuracy: 3,
      bestFor: 'Rapid mobile answers, daily expense tracking, and low latency',
      recommended: false,
    },
    {
      id: 'llama-3.2-3b-preview',
      name: 'Llama 3.2 3B (Fast SLM)',
      provider: 'groq',
      description: 'Compact small language model for structured finance tasks',
      speed: 3,
      accuracy: 3,
      bestFor: 'Instant mobile answers and quick expense categorization',
      recommended: false,
    },
    {
      id: 'llama-3.2-1b-preview',
      name: 'Llama 3.2 1B (Ultra-Light SLM)',
      provider: 'groq',
      description: 'Lightest edge model, ideal for mobile devices with minimal battery usage',
      speed: 3,
      accuracy: 2,
      bestFor: 'Instant lightweight answers',
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
      description: 'Reliable fast model with balanced intelligence and high stability',
      speed: 2,
      accuracy: 3,
      tokensPerMinute: 4000000,
      maxOutputTokens: 8192,
      bestFor: 'General financial questions and transaction queries',
      recommended: false,
    },
  ],
  openrouter: [
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1 (Reasoning)',
      provider: 'openrouter',
      description: 'Frontier reasoning model with transparent chain-of-thought financial deduction',
      speed: 2,
      accuracy: 4,
      bestFor: 'Deep financial planning, debt payoff strategy & audits',
      recommended: true,
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek V3 (Chat)',
      provider: 'openrouter',
      description: 'Extremely cost-effective 671B MoE model for high-speed queries',
      speed: 3,
      accuracy: 4,
      bestFor: 'Daily expense tracking and interactive chats',
      recommended: false,
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      provider: 'openrouter',
      description: 'Flagship open-weights model with excellent tool following',
      speed: 3,
      accuracy: 4,
      bestFor: 'Comprehensive ledger analysis and chart generation',
      recommended: false,
    },
    {
      id: 'google/gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (via OpenRouter)',
      provider: 'openrouter',
      description: 'Google’s ultra-fast model accessed through unified OpenRouter routing',
      speed: 3,
      accuracy: 3,
      bestFor: 'High-speed mobile queries',
      recommended: false,
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openrouter',
      description: 'Compact OpenAI model with fast latency and solid reasoning',
      speed: 3,
      accuracy: 3,
      bestFor: 'Everyday budget tasks and category sorting',
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
