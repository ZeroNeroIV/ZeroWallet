/**
 * Purpose: Manage AI chat state with message history and conversation context
 *
 * Outputs:
 *   - Exports useAIChatStore hook for accessing chat state
 *
 * Side effects:
 *   - Persists messages to MMKV storage
 *   - Auto-prunes messages when exceeding 100
 *   - Logs state changes for debugging
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from './middleware/mmkvStorage';
import type { AIMessage, AIConversationContext, FinancialWidget } from '../types/ai';
import type { PendingAction, ActionResult } from '../types/aiMutations';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// State Interface
// ============================================

interface AIChatState {
  // State
  messages: AIMessage[];
  isLoading: boolean;
  error: string | null;
  conversationContext: AIConversationContext | null;
  pendingActions: PendingAction[];

  // Message Actions
  addMessage: (
    role: 'user' | 'assistant',
    content: string,
    isError?: boolean,
    pendingActionId?: string,
    widgets?: FinancialWidget[],
    engineBadge?: string
  ) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateContext: (context: AIConversationContext) => void;

  // Pending Action Actions
  addPendingAction: (action: PendingAction) => void;
  confirmAction: (actionId: string) => Promise<ActionResult>;
  cancelAction: (actionId: string) => void;
  getPendingAction: (actionId: string) => PendingAction | undefined;
  expireOldActions: () => void;
  clearPendingActions: () => void;
}

// ============================================
// AI Chat Store
// ============================================

export const useAIChatStore = create<AIChatState>()(
  persist(
    (set, get) => ({
      // Initial State
      messages: [],
      isLoading: false,
      error: null,
      conversationContext: null,
      pendingActions: [],

      // Actions

      /**
       * Add a message to the conversation
       */
      addMessage: (role, content, isError = false, pendingActionId?: string, widgets?: FinancialWidget[], engineBadge?: 'system1' | 'system2') => {
        const message: AIMessage = {
          id: uuidv4(),
          role,
          content,
          timestamp: Date.now(),
          isError,
          pendingActionId, // Link message to pending action
          widgets,
          engineBadge,
        };

        set((state) => {
          // Add new message
          let newMessages = [...state.messages, message];

          // Auto-prune if exceeding 100 messages
          if (newMessages.length > 100) {
            console.log('[AIChatStore] Auto-pruning messages (keeping last 100)');
            newMessages = newMessages.slice(-100);
          }

          return {
            messages: newMessages,
          };
        });

        console.log(`[AIChatStore] Added ${role} message:`, message.id);
      },

      /**
       * Clear all messages
       */
      clearMessages: () => {
        set({
          messages: [],
          conversationContext: null,
          error: null,
        });

        console.log('[AIChatStore] All messages cleared');
      },

      /**
       * Set loading state
       */
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      /**
       * Set error state
       */
      setError: (error) => {
        set({ error });

        if (error) {
          console.error('[AIChatStore] Error set:', error);
        }
      },

      /**
       * Update conversation context
       */
      updateContext: (context) => {
        set({ conversationContext: context });
        console.log('[AIChatStore] Context updated');
      },

      // ============================================
      // Pending Action Management
      // ============================================

      /**
       * Add a pending action
       */
      addPendingAction: (action) => {
        set((state) => ({
          pendingActions: [...state.pendingActions, action],
        }));

        console.log('[AIChatStore] Pending action added:', action.id, action.summary);

        // Auto-expire after TTL
        setTimeout(() => {
          get().expireOldActions();
        }, action.expiresAt - Date.now());
      },

      /**
       * Confirm and execute a pending action
       */
      confirmAction: async (actionId) => {
        const action = get().pendingActions.find((a) => a.id === actionId);

        if (!action) {
          throw new Error('Action not found');
        }

        if (action.status !== 'pending') {
          throw new Error(`Action is ${action.status} and cannot be confirmed`);
        }

        if (Date.now() > action.expiresAt) {
          // Mark as expired
          set((state) => ({
            pendingActions: state.pendingActions.map((a) =>
              a.id === actionId ? { ...a, status: 'expired' as const } : a
            ),
          }));
          throw new Error('Action has expired');
        }

        try {
          // Import mutation service dynamically to avoid circular deps
          const { DataMutationService } = await import('../services/ai/dataMutationService');
          const { useAuthStore } = await import('./authStore');

          const authState = useAuthStore.getState();
          const accountId = authState.currentAccountId;
          const userId = authState.currentUser?.id;

          if (!accountId || !userId) {
            throw new Error('User not authenticated');
          }

          const mutationService = new DataMutationService(accountId, userId);

          // Execute the action (pass the action object so it doesn't need to be in the service's Map)
          const result = await mutationService.executeAction(actionId, action);

          // Update action status to confirmed
          set((state) => ({
            pendingActions: state.pendingActions.map((a) =>
              a.id === actionId ? { ...a, status: 'confirmed' as const } : a
            ),
          }));

          console.log('[AIChatStore] Action confirmed and executed:', actionId);

          return result;
        } catch (error) {
          // Mark action as failed
          set((state) => ({
            pendingActions: state.pendingActions.map((a) =>
              a.id === actionId ? { ...a, status: 'failed' as const } : a
            ),
          }));

          console.error('[AIChatStore] Failed to execute action:', error);
          throw error;
        }
      },

      /**
       * Cancel a pending action
       */
      cancelAction: (actionId) => {
        set((state) => ({
          pendingActions: state.pendingActions.map((a) =>
            a.id === actionId ? { ...a, status: 'cancelled' as const } : a
          ),
        }));

        console.log('[AIChatStore] Action cancelled:', actionId);
      },

      /**
       * Get a pending action by ID
       */
      getPendingAction: (actionId) => {
        return get().pendingActions.find((a) => a.id === actionId);
      },

      /**
       * Expire old pending actions
       */
      expireOldActions: () => {
        const now = Date.now();

        set((state) => ({
          pendingActions: state.pendingActions.map((a) =>
            a.status === 'pending' && now > a.expiresAt
              ? { ...a, status: 'expired' as const }
              : a
          ),
        }));

        console.log('[AIChatStore] Expired old pending actions');
      },

      /**
       * Clear all pending actions
       */
      clearPendingActions: () => {
        set({ pendingActions: [] });
        console.log('[AIChatStore] All pending actions cleared');
      },
    }),
    {
      name: 'ai-chat-storage',
      storage: mmkvStorage,
      // Only persist messages, context, and pending actions (not loading/error states)
      partialize: (state) => ({
        messages: state.messages,
        conversationContext: state.conversationContext,
        pendingActions: state.pendingActions,
      }),
    }
  )
);
