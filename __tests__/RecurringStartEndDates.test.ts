import { SubscriptionRepository } from '../src/database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../src/database/repositories/RecurringExpenseRepository';
import { RecurringRepository } from '../src/database/repositories/RecurringRepository';
import { ValidationService } from '../src/services/ai/validationService';
import * as dbModule from '../src/database';

jest.mock('../src/database/repositories/CategoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'General', type: 'expense' }),
    findByUser: jest.fn().mockResolvedValue([
      { id: 'cat-1', name: 'General', type: 'expense' },
      { id: 'cat-2', name: 'Subscriptions', type: 'expense' },
    ]),
  })),
}));

jest.mock('../src/database/repositories/WalletRepository', () => ({
  WalletRepository: jest.fn().mockImplementation(() => ({
    findAllByAccount: jest.fn().mockResolvedValue([
      { id: 'main', name: 'Main', type: 'cash' },
    ]),
  })),
}));

describe('Recurring & Subscription Start/End Dates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SubscriptionRepository', () => {
    let repo: SubscriptionRepository;

    beforeEach(() => {
      repo = new SubscriptionRepository();
    });

    it('calculateNextProcessing with future startDate uses startDate as base', () => {
      // Future start date: 2026-11-15
      const futureStart = new Date(2026, 10, 15, 12, 0, 0).getTime();
      const nextDate = repo.calculateNextProcessing(20, futureStart);
      const next = new Date(nextDate);

      expect(next.getDate()).toBe(20);
      expect(next.getMonth()).toBe(10); // Nov 20 >= Nov 15
      expect(next.getFullYear()).toBe(2026);
    });

    it('calculateNextProcessing when billing day in start month has already passed', () => {
      // Future start date: 2026-11-25, billing day is 10
      const futureStart = new Date(2026, 10, 25, 12, 0, 0).getTime();
      const nextDate = repo.calculateNextProcessing(10, futureStart);
      const next = new Date(nextDate);

      expect(next.getDate()).toBe(10);
      expect(next.getMonth()).toBe(11); // Rolled over to December 10
      expect(next.getFullYear()).toBe(2026);
    });

    it('maps start_date and end_date correctly from database row', () => {
      const row = {
        id: 'sub-1',
        account_id: 'acc-1',
        name: 'Netflix',
        amount: 15.99,
        category_id: 'cat-1',
        billing_day: 15,
        vault_type: 'main',
        is_active: 1,
        created_at: 1000,
        updated_at: 1000,
        next_processing: 2000,
        last_processed: null,
        start_date: 1500,
        end_date: 5000,
      };

      const mapped = repo['mapRow'](row);
      expect(mapped.startDate).toBe(1500);
      expect(mapped.endDate).toBe(5000);
      expect(mapped.isActive).toBe(true);
    });

    it('handles null start_date and end_date in mapRow', () => {
      const row = {
        id: 'sub-2',
        account_id: 'acc-1',
        name: 'Spotify',
        amount: 9.99,
        category_id: 'cat-1',
        billing_day: 1,
        vault_type: 'main',
        is_active: 1,
        created_at: 1000,
        updated_at: 1000,
        next_processing: 2000,
        last_processed: null,
        start_date: null,
        end_date: null,
      };

      const mapped = repo['mapRow'](row);
      expect(mapped.startDate).toBeNull();
      expect(mapped.endDate).toBeNull();
    });

    it('findDueSubscriptions queries with start_date and end_date filters', async () => {
      let capturedSql = '';
      let capturedParams: any[] = [];

      jest.spyOn(dbModule, 'executeSql').mockImplementation(async (sql: string, params: any[] = []) => {
        capturedSql = sql;
        capturedParams = params;
        return [];
      });

      await repo.findDueSubscriptions();

      expect(capturedSql).toContain('(start_date IS NULL OR start_date <= ?)');
      expect(capturedSql).toContain('(end_date IS NULL OR end_date >= ?)');
      expect(capturedParams.length).toBe(3);
      expect(typeof capturedParams[0]).toBe('number');
    });
  });

  describe('RecurringExpenseRepository', () => {
    let repo: RecurringExpenseRepository;

    beforeEach(() => {
      repo = new RecurringExpenseRepository();
    });

    it('maps start_date and end_date correctly', () => {
      const row = {
        id: 'rec-1',
        account_id: 'acc-1',
        name: 'Gym',
        amount: 50,
        category_id: 'cat-1',
        frequency: 'monthly',
        interval: 1,
        next_occurrence: 2000,
        vault_type: 'main',
        auto_deduct: 1,
        is_active: 1,
        created_at: 1000,
        updated_at: 1000,
        start_date: 1200,
        end_date: 8000,
      };

      const mapped = repo['mapRow'](row);
      expect(mapped.startDate).toBe(1200);
      expect(mapped.endDate).toBe(8000);
    });

    it('findDue queries with start_date and end_date filters', async () => {
      let capturedSql = '';
      let capturedParams: any[] = [];

      jest.spyOn(dbModule, 'executeSql').mockImplementation(async (sql: string, params: any[] = []) => {
        capturedSql = sql;
        capturedParams = params;
        return [];
      });

      await repo.findDue();

      expect(capturedSql).toContain('(start_date IS NULL OR start_date <= ?)');
      expect(capturedSql).toContain('(end_date IS NULL OR end_date >= ?)');
      expect(capturedParams.length).toBe(3);
      expect(typeof capturedParams[0]).toBe('number');
    });
  });

  describe('RecurringRepository (Unified)', () => {
    let repo: RecurringRepository;

    beforeEach(() => {
      repo = new RecurringRepository();
    });

    it('maps start_date and end_date correctly', () => {
      const row = {
        id: 'uni-1',
        account_id: 'acc-1',
        name: 'Cloud Storage',
        amount: 2.99,
        category_id: 'cat-1',
        category_name: 'Tech',
        frequency: 'monthly',
        interval: 1,
        type: 'subscription',
        vault_type: 'main',
        next_occurrence: 2000,
        start_date: 1000,
        end_date: 5000,
        is_active: 1,
        created_at: 1000,
        updated_at: 1000,
      };

      const mapped = repo['mapRow'](row);
      expect(mapped.startDate).toBe(1000);
      expect(mapped.endDate).toBe(5000);
    });

    it('findAllActive applies end_date filter', async () => {
      let capturedSql = '';
      jest.spyOn(dbModule, 'executeSql').mockImplementation(async (sql: string) => {
        capturedSql = sql;
        return [];
      });

      await repo.findAllActive();

      expect(capturedSql).toContain('(end_date IS NULL OR end_date >= ?)');
    });

    it('findUpcoming applies start_date and end_date filters', async () => {
      let capturedSql = '';
      let capturedParams: any[] = [];
      jest.spyOn(dbModule, 'executeSql').mockImplementation(async (sql: string, params: any[] = []) => {
        capturedSql = sql;
        capturedParams = params;
        return [];
      });

      await repo.findUpcoming(5);

      expect(capturedSql).toContain('(start_date IS NULL OR start_date <= ?)');
      expect(capturedSql).toContain('(end_date IS NULL OR end_date >= ?)');
      expect(capturedParams[2]).toBe(5);
    });
  });

  describe('ValidationService for AI Tools', () => {
    let service: ValidationService;

    beforeEach(() => {
      service = new ValidationService('acc-1', 'user-1');
    });

    it('validates subscription with valid optional start and end dates', async () => {
      const input = {
        name: 'Gym',
        amount: 30,
        categoryName: 'General',
        billingDay: 1,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      };

      const result = await service.validateSubscriptionInput(input);
      expect(result.startDate).not.toBeNull();
      expect(result.endDate).not.toBeNull();
      expect(result.endDate!).toBeGreaterThan(result.startDate!);
    });

    it('throws error when subscription endDate is earlier than startDate', async () => {
      const input = {
        name: 'Gym',
        amount: 30,
        categoryName: 'General',
        billingDay: 1,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      };

      await expect(service.validateSubscriptionInput(input)).rejects.toThrow(
        /End date cannot be earlier than start date/
      );
    });

    it('validates recurring expense without startDate (startDate is optional)', async () => {
      const input = {
        name: 'Weekly Coffee',
        amount: 15,
        categoryName: 'General',
        frequency: 'weekly' as const,
        interval: 1,
      };

      const result = await service.validateRecurringExpenseInput(input);
      expect(result.startDate).toBeNull();
      expect(result.endDate).toBeNull();
      expect(result.nextOccurrence).toBeGreaterThan(0);
    });

    it('validates recurring expense with optional start and end dates', async () => {
      const input = {
        name: 'Car Loan',
        amount: 250,
        categoryName: 'General',
        frequency: 'monthly' as const,
        interval: 1,
        startDate: '2026-03-01',
        endDate: '2028-03-01',
      };

      const result = await service.validateRecurringExpenseInput(input);
      expect(result.startDate).not.toBeNull();
      expect(result.endDate).not.toBeNull();
      expect(result.endDate!).toBeGreaterThan(result.startDate!);
    });

    it('throws error when recurring expense endDate is earlier than startDate', async () => {
      const input = {
        name: 'Car Loan',
        amount: 250,
        categoryName: 'General',
        frequency: 'monthly' as const,
        interval: 1,
        startDate: '2026-05-01',
        endDate: '2026-04-01',
      };

      await expect(service.validateRecurringExpenseInput(input)).rejects.toThrow(
        /End date cannot be earlier than start date/
      );
    });
  });

  describe('DataMutationService', () => {
    let mutationService: any;

    beforeEach(() => {
      const { DataMutationService } = require('../src/services/ai/dataMutationService');
      mutationService = new DataMutationService('acc-1', 'user-1');
    });

    it('creates pending action for createSubscription with startDate and endDate', async () => {
      const action = await mutationService.createSubscriptionAction({
        name: 'Disney+',
        amount: 12.99,
        categoryName: 'General',
        billingDay: 15,
        startDate: '2026-02-01',
        endDate: '2026-12-01',
      });

      expect(action.status).toBe('pending');
      expect(action.resolvedData.startDate).not.toBeNull();
      expect(action.resolvedData.endDate).not.toBeNull();
      expect(action.resolvedData.endDate).toBeGreaterThan(action.resolvedData.startDate);
    });

    it('creates pending action for updateSubscription with start and end dates', async () => {
      jest.spyOn(mutationService.validator, 'validateEntityExists').mockResolvedValue(true);

      const action = await mutationService.updateSubscriptionAction({
        subscriptionId: 'sub-1',
        startDate: '2026-03-01',
        endDate: '2026-09-01',
      });

      expect(action.status).toBe('pending');
      expect(action.resolvedData.startDate).not.toBeNull();
      expect(action.resolvedData.endDate).not.toBeNull();
    });

    it('creates pending action for createRecurringExpense with optional start and end dates', async () => {
      const action = await mutationService.createRecurringExpenseAction({
        name: 'Office Rent',
        amount: 1500,
        categoryName: 'General',
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });

      expect(action.status).toBe('pending');
      expect(action.resolvedData.startDate).not.toBeNull();
      expect(action.resolvedData.endDate).not.toBeNull();
    });

    it('creates pending action for updateRecurringExpense with start and end dates', async () => {
      jest.spyOn(mutationService.validator, 'validateEntityExists').mockResolvedValue(true);

      const action = await mutationService.updateRecurringExpenseAction({
        recurringExpenseId: 'rec-1',
        startDate: '2026-02-01',
        endDate: '2027-02-01',
      });

      expect(action.status).toBe('pending');
      expect(action.resolvedData.startDate).not.toBeNull();
      expect(action.resolvedData.endDate).not.toBeNull();
    });
  });
});
