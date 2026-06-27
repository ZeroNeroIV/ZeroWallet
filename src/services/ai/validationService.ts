/**
 * Purpose: Validate and sanitize AI function inputs before creating pending actions
 *
 * Inputs:
 *   - accountId (string): Current user's account ID for data scope
 *
 * Outputs:
 *   - Returns (ValidationService): Service instance with validation methods
 *
 * Side effects:
 *   - Queries database to resolve category names and validate entity existence
 *   - Throws AIOperationError on validation failures
 */

import * as v from '../../utils/validation/primitives';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { GoalRepository } from '../../database/repositories/GoalRepository';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import {
  AIOperationError,
  AIOperationErrorType,
  type CreateTransactionParams,
  type CreateGoalParams,
  type CreateDebtParams,
  type CreateSubscriptionParams,
  type CreateRecurringExpenseParams,
  type CreateCategoryParams,
  type ValidatedTransactionInput,
  type ValidatedGoalInput,
  type ValidatedDebtInput,
  type ValidatedSubscriptionInput,
  type ValidatedRecurringExpenseInput,
  type ValidatedCategoryInput,
  type EntityType,
  DEFAULT_VAULT_TYPE,
  DEFAULT_FUNDING_SOURCE,
  DEFAULT_ICON,
  DEFAULT_COLOR,
} from '../../types/aiMutations';

export class ValidationService {
  private accountId: string;
  private categoryRepo: CategoryRepository;
  private transactionRepo: TransactionRepository;
  private goalRepo: GoalRepository;
  private debtRepo: DebtRepository;
  private subscriptionRepo: SubscriptionRepository;
  private recurringRepo: RecurringExpenseRepository;

  constructor(accountId: string) {
    this.accountId = accountId;
    this.categoryRepo = new CategoryRepository();
    this.transactionRepo = new TransactionRepository();
    this.goalRepo = new GoalRepository();
    this.debtRepo = new DebtRepository();
    this.subscriptionRepo = new SubscriptionRepository();
    this.recurringRepo = new RecurringExpenseRepository();
  }

  // ============================================================================
  // Generic Validation Methods (backed by shared primitives)
  // ============================================================================

  private throwValidationError(fieldName: string, message: string): never {
    throw new AIOperationError(
      AIOperationErrorType.VALIDATION_ERROR, message,
      `Please check the ${fieldName} field.`,
    );
  }

  validateRequired(value: any, fieldName: string): void {
    const r = v.validateRequired(value, fieldName);
    if (!r.valid) this.throwValidationError(fieldName, r.message!);
  }

  validatePositiveNumber(value: number, fieldName: string): void {
    const r = v.validatePositiveNumber(value, fieldName);
    if (!r.valid) this.throwValidationError(fieldName, r.message!);
  }

  validateNonNegativeNumber(value: number, fieldName: string): void {
    const r = v.validateNonNegativeNumber(value, fieldName);
    if (!r.valid) this.throwValidationError(fieldName, r.message!);
  }

  validateDateString(value: string, fieldName: string): number {
    const ts = v.parseDateString(value);
    if (ts === null) this.throwValidationError(fieldName, `${fieldName} is not a valid date`);
    return ts!;
  }

  validateEnum<T>(value: any, validValues: readonly T[], fieldName: string): T {
    if (!v.isInEnum(value, validValues)) {
      this.throwValidationError(fieldName, `${fieldName} must be one of: ${validValues.join(', ')}`);
    }
    return value as T;
  }

  validateStringLength(value: string, fieldName: string, min: number, max: number): void {
    if (!v.isStringLengthBetween(value, min, max)) {
      this.throwValidationError(fieldName, `${fieldName} must be between ${min} and ${max} characters`);
    }
  }

  validateBillingDay(day: number): void {
    if (!v.isBillingDay(day)) {
      this.throwValidationError('Billing day', `Billing day must be between 1 and 31. You provided: ${day}`);
    }
  }

