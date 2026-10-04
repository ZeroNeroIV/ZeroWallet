/**
 * LAYA Financial Agent Harness — Core Type Definitions
 *
 * Provides strong typing for the agent harness loop, modular financial tools,
 * generative UI visual widgets, and live voice interactions.
 */

import type { FinancialWidget, GeminiModel, AIProvider, AISettings } from '../../../types/ai';
import type { PendingAction } from '../../../types/aiMutations';

export type ToolKind = 'read' | 'write' | 'visual';

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: readonly string[];
  items?: {
    type: string;
    properties?: Record<string, ToolParameterProperty>;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  kind: ToolKind;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: readonly string[];
  };
}

export interface AgentExecutionContext {
  accountId: string;
  userId: string;
  currency: string;
  balance: number;
}

export interface ExecutableTool extends ToolDefinition {
  execute: (args: any, context: AgentExecutionContext) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  widget?: FinancialWidget;
  pendingAction?: PendingAction;
}

export interface AgentStep {
  stepIndex: number;
  thought?: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  observations?: Array<{
    name: string;
    result: any;
  }>;
}

export interface AgentResponse {
  text: string;
  widgets?: FinancialWidget[];
  pendingActions?: PendingAction[];
  steps?: AgentStep[];
  engineBadge: 'system1' | 'system2';
}

export type VoiceCallStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted';

export interface LiveTranscriptLine {
  id: string;
  sender: 'user' | 'laya';
  text: string;
  timestamp: number;
  isFinal: boolean;
}
