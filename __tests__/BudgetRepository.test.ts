import { BudgetRepository } from '../src/database/repositories/BudgetRepository';
import * as dbModule from '../src/database';

jest.mock('../src/database/repositories/CategoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({
    findAll: jest.fn().mockResolvedValue([
      { id: 'cat-dining', name: 'Food & Dining', type: 'expense', color: '#FF6B6B', icon: 'food' },
      { id: 'cat-transport', name: 'Transportation', type: 'expense', color: '#4ECDC4', icon: 'car' },
    ]),
  })),
}));

describe('BudgetRepository & Category Budgets Engine', () => {
  let inMemoryBudgets: Array<any> = [];
  let inMemoryTransactions: Array<any> = [];

  beforeEach(() => {
    inMemoryBudgets = [];
    inMemoryTransactions = [];

    jest.spyOn(dbModule, 'executeSql').mockImplementation(async (sql: string, params: any[] = []) => {
      // Budgets queries
      if (sql.includes('SELECT * FROM budgets WHERE id = ?')) {
        const [id] = params;
        return inMemoryBudgets.filter((b) => b.id === id) as any;
      }
      if (sql.includes('SELECT * FROM budgets WHERE account_id = ? AND category_id = ?')) {
        const [accId, catId] = params;
        return inMemoryBudgets.filter((b) => b.account_id === accId && b.category_id === catId) as any;
      }
      if (sql.includes('SELECT * FROM budgets WHERE account_id = ?')) {
        const [accId] = params;
        return inMemoryBudgets.filter((b) => b.account_id === accId) as any;
      }
      if (sql.includes('INSERT') && sql.includes('budgets')) {
        const [id, account_id, category_id, amount, period, rollover, created_at, updated_at] = params;
        inMemoryBudgets.push({ id, account_id, category_id, amount, period, rollover, created_at, updated_at });
        return [] as any;
      }
      if (sql.includes('DELETE FROM budgets WHERE id = ?')) {
        const [id] = params;
        inMemoryBudgets = inMemoryBudgets.filter((b) => b.id !== id);
        return [] as any;
      }

      // Spending query
      if (sql.includes('COALESCE(SUM(amount), 0)') && sql.includes('transactions')) {
        const [accId, catId, start, end] = params;
        const matching = inMemoryTransactions.filter(
          (t) =>
            t.account_id === accId &&
            t.category_id === catId &&
            t.type === 'expense' &&
            t.date >= start &&
            t.date <= end
        );
        const total = matching.reduce((sum, t) => sum + t.amount, 0);
        return [{ total }] as any;
      }

      return [] as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates and retrieves a category budget', async () => {
    const repo = new BudgetRepository();
    const created = await repo.create({
      accountId: 'acc-1',
      categoryId: 'cat-dining',
      amount: 200,
      period: 'monthly',
      rollover: false,
    });

    expect(created.id).toBeDefined();
    expect(created.amount).toBe(200);

    const found = await repo.findByCategory('acc-1', 'cat-dining');
    expect(found).not.toBeNull();
    expect(found?.amount).toBe(200);
  });

  test('computes status correctly for normal, warning, and exceeded spending', async () => {
    const repo = new BudgetRepository();
    const now = Date.now();

    inMemoryBudgets = [
      {
        id: 'b-1',
        account_id: 'acc-1',
        category_id: 'cat-dining',
        amount: 100,
        period: 'monthly',
        rollover: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'b-2',
        account_id: 'acc-1',
        category_id: 'cat-transport',
        amount: 50,
        period: 'monthly',
        rollover: 0,
        created_at: now,
        updated_at: now,
      },
    ];

    // cat-dining has spent 85 out of 100 (85% -> warning threshold)
    // cat-transport has spent 60 out of 50 (120% -> exceeded threshold)
    inMemoryTransactions = [
      { account_id: 'acc-1', category_id: 'cat-dining', type: 'expense', amount: 85, date: now },
      { account_id: 'acc-1', category_id: 'cat-transport', type: 'expense', amount: 60, date: now },
    ];

    const statuses = await repo.getBudgetStatuses('acc-1', now);

    expect(statuses).toHaveLength(2);

    const transportStatus = statuses.find((s) => s.budget.categoryId === 'cat-transport');
    expect(transportStatus?.isExceeded).toBe(true);
    expect(transportStatus?.percentage).toBe(120);

    const diningStatus = statuses.find((s) => s.budget.categoryId === 'cat-dining');
    expect(diningStatus?.isWarning).toBe(true);
    expect(diningStatus?.isExceeded).toBe(false);
    expect(diningStatus?.remaining).toBe(15);
  });

  test('rollover carries unspent balance from previous month into current month allowance', async () => {
    const repo = new BudgetRepository();
    const now = Date.now();
    const date = new Date(now);
    const prevMonthDate = new Date(date.getFullYear(), date.getMonth() - 1, 15).getTime();

    inMemoryBudgets = [
      {
        id: 'b-rollover',
        account_id: 'acc-1',
        category_id: 'cat-dining',
        amount: 100,
        period: 'monthly',
        rollover: 1, // Rollover enabled
        created_at: now,
        updated_at: now,
      },
    ];

    // Previous month: spent only 60 out of 100 -> 40 unspent rolls over
    // Current month: spent 20
    inMemoryTransactions = [
      { account_id: 'acc-1', category_id: 'cat-dining', type: 'expense', amount: 60, date: prevMonthDate },
      { account_id: 'acc-1', category_id: 'cat-dining', type: 'expense', amount: 20, date: now },
    ];

    const statuses = await repo.getBudgetStatuses('acc-1', now);
    expect(statuses).toHaveLength(1);

    const status = statuses[0];
    // Effective budget should be 100 (base) + 40 (rollover) = 140
    expect(status.budget.amount).toBe(140);
    // Remaining should be 140 - 20 = 120
    expect(status.remaining).toBe(120);
  });
});