  validateInterval(interval: number): void {
    if (!v.isInteger(interval) || interval < 1) {
      this.throwValidationError('Interval', 'Interval must be a positive integer');
    }
  }

  // ============================================================================
  // Category Resolution
  // ============================================================================

  async resolveCategoryName(
    name: string,
    type: 'income' | 'expense'
  ): Promise<{ id: string; name: string }> {
    try {
      // Get user's categories (includes default categories)
      const categories = await this.categoryRepo.findByUser(
        this.accountId.split('-')[0]
      ); // Assuming userId is part of accountId

      // Filter by type
      const matchingCategories = categories.filter(
        (cat) => cat.type === type && cat.name.toLowerCase().includes(name.toLowerCase())
      );

      if (matchingCategories.length === 0) {
        // Get all available categories of this type for suggestion
        const availableCategories = categories
          .filter((cat) => cat.type === type)
          .map((cat) => cat.name);

        throw new AIOperationError(
          AIOperationErrorType.CATEGORY_RESOLUTION_FAILED,
          `Category "${name}" not found`,
          `I couldn't find a ${type} category matching "${name}". Available categories: ${availableCategories.join(', ')}`
        );
      }

      // Find exact match first
      const exactMatch = matchingCategories.find(
        (cat) => cat.name.toLowerCase() === name.toLowerCase()
      );

      if (exactMatch) {
        return { id: exactMatch.id, name: exactMatch.name };
      }

      // Return closest match
      return {
        id: matchingCategories[0].id,
        name: matchingCategories[0].name,
      };
    } catch (error) {
      if (error instanceof AIOperationError) {
        throw error;
      }
      throw new AIOperationError(
        AIOperationErrorType.DATABASE_ERROR,
        'Failed to resolve category',
        'Failed to find the category. Please try again.'
      );
    }
  }

  // ============================================================================
  // Entity Existence Validation
  // ============================================================================

  async validateEntityExists(
    entityType: EntityType,
    entityId: string
  ): Promise<boolean> {
    try {
      let exists = false;

      switch (entityType) {
        case 'transaction':
          const transaction = await this.transactionRepo.findById(entityId);
          exists = transaction !== null && transaction.accountId === this.accountId;
          break;
        case 'goal':
          const goal = await this.goalRepo.findById(entityId);
          exists = goal !== null && goal.accountId === this.accountId;
          break;
        case 'debt':
          const debt = await this.debtRepo.findById(entityId);
          exists = debt !== null && debt.accountId === this.accountId;
          break;
        case 'subscription':
          const subscription = await this.subscriptionRepo.findById(entityId);
          exists = subscription !== null && subscription.accountId === this.accountId;
          break;
        case 'recurringExpense':
          const recurring = await this.recurringRepo.findById(entityId);
          exists = recurring !== null && recurring.accountId === this.accountId;
          break;
        case 'category':
          const category = await this.categoryRepo.findById(entityId);
          exists = category !== null;
          break;
      }

      if (!exists) {
        throw new AIOperationError(
          AIOperationErrorType.ENTITY_NOT_FOUND,
          `${entityType} with ID ${entityId} not found`,
          `I couldn't find that ${entityType}. It may have been deleted.`
        );
      }

      return true;
    } catch (error) {
      if (error instanceof AIOperationError) {
        throw error;
      }
      throw new AIOperationError(
        AIOperationErrorType.DATABASE_ERROR,
        'Failed to validate entity existence',
        'Failed to verify the item exists. Please try again.'
      );
    }
  }

  // ============================================================================
  // Transaction Validation
  // ============================================================================

