// UI Store - Manages UI state (not persisted)
import { create } from 'zustand';
import type { UIState } from '../types/store';

// ============================================
// UI Store
// ============================================

export const useUIStore = create<UIState>()((set, get) => ({
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
}));
