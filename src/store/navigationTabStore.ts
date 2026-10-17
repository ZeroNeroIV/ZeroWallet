import { create } from 'zustand';

interface NavigationTabState {
  activeTabIndex: number;
  targetScrollIndex: number | null;
  setActiveTabIndex: (index: number) => void;
  scrollToTab: (index: number) => void;
  clearScrollTarget: () => void;
}

export const useNavigationTabStore = create<NavigationTabState>((set) => ({
  activeTabIndex: 0,
  targetScrollIndex: null,
  setActiveTabIndex: (index: number) => set({ activeTabIndex: index }),
  scrollToTab: (index: number) => set({ activeTabIndex: index, targetScrollIndex: null }),
  clearScrollTarget: () => set({ targetScrollIndex: null }),
}));