  async validateTransactionInput(
    params: CreateTransactionParams
  ): Promise<ValidatedTransactionInput> {
    // Validate required fields
    this.validateRequired(params.type, 'Transaction type');
    this.validateRequired(params.amount, 'Amount');
    this.validateRequired(params.categoryName, 'Category');

    // Validate amount
    this.validatePositiveNumber(params.amount, 'Amount');

    // Validate type
    const type = this.validateEnum(
      params.type,
      ['income', 'expense'] as const,
      'Transaction type'
    );

    // Resolve category
    const category = await this.resolveCategoryName(params.categoryName, type);

    // Validate date (default to today if not provided)
    const date = params.date
      ? this.validateDateString(params.date, 'Date')
      : Date.now();

    // Validate vault type
    const vaultType = params.vaultType
      ? this.validateEnum(
          params.vaultType,
          ['main', 'savings', 'held'] as const,
          'Vault type'
        )
      : DEFAULT_VAULT_TYPE;

    return {
      type,
      amount: params.amount,
      categoryId: category.id,
      categoryName: category.name,
      description: params.description || '',
      date,
      vaultType,
    };
  }

  // ============================================================================
  // Goal Validation
  // ============================================================================

  async validateGoalInput(
    params: CreateGoalParams
  ): Promise<ValidatedGoalInput> {
    // Validate required fields
    this.validateRequired(params.name, 'Goal name');
    this.validateRequired(params.targetAmount, 'Target amount');

    // Validate name length
    this.validateStringLength(params.name, 'Goal name', 1, 100);

    // Validate amount
    this.validatePositiveNumber(params.targetAmount, 'Target amount');

    // Validate funding source
    const fundingSource = params.fundingSource
      ? this.validateEnum(
          params.fundingSource,
          ['main', 'savings', 'both'] as const,
          'Funding source'
        )
      : DEFAULT_FUNDING_SOURCE;

    return {
      name: params.name.trim(),
      targetAmount: params.targetAmount,
      fundingSource,
      icon: params.icon || DEFAULT_ICON,
      color: params.color || DEFAULT_COLOR,
    };
  }

  // ============================================================================
  // Debt Validation
  // ============================================================================

  async validateDebtInput(params: CreateDebtParams): Promise<ValidatedDebtInput> {
    // Validate required fields
    this.validateRequired(params.type, 'Debt type');
    this.validateRequired(params.personName, 'Person name');
    this.validateRequired(params.amount, 'Amount');

    // Validate type
    const type = this.validateEnum(
      params.type,
      ['lent', 'borrowed'] as const,
      'Debt type'
    );

    // Validate name length
    this.validateStringLength(params.personName, 'Person name', 1, 100);

    // Validate amount
    this.validatePositiveNumber(params.amount, 'Amount');

    // Validate due date (optional)
    const dueDate = params.dueDate
      ? this.validateDateString(params.dueDate, 'Due date')
      : null;

    return {
      type,
      personName: params.personName.trim(),
      amount: params.amount,
      dueDate,
      description: params.description || '',
    };
  }

  // ============================================================================
  // Subscription Validation
  // ============================================================================

  async validateSubscriptionInput(
    params: CreateSubscriptionParams
  ): Promise<ValidatedSubscriptionInput> {
    // Validate required fields
    this.validateRequired(params.name, 'Subscription name');
    this.validateRequired(params.amount, 'Amount');
    this.validateRequired(params.categoryName, 'Category');
    this.validateRequired(params.billingDay, 'Billing day');

    // Validate name length
    this.validateStringLength(params.name, 'Subscription name', 1, 100);

    // Validate amount
    this.validatePositiveNumber(params.amount, 'Amount');

    // Validate billing day
    this.validateBillingDay(params.billingDay);

    // Resolve category (subscriptions are always expenses)
    const category = await this.resolveCategoryName(params.categoryName, 'expense');

    // Validate vault type
    const vaultType = params.vaultType
      ? this.validateEnum(
          params.vaultType,
          ['main', 'savings', 'held'] as const,
          'Vault type'
        )
      : DEFAULT_VAULT_TYPE;

    return {
      name: params.name.trim(),
      amount: params.amount,
      categoryId: category.id,
      categoryName: category.name,
      billingDay: params.billingDay,
      vaultType,
    };
  }

  // ============================================================================
  // Recurring Expense Validation
  // ============================================================================

