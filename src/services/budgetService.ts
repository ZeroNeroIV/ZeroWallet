// BudgetService — facade combining budgets, categories, and transaction spend for a given month
import { startOfMonth, endOfMonth } from 'date-fns';
import { BudgetRepository } from '../database/repositories/BudgetRepository';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import type { Budget, BudgetProgress, Category } from '../types/models';
import { dateFromMonthKey } from '../utils/budgetUtils';

export class BudgetService {
  private budgetRepo = new BudgetRepository();
  private categoryRepo = new CategoryRepository();
  private transactionRepo = new TransactionRepository();

  constructor(
    private accountId: string,
    private userId: string,
  ) {}

  async loadMonth(month: string): Promise<{ progress: BudgetProgress[]; unbudgeted: Category[] }> {
    const monthDate = dateFromMonthKey(month);
    const start = startOfMonth(monthDate).getTime();
    const end = endOfMonth(monthDate).getTime();

    const [budgets, categories, breakdown] = await Promise.all([
      this.budgetRepo.findByAccountAndMonth(this.accountId, month),
      this.categoryRepo.findByUserAndType(this.userId, 'expense'),
      this.transactionRepo.getCategoryBreakdown(this.accountId, start, end, 'expense'),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const spendMap = new Map(breakdown.map((b) => [b.categoryId, b.totalAmount]));
    const budgetedIds = new Set(budgets.map((b) => b.categoryId));

    const progress: BudgetProgress[] = budgets
      .map((budget) => {
        const category = categoryMap.get(budget.categoryId);
        if (!category) return null;
        const spent = spendMap.get(budget.categoryId) || 0;
        const percentage = budget.amountLimit > 0 ? (spent / budget.amountLimit) * 100 : 0;
        return {
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
          categoryColor: category.color,
          amountLimit: budget.amountLimit,
          spent,
          remaining: budget.amountLimit - spent,
          percentage,
        };
      })
      .filter((p): p is BudgetProgress => p !== null)
      .sort((a, b) => b.percentage - a.percentage);

    const unbudgeted = categories.filter((c) => !budgetedIds.has(c.id));

    return { progress, unbudgeted };
  }

  async setBudget(categoryId: string, month: string, amountLimit: number): Promise<Budget> {
    return this.budgetRepo.upsert(this.accountId, categoryId, month, amountLimit);
  }

  async removeBudget(categoryId: string, month: string): Promise<void> {
    await this.budgetRepo.deleteForCategoryMonth(this.accountId, categoryId, month);
  }
}
