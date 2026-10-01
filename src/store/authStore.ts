// Auth Store - Manages user authentication and current session
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import CryptoJS from 'crypto-js';
import { mmkvStorage } from './middleware/mmkvStorage';
import { useAccountStore } from './accountStore';
import type { AuthState } from '../types/store';

// ============================================
// Auth Store
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // State
      currentUser: null,
      currentAccountId: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // Import UserRepository dynamically to avoid circular dependencies
          const { UserRepository } = await import('../database/repositories/UserRepository');
          const userRepo = new UserRepository();

          // Find user by email
          const user = await userRepo.findByEmail(email);

          if (!user) {
            throw new Error('User not found');
          }

          // Verify password (using crypto-js)
          const hash = CryptoJS.SHA256(password).toString();

          if (user.passwordHash !== hash) {
            throw new Error('Invalid password');
          }

          // Get default account for user
          const { AccountRepository } = await import(
            '../database/repositories/AccountRepository'
          );
          const accountRepo = new AccountRepository();
          const defaultAccount = await accountRepo.findDefaultByUser(user.id);

          const accountId = defaultAccount?.id || null;
          useAccountStore.getState().setCurrentAccountId(accountId);

          set({
            currentUser: user,
            currentAccountId: accountId,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('[Auth] User logged in successfully:', user.email);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Login failed';
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      signup: async (email: string, password: string, name: string, currency: string = 'USD') => {
        set({ isLoading: true, error: null });

        try {
          // Import UserRepository dynamically
          const { UserRepository } = await import('../database/repositories/UserRepository');
          const userRepo = new UserRepository();

          // Check if user already exists
          const existingUser = await userRepo.findByEmail(email);
          if (existingUser) {
            throw new Error('User already exists');
          }

          // Hash password (using crypto-js)
          const passwordHash = CryptoJS.SHA256(password).toString();

          // Create user
          const newUser = await userRepo.create({
            email,
            passwordHash,
            name,
          });

          // Create default account with selected currency
          const { AccountRepository } = await import(
            '../database/repositories/AccountRepository'
          );
          const accountRepo = new AccountRepository();
          const defaultAccount = await accountRepo.create({
            userId: newUser.id,
            name: 'My Wallet',
            currency: currency,
            icon: 'wallet',
            color: '#4ECDC4',
            isDefault: true,
          });

          // Create default categories
          const { createDefaultCategories } = await import(
            '../database/repositories/CategoryRepository'
          );
          await createDefaultCategories(newUser.id);

          // Initialize account balance
          useAccountStore.getState().initializeBalance(defaultAccount.id);
          useAccountStore.getState().setCurrentAccountId(defaultAccount.id);

          set({
            currentUser: newUser,
            currentAccountId: defaultAccount.id,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('[Auth] User signed up successfully:', newUser.email);

          // Return account info for welcome message
          return defaultAccount;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Signup failed';
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: () => {
        // Clear all stores
        const { useSettingsStore } = require('./settingsStore');

        useAccountStore.getState().resetBalances();
        useAccountStore.getState().setCurrentAccountId(null);
        useSettingsStore.getState().resetSettings();

        set({
          currentUser: null,
          currentAccountId: null,
          isAuthenticated: false,
          error: null,
        });

        console.log('[Auth] User logged out');
      },

      switchAccount: (accountId: string) => {
        useAccountStore.getState().setCurrentAccountId(accountId);
        set({ currentAccountId: accountId });
        console.log('[Auth] Switched to account:', accountId);
      },

      setCurrentUser: (user) => {
        set({ currentUser: user });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: mmkvStorage,
      onRehydrateStorage: () => (state) => {
        if (state?.currentAccountId) {
          useAccountStore.getState().setCurrentAccountId(state.currentAccountId);
        }
      },
    }
  )
);
