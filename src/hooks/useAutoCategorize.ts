/**
 * Purpose: React hook for automatic transaction categorization (Laya)
 *
 * Inputs:
 *   - type (CategoryType): income | expense — scopes candidate categories
 *
 * Outputs:
 *   - Returns (suggest, apply helpers, suggestion state, loading/error flags)
 *
 * Side effects:
 *   - Queries CategoryRepository via categorizationService
 *   - Creates categories on demand (LAYA engine, fully offline)
 */

import { useCallback, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import type { Category } from '../types/models';
import type { CategorizationOutcome } from '../types/categorization';
import {
  categorizeTransaction,
  createCategoryByName,
  createProposedCategory,
  isAutoApplicable,
} from '../services/ai/categorizationService';

interface UseAutoCategorizeOptions {
  autoThreshold?: number;
  allowCreateNew?: boolean;
}

export function useAutoCategorize(type: 'income' | 'expense', options: UseAutoCategorizeOptions = {}) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [suggestion, setSuggestion] = useState<CategorizationOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggest = useCallback(
    async (description: string, amount?: number, categories?: Category[]): Promise<CategorizationOutcome | null> => {
      const trimmed = description?.trim();
      if (!trimmed || trimmed.length < 2) {
        setError('Enter a description first');
        return null;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const outcome = await categorizeTransaction(
          { description: trimmed, type, amount },
          {
            autoThreshold: options.autoThreshold,
            allowCreateNew: options.allowCreateNew ?? true,
            categories,
            userId: currentUser?.id,
            signal: controller.signal,
          },
        );
        setSuggestion(outcome);
        return outcome;
      } catch (e: any) {
        if (e?.name === 'AbortError') return null;
        const message = e?.message || 'Failed to suggest a category';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [type, currentUser?.id, options.autoThreshold, options.allowCreateNew],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setSuggestion(null);
    setError(null);
    setLoading(false);
  }, []);

  /**
   * Resolve the suggestion to a concrete Category:
   * - match -> find it in the provided list
   * - create_new -> create it on demand, then return it
   */
  const resolve = useCallback(
    async (outcome: CategorizationOutcome, categories: Category[]): Promise<Category | null> => {
      if (outcome.kind === 'match') {
        return categories.find((c) => c.id === outcome.choice.categoryId) ?? null;
      }
      if (!currentUser) return null;
      const created = await createProposedCategory(currentUser.id, type, outcome.newCategory);
      return created;
    },
    [currentUser, type],
  );

  /**
   * Suggest a category and, when the suggestion doesn't exist yet,
   * create it on demand via LAYA so the caller gets a usable Category.
   * - create_new outcome -> creates the proposed category
   * - match outcome whose category is missing -> creates it by name
   * - match outcome that exists -> returned for one-tap apply (no creation)
   */
  const suggestAndAutoApply = useCallback(
    async (
      description: string,
      amount?: number,
      categories?: Category[],
      onCategoryCreated?: (created: Category) => Promise<void> | void,
    ): Promise<{ outcome: CategorizationOutcome | null; category: Category | null; createdNew: boolean }> => {
      const outcome = await suggest(description, amount, categories);
      if (!outcome) {
        return { outcome: null, category: null, createdNew: false };
      }
      const list = categories ?? [];
      if (outcome.kind === 'create_new') {
        try {
          const created = await resolve(outcome, list);
          if (created) {
            await onCategoryCreated?.(created);
            return { outcome, category: created, createdNew: true };
          }
        } catch (e) {
          // Fall through to manual banner below
        }
        return { outcome, category: null, createdNew: false };
      }
      const matched = list.find((c) => c.id === outcome.choice.categoryId) ?? null;
      if (matched) {
        return { outcome, category: matched, createdNew: false };
      }
      // Suggested category not found — create it on demand
      if (!currentUser) {
        return { outcome, category: null, createdNew: false };
      }
      try {
        const created = await createCategoryByName(currentUser.id, type, outcome.choice.categoryName);
        await onCategoryCreated?.(created);
        return { outcome, category: created, createdNew: true };
      } catch (e) {
        return { outcome, category: null, createdNew: false };
      }
    },
    [suggest, resolve, currentUser, type],
  );

  return {
    suggestion,
    loading,
    error,
    suggest,
    clear,
    resolve,
    suggestAndAutoApply,
    isAuto: suggestion ? isAutoApplicable(suggestion, options.autoThreshold) : false,
    setSuggestion,
  };
}