  async validateRecurringExpenseInput(
    params: CreateRecurringExpenseParams
  ): Promise<ValidatedRecurringExpenseInput> {
    // Validate required fields
    this.validateRequired(params.name, 'Expense name');
    this.validateRequired(params.amount, 'Amount');
    this.validateRequired(params.categoryName, 'Category');
    this.validateRequired(params.frequency, 'Frequency');
    this.validateRequired(params.interval, 'Interval');
    this.validateRequired(params.startDate, 'Start date');

    // Validate name length
    this.validateStringLength(params.name, 'Expense name', 1, 100);

    // Validate amount
    this.validatePositiveNumber(params.amount, 'Amount');

    // Validate frequency
    const frequency = this.validateEnum(
      params.frequency,
      ['daily', 'weekly', 'monthly', 'yearly'] as const,
      'Frequency'
    );

    // Validate interval
    this.validateInterval(params.interval);

    // Validate start date
    const nextOccurrence = this.validateDateString(params.startDate, 'Start date');

    // Resolve category (recurring expenses are always expenses)
    const category = await this.resolveCategoryName(params.categoryName, 'expense');

    // Validate vault type
    const vaultType = params.vaultType
      ? this.validateEnum(
          params.vaultType,
          ['main', 'savings', 'held'] as const,
          'Vault type'
        )
      : DEFAULT_VAULT_TYPE;

    return {
      name: params.name.trim(),
      amount: params.amount,
      categoryId: category.id,
      categoryName: category.name,
      frequency,
      interval: params.interval,
      nextOccurrence,
      vaultType,
      autoDeduct: params.autoDeduct ?? false,
    };
  }

  // ============================================================================
  // Category Validation
  // ============================================================================

  async validateCategoryInput(
    params: CreateCategoryParams
  ): Promise<ValidatedCategoryInput> {
    // Validate required fields
    this.validateRequired(params.name, 'Category name');
    this.validateRequired(params.type, 'Category type');

    // Validate name length
    this.validateStringLength(params.name, 'Category name', 1, 50);

    // Validate type
    const type = this.validateEnum(
      params.type,
      ['income', 'expense'] as const,
      'Category type'
    );

    // Check for duplicate category name
    const categories = await this.categoryRepo.findByUser(
      this.accountId.split('-')[0]
    );
    const duplicate = categories.find(
      (cat) =>
        cat.type === type &&
        cat.name.toLowerCase() === params.name.trim().toLowerCase()
    );

    if (duplicate) {
      throw new AIOperationError(
        AIOperationErrorType.DUPLICATE_ENTITY,
        `Category "${params.name}" already exists`,
        `A ${type} category named "${params.name}" already exists.`
      );
    }

    return {
      name: params.name.trim(),
      type,
      icon: params.icon || DEFAULT_ICON,
      color: params.color || DEFAULT_COLOR,
    };
  }

  // ============================================================================
  // Category Deletion Validation
  // ============================================================================

  async validateCategoryDeletion(categoryId: string): Promise<void> {
    // Check if category exists
    await this.validateEntityExists('category', categoryId);

    // Get category
    const category = await this.categoryRepo.findById(categoryId);

    if (!category) {
      throw new AIOperationError(
        AIOperationErrorType.ENTITY_NOT_FOUND,
        'Category not found',
        'Category not found.'
      );
    }

    // Prevent deletion of default categories
    if (category.isDefault) {
      throw new AIOperationError(
        AIOperationErrorType.PERMISSION_DENIED,
        'Cannot delete default category',
        `Cannot delete the default category "${category.name}". Only custom categories can be deleted.`
      );
    }

    // Check if category is in use by transactions
    const transactions = await this.transactionRepo.findByAccount(this.accountId);
    const hasTransactions = transactions.some((t) => t.categoryId === categoryId);

    if (hasTransactions) {
      throw new AIOperationError(
        AIOperationErrorType.REFERENCE_CONSTRAINT,
        'Category is in use',
        `Cannot delete "${category.name}" because it has transactions. Please reassign those transactions first.`
      );
    }
  }
}
