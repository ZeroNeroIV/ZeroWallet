/**
 * Purpose: Unified service for managing Categories and their Budget Targets.
 * 
 * Follows Simplizum principles:
 * - Single source of truth across SQLite repositories
 * - Mathematical accuracy for budget burn, rollovers, and remaining limits
 * - Pure functions and decoupled business logic
 */

import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { BudgetRepository } from '../database/repositories/BudgetRepository';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { AccountRepository } from '../database/repositories/AccountRepository';
import type { Category, CategoryType, Budget } from '../types/models';

export interface CategoryWithBudget {
  category: Category;
  spendingThisMonth: number;
  transactionCount: number;
  budget?: Budget;
  percentage: number;
  remaining: number;
  isWarning: boolean;
  isExceeded: boolean;
}

export interface BudgetSummary {
  totalBudgeted: number;
  totalSpentOnBudgeted: number;
  totalSpentAllExpenses: number;
  totalRemaining: number;
  overallPercentage: number;
  budgetedCategoriesCount: number;
  warningCategoriesCount: number;
  exceededCategoriesCount: number;
  totalIncomeThisMonth: number;
  incomeCategoriesCount: number;
  currency: string;
}

export interface CategoryBudgetSaveInput {
  id?: string;
  userId: string;
  accountId: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  budgetAmount?: number | null;
  rollover?: boolean;
}

export class CategoryBudgetService {
  private categoryRepo = new CategoryRepository();
  private budgetRepo = new BudgetRepository();
  private txRepo = new TransactionRepository();
  private accountRepo = new AccountRepository();

  /**
   * Fetches all categories for the user with their current month's spending and budget status
   */
  async getCategoryBudgetData(
    userId: string,
    accountId: string,
    targetDate: Date = new Date()
  ): Promise<{
    expenses: CategoryWithBudget[];
    income: CategoryWithBudget[];
    summary: BudgetSummary;
  }> {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const startDate = new Date(year, month, 1, 0, 0, 0, 0).getTime();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    // 1. Fetch categories
    const allCategories = await this.categoryRepo.findByUser(userId);

    // 2. Fetch budgets for this account
    const budgets = accountId ? await this.budgetRepo.findByAccount(accountId) : [];
    const budgetMap = new Map<string, Budget>();
    for (const b of budgets) {
      budgetMap.set(b.categoryId, b);
    }

    // 3. Fetch category breakdown for expenses and income in this month
    const expenseBreakdown = accountId
      ? await this.txRepo.getCategoryBreakdown(accountId, startDate, endDate, 'expense')
      : [];
    const incomeBreakdown = accountId
      ? await this.txRepo.getCategoryBreakdown(accountId, startDate, endDate, 'income')
      : [];

    const expenseMap = new Map<string, { totalAmount: number; transactionCount: number }>();
    for (const item of expenseBreakdown) {
      expenseMap.set(item.categoryId, {
        totalAmount: Number(item.totalAmount) || 0,
        transactionCount: Number(item.transactionCount) || 0,
      });
    }

    const incomeMap = new Map<string, { totalAmount: number; transactionCount: number }>();
    for (const item of incomeBreakdown) {
      incomeMap.set(item.categoryId, {
        totalAmount: Number(item.totalAmount) || 0,
        transactionCount: Number(item.transactionCount) || 0,
      });
    }

    // 4. Fetch account currency
    const account = accountId ? await this.accountRepo.findById(accountId) : null;
    const currency = account?.currency || 'USD';

    // 5. Build CategoryWithBudget lists
    const expenses: CategoryWithBudget[] = [];
    const income: CategoryWithBudget[] = [];

    let totalBudgeted = 0;
    let totalSpentOnBudgeted = 0;
    let totalSpentAllExpenses = 0;
    let budgetedCategoriesCount = 0;
    let warningCategoriesCount = 0;
    let exceededCategoriesCount = 0;
    let totalIncomeThisMonth = 0;

    for (const cat of allCategories) {
      if (cat.type === 'expense') {
        const stats = expenseMap.get(cat.id);
        const spent = stats?.totalAmount || 0;
        const txCount = stats?.transactionCount || 0;
        totalSpentAllExpenses += spent;

        const budget = budgetMap.get(cat.id);
        let percentage = 0;
        let remaining = 0;
        let isWarning = false;
        let isExceeded = false;

        if (budget && budget.amount > 0) {
          totalBudgeted += budget.amount;
          totalSpentOnBudgeted += spent;
          budgetedCategoriesCount++;

          percentage = (spent / budget.amount) * 100;
          remaining = Math.max(0, budget.amount - spent);
          isWarning = percentage >= 80 && percentage < 100;
          isExceeded = percentage >= 100;

          if (isWarning) warningCategoriesCount++;
          if (isExceeded) exceededCategoriesCount++;
        }

        expenses.push({
          category: cat,
          spendingThisMonth: spent,
          transactionCount: txCount,
          budget,
          percentage,
          remaining,
          isWarning,
          isExceeded,
        });
      } else {
        const stats = incomeMap.get(cat.id);
        const received = stats?.totalAmount || 0;
        const txCount = stats?.transactionCount || 0;
        totalIncomeThisMonth += received;

        income.push({
          category: cat,
          spendingThisMonth: received,
          transactionCount: txCount,
          percentage: 0,
          remaining: 0,
          isWarning: false,
          isExceeded: false,
        });
      }
    }

    // Sort expenses: categories with active budgets first (highest percentage spent to lowest), then unbudgeted by spending
    expenses.sort((a, b) => {
      if (a.budget && !b.budget) return -1;
      if (!a.budget && b.budget) return 1;
      if (a.budget && b.budget) {
        return b.percentage - a.percentage;
      }
      return b.spendingThisMonth - a.spendingThisMonth;
    });

    // Sort income: highest income received first
    income.sort((a, b) => b.spendingThisMonth - a.spendingThisMonth);

    const totalRemaining = Math.max(0, totalBudgeted - totalSpentOnBudgeted);
    const overallPercentage =
      totalBudgeted > 0 ? (totalSpentOnBudgeted / totalBudgeted) * 100 : 0;

    const summary: BudgetSummary = {
      totalBudgeted,
      totalSpentOnBudgeted,
      totalSpentAllExpenses,
      totalRemaining,
      overallPercentage,
      budgetedCategoriesCount,
      warningCategoriesCount,
      exceededCategoriesCount,
      totalIncomeThisMonth,
      incomeCategoriesCount: income.length,
      currency,
    };

    return {
      expenses,
      income,
      summary,
    };
  }

