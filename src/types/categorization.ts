/**
 * Purpose: Type definitions for automatic expense/income categorization (Laya)
 *
 * Inputs: None (type definitions only)
 *
 * Outputs:
 *   - Exports categorization request/result types with confidence scores
 *   - Exports on-demand category creation proposal types
 *
 * Side effects: None
 */

import type { Category, CategoryType } from './models';

// ============================================
// Categorization Request
// ============================================

export interface CategorizeRequest {
  description: string;
  type: CategoryType;
  amount?: number;
  merchantHint?: string;
}

// ============================================
// Structured Model Choice
// ============================================

export interface CategoryChoice {
  categoryName: string;
  categoryId: string | null;
  confidence: number;
  reasoning: string;
}

export interface NewCategoryProposal {
  name: string;
  icon: string;
  color: string;
  reasoning: string;
}

export type CategorizationOutcome =
  | {
      kind: 'match';
      choice: CategoryChoice;
      shouldCreateNew: false;
      newCategory: null;
      source: CategorizationSource;
    }
  | {
      kind: 'create_new';
      choice: CategoryChoice;
      shouldCreateNew: true;
      newCategory: NewCategoryProposal;
      source: CategorizationSource;
    };

export type CategorizationSource = 'laya';

// ============================================
// Raw Model Response (structured JSON)
// ============================================

export interface RawCategoryModelResponse {
  categoryName: string | null;
  confidence: number;
  reasoning?: string;
  shouldCreateNew?: boolean;
  suggestedNewCategory?: {
    name?: string;
    icon?: string;
    color?: string;
  };
}

// ============================================
// Service Options
// ============================================

export interface CategorizationOptions {
  autoThreshold?: number;
  suggestThreshold?: number;
  allowCreateNew?: boolean;
  categories?: Category[];
  userId?: string;
  signal?: AbortSignal;
}

export const CATEGORIZATION_DEFAULTS = {
  AUTO_THRESHOLD: 0.8,
  SUGGEST_THRESHOLD: 0.55,
  LOW_CONFIDENCE_NEW_CATEGORY_THRESHOLD: 0.4,
} as const;
