/**
 * HITL Store — State management for Human-In-The-Loop Approval Queue
 */

import { create } from 'zustand';
import type { HitlApprovalItem } from '../types/hitl';

interface HitlState {
  pendingItems: HitlApprovalItem[];
  isOpen: boolean;
  isProcessing: boolean;

  enqueueItems: (items: HitlApprovalItem[]) => void;
  removeCurrentItem: () => void;
  openDialog: () => void;
  closeDialog: () => void;
  setIsProcessing: (isProcessing: boolean) => void;
  clearQueue: () => void;
}

export const useHitlStore = create<HitlState>((set) => ({
  pendingItems: [],
  isOpen: false,
  isProcessing: false,

  enqueueItems: (items: HitlApprovalItem[]) => {
    if (!items || items.length === 0) return;
    set((state) => {
      const existingIds = new Set(state.pendingItems.map((i) => i.id));
      const newItems = items.filter((i) => !existingIds.has(i.id));
      if (newItems.length === 0) return state;

      const updated = [...state.pendingItems, ...newItems];
      return {
        pendingItems: updated,
        isOpen: true,
      };
    });
  },

  removeCurrentItem: () => {
    set((state) => {
      const remaining = state.pendingItems.slice(1);
      return {
        pendingItems: remaining,
        isOpen: remaining.length > 0,
        isProcessing: false,
      };
    });
  },

  openDialog: () => set({ isOpen: true }),
  closeDialog: () => set({ isOpen: false, isProcessing: false }),
  setIsProcessing: (isProcessing: boolean) => set({ isProcessing }),
  clearQueue: () => set({ pendingItems: [], isOpen: false, isProcessing: false }),
}));