  /**
   * Creates or updates a category and its optional budget target
   */
  async saveCategoryAndBudget(
    input: CategoryBudgetSaveInput
  ): Promise<{ category: Category; budget?: Budget }> {
    let savedCategory: Category;

    if (input.id) {
      // Update existing category
      await this.categoryRepo.update(input.id, {
        name: input.name.trim(),
        icon: input.icon,
        color: input.color,
      });
      const cat = await this.categoryRepo.findById(input.id);
      if (!cat) throw new Error('Category not found after update');
      savedCategory = cat;
    } else {
      // Create new category
      savedCategory = await this.categoryRepo.create({
        userId: input.userId,
        name: input.name.trim(),
        type: input.type,
        icon: input.icon,
        color: input.color,
        isDefault: false,
      });
    }

    // Handle Budget Target (only for expense categories)
    let savedBudget: Budget | undefined;
    if (input.type === 'expense' && input.accountId) {
      if (input.budgetAmount !== undefined && input.budgetAmount !== null && input.budgetAmount > 0) {
        savedBudget = await this.budgetRepo.upsertBudget(
          input.accountId,
          savedCategory.id,
          input.budgetAmount,
          input.rollover ?? false,
          'monthly'
        );
      } else if (input.budgetAmount === null || input.budgetAmount === 0) {
        // Budget explicitly cleared
        await this.budgetRepo.deleteByCategory(input.accountId, savedCategory.id);
      }
    }

    return {
      category: savedCategory,
      budget: savedBudget,
    };
  }

  /**
   * Deletes a category and its associated budget
   */
  async deleteCategory(categoryId: string, accountId?: string): Promise<void> {
    if (accountId) {
      await this.budgetRepo.deleteByCategory(accountId, categoryId);
    }
    await this.categoryRepo.delete(categoryId);
  }

  /**
   * Deletes a budget target for a category
   */
  async removeBudget(accountId: string, categoryId: string): Promise<void> {
    await this.budgetRepo.deleteByCategory(accountId, categoryId);
  }
}
