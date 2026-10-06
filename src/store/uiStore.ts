// UI Store - Manages UI state with MMKV persistence for preferences like number hiding
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from './middleware/mmkvStorage';
import type { UIState } from '../types/store';

// ============================================
// UI Store
// ============================================

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // State
      isAddTransactionVisible: false,
      isLoading: false,
      activeBottomSheet: null,
      showFAB: true,
      error: null,
      isBalanceHidden: false,

      // Actions
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      toggleAddTransaction: () => {
        set((state) => ({
          isAddTransactionVisible: !state.isAddTransactionVisible,
        }));
      },

      setActiveBottomSheet: (sheetId) => {
        set({ activeBottomSheet: sheetId });
      },

      setShowFAB: (show) => {
        set({ showFAB: show });
      },

      setError: (error) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      toggleBalanceHidden: () => {
        set((state) => ({
          isBalanceHidden: !state.isBalanceHidden,
        }));
      },

      setBalanceHidden: (hidden) => {
        set({ isBalanceHidden: hidden });
      },
    }),
    {
      name: 'ui-storage',
      storage: mmkvStorage,
      partialize: (state) => ({
        isBalanceHidden: state.isBalanceHidden,
      }),
    }
  )
);
