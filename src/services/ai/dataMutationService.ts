import { v4 as uuidv4 } from 'uuid';
import { ValidationService } from './validationService';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { GoalRepository } from '../../database/repositories/GoalRepository';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { calculateVaultBalances } from '../../utils/balanceCalculator';
import { useAccountStore } from '../../store/accountStore';
import { logger } from '../../utils/logger';
import {
  AIOperationError,
  AIOperationErrorType,
  type PendingAction,
  type ActionResult,
  type MutationType,
  type EntityType,
  type CreateTransactionParams,
  type UpdateTransactionParams,
  type DeleteTransactionParams,
  type CreateGoalParams,
  type UpdateGoalParams,
  type UpdateGoalProgressParams,
  type CompleteGoalParams,
  type DeleteGoalParams,
  type CreateDebtParams,
  type UpdateDebtParams,
  type RecordDebtPaymentParams,
  type MarkDebtAsPaidParams,
  type DeleteDebtParams,
  type CreateSubscriptionParams,
  type UpdateSubscriptionParams,
  type ToggleSubscriptionParams,
  type DeleteSubscriptionParams,
  type CreateRecurringExpenseParams,
  type UpdateRecurringExpenseParams,
  type DeleteRecurringExpenseParams,
  type CreateCategoryParams,
  type UpdateCategoryParams,
  type DeleteCategoryParams,
  PENDING_ACTION_TTL_MS,
  WRITE_FUNCTION_NAMES,
} from '../../types/aiMutations';

export class DataMutationService {
  private accountId: string;
  private userId: string;
  private validator: ValidationService;
  private pendingActions: Map<string, PendingAction>;

  private transactionRepo: TransactionRepository;
  private goalRepo: GoalRepository;
  private debtRepo: DebtRepository;
  private subscriptionRepo: SubscriptionRepository;
  private recurringRepo: RecurringExpenseRepository;
  private categoryRepo: CategoryRepository;
  private executeHandlers: Map<string, (data: Record<string, any>) => Promise<string | undefined>>;

  constructor(accountId: string, userId: string) {
    this.accountId = accountId;
    this.userId = userId;
    this.validator = new ValidationService(accountId, userId);
    this.pendingActions = new Map();

    this.transactionRepo = new TransactionRepository();
    this.goalRepo = new GoalRepository();
    this.debtRepo = new DebtRepository();
    this.subscriptionRepo = new SubscriptionRepository();
    this.recurringRepo = new RecurringExpenseRepository();
    this.categoryRepo = new CategoryRepository();
    this.executeHandlers = new Map([
      [WRITE_FUNCTION_NAMES.CREATE_TRANSACTION, (d) => this.executeCreateTransaction(d).then((id) => id)],
      [WRITE_FUNCTION_NAMES.UPDATE_TRANSACTION, async (d) => { await this.executeUpdateTransaction(d); return d.transactionId; }],
      [WRITE_FUNCTION_NAMES.DELETE_TRANSACTION, (d) => this.transactionRepo.delete(d.transactionId).then(() => undefined)],
      [WRITE_FUNCTION_NAMES.CREATE_GOAL, (d) => this.executeCreateGoal(d).then((id) => id)],
      [WRITE_FUNCTION_NAMES.UPDATE_GOAL, async (d) => { await this.goalRepo.update(d.goalId, d); return d.goalId; }],
      [WRITE_FUNCTION_NAMES.UPDATE_GOAL_PROGRESS, async (d) => { await this.goalRepo.updateProgress(d.goalId, d.currentAmount); return d.goalId; }],
      [WRITE_FUNCTION_NAMES.COMPLETE_GOAL, async (d) => { await this.goalRepo.markCompleted(d.goalId); return d.goalId; }],
      [WRITE_FUNCTION_NAMES.DELETE_GOAL, (d) => this.goalRepo.delete(d.goalId).then(() => undefined)],
      [WRITE_FUNCTION_NAMES.CREATE_DEBT, (d) => this.executeCreateDebt(d).then((id) => id)],
      [WRITE_FUNCTION_NAMES.UPDATE_DEBT, async (d) => { await this.debtRepo.update(d.debtId, d); return d.debtId; }],
      [WRITE_FUNCTION_NAMES.RECORD_DEBT_PAYMENT, async (d) => { await this.debtRepo.recordPayment(d.debtId, d.paymentAmount); return d.debtId; }],
      [WRITE_FUNCTION_NAMES.MARK_DEBT_AS_PAID, async (d) => { await this.debtRepo.markAsPaid(d.debtId); return d.debtId; }],
      [WRITE_FUNCTION_NAMES.DELETE_DEBT, (d) => this.debtRepo.delete(d.debtId).then(() => undefined)],
      [WRITE_FUNCTION_NAMES.CREATE_SUBSCRIPTION, (d) => this.executeCreateSubscription(d).then((id) => id)],
      [WRITE_FUNCTION_NAMES.UPDATE_SUBSCRIPTION, async (d) => { await this.subscriptionRepo.update(d.subscriptionId, d); return d.subscriptionId; }],
      [WRITE_FUNCTION_NAMES.TOGGLE_SUBSCRIPTION, async (d) => { await this.subscriptionRepo.update(d.subscriptionId, { isActive: d.isActive }); return d.subscriptionId; }],
      [WRITE_FUNCTION_NAMES.DELETE_SUBSCRIPTION, (d) => this.subscriptionRepo.delete(d.subscriptionId).then(() => undefined)],
      [WRITE_FUNCTION_NAMES.CREATE_RECURRING_EXPENSE, (d) => this.executeCreateRecurringExpense(d).then((id) => id)],
      [WRITE_FUNCTION_NAMES.UPDATE_RECURRING_EXPENSE, async (d) => { await this.recurringRepo.update(d.recurringExpenseId, d); return d.recurringExpenseId; }],
      [WRITE_FUNCTION_NAMES.DELETE_RECURRING_EXPENSE, (d) => this.recurringRepo.delete(d.recurringExpenseId).then(() => undefined)],
      [WRITE_FUNCTION_NAMES.CREATE_CATEGORY, (d) => this.executeCreateCategory(d).then((id) => id)],
      [WRITE_FUNCTION_NAMES.UPDATE_CATEGORY, async (d) => { await this.categoryRepo.update(d.categoryId, d); return d.categoryId; }],
      [WRITE_FUNCTION_NAMES.DELETE_CATEGORY, (d) => this.categoryRepo.delete(d.categoryId).then(() => undefined)],
    ]);
  }

  // ============================================================================
  // Pending Action Management
  // ============================================================================

  createPendingAction(
    functionName: string,
    type: MutationType,
    entityType: EntityType,
    parameters: Record<string, any>,
    resolvedData: Record<string, any>,
    summary: string
  ): PendingAction {
    const actionId = uuidv4() as string;
    const now = Date.now();

    const action: PendingAction = {
      id: actionId,
      type,
      entityType,
      functionName,
      parameters,
      resolvedData,
      summary,
      createdAt: now,
      expiresAt: now + PENDING_ACTION_TTL_MS,
      status: 'pending',
    };

    this.pendingActions.set(actionId, action);

    setTimeout(() => {
      this.expireAction(actionId);
    }, PENDING_ACTION_TTL_MS);

    return action;
  }

  getPendingAction(actionId: string): PendingAction | undefined {
    return this.pendingActions.get(actionId);
  }

  cancelAction(actionId: string): void {
    const action = this.pendingActions.get(actionId);
    if (action) {
      action.status = 'cancelled';
      this.pendingActions.set(actionId, action);
    }
  }

  private expireAction(actionId: string): void {
    const action = this.pendingActions.get(actionId);
    if (action && action.status === 'pending') {
      action.status = 'expired';
      this.pendingActions.set(actionId, action);
    }
  }

  // ============================================================================
  // Generic Action Builders
  // ============================================================================

  private async createAction<T, V>(
    params: T,
    entityType: EntityType,
    funcName: string,
    validate: (p: T) => Promise<V>,
    buildSummary: (v: V) => string,
  ): Promise<PendingAction> {
    try {
      const validated = await validate(params);
      return this.createPendingAction(funcName, 'create', entityType, params, validated as any, buildSummary(validated));
    } catch (error) {
      throw this.handleError(error, `create ${entityType}`);
    }
  }

  private async deleteAction<T extends { reason?: string }>(
    params: T,
    entityType: EntityType,
    funcName: string,
    entityId: string,
    resolveData: (p: T) => Record<string, any>,
  ): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists(entityType, entityId);
      const summary = `Delete ${entityType}${params.reason ? ` (${params.reason})` : ''}`;
      return this.createPendingAction(funcName, 'delete', entityType, params, resolveData(params), summary);
    } catch (error) {
      throw this.handleError(error, `delete ${entityType}`);
    }
  }

  private async simpleUpdateAction<T>(
    params: T,
    entityType: EntityType,
    funcName: string,
    entityId: string,
    buildSummary: () => string,
  ): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists(entityType, entityId);
      return this.createPendingAction(funcName, 'update', entityType, params, params as any, buildSummary());
    } catch (error) {
      throw this.handleError(error, `update ${entityType}`);
    }
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  async createTransactionAction(params: CreateTransactionParams): Promise<PendingAction> {
    return this.createAction(params, 'transaction', WRITE_FUNCTION_NAMES.CREATE_TRANSACTION,
      (p) => this.validator.validateTransactionInput(p),
      (v) => `Add ${v.amount.toFixed(2)} ${v.type} to ${v.categoryName}${params.description ? ` (${params.description})` : ''}`,
    );
  }

  async updateTransactionAction(params: UpdateTransactionParams): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists('transaction', params.transactionId);

      const transaction = await this.transactionRepo.findById(params.transactionId);
      if (!transaction) {
        throw new AIOperationError(AIOperationErrorType.ENTITY_NOT_FOUND, 'Transaction not found', 'Transaction not found.');
      }

      const resolvedData: Record<string, any> = { transactionId: params.transactionId };
      const updates: string[] = [];

      if (params.categoryName) {
        const category = await this.validator.resolveCategoryName(params.categoryName, transaction.type);
        resolvedData.categoryId = category.id;
        resolvedData.categoryName = category.name;
      }

      if (params.amount !== undefined) {
        this.validator.validatePositiveNumber(params.amount, 'Amount');
        resolvedData.amount = params.amount;
        updates.push(`amount: ${params.amount.toFixed(2)}`);
      }

      if (params.date) {
        resolvedData.date = this.validator.validateDateString(params.date, 'Date');
      }

      if (params.description !== undefined) {
        resolvedData.description = params.description;
        if (params.description) updates.push(`description: ${params.description}`);
      }

      if (params.vaultType) {
        resolvedData.vaultType = this.validator.validateEnum(params.vaultType, ['main', 'savings', 'held'] as const, 'Vault type');
      }

      return this.createPendingAction(WRITE_FUNCTION_NAMES.UPDATE_TRANSACTION, 'update', 'transaction', params, resolvedData, `Update transaction - ${updates.join(', ')}`);
    } catch (error) {
      throw this.handleError(error, 'update transaction');
    }
  }

  async deleteTransactionAction(params: DeleteTransactionParams): Promise<PendingAction> {
    return this.deleteAction(params, 'transaction', WRITE_FUNCTION_NAMES.DELETE_TRANSACTION, params.transactionId, (p) => ({ transactionId: p.transactionId }));
  }

  // ============================================================================
  // Goal Operations
  // ============================================================================

  async createGoalAction(params: CreateGoalParams): Promise<PendingAction> {
    return this.createAction(params, 'goal', WRITE_FUNCTION_NAMES.CREATE_GOAL,
      (p) => this.validator.validateGoalInput(p),
      (v) => `Create goal "${v.name}" with target ${v.targetAmount.toFixed(2)}`,
    );
  }

  async updateGoalAction(params: UpdateGoalParams): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists('goal', params.goalId);

      const resolvedData: Record<string, any> = { goalId: params.goalId };
      const updates: string[] = [];

      if (params.name !== undefined) {
        this.validator.validateStringLength(params.name, 'Goal name', 1, 100);
        resolvedData.name = params.name.trim();
        updates.push(`name: ${params.name}`);
      }

      if (params.targetAmount !== undefined) {
        this.validator.validatePositiveNumber(params.targetAmount, 'Target amount');
        resolvedData.targetAmount = params.targetAmount;
        updates.push(`target: ${params.targetAmount.toFixed(2)}`);
      }

      if (params.fundingSource) {
        resolvedData.fundingSource = this.validator.validateEnum(params.fundingSource, ['main', 'savings', 'both'] as const, 'Funding source');
        updates.push(`funding: ${params.fundingSource}`);
      }

      return this.createPendingAction(WRITE_FUNCTION_NAMES.UPDATE_GOAL, 'update', 'goal', params, resolvedData, `Update goal - ${updates.join(', ')}`);
    } catch (error) {
      throw this.handleError(error, 'update goal');
    }
  }

  async updateGoalProgressAction(params: UpdateGoalProgressParams): Promise<PendingAction> {
    return this.simpleUpdateAction(params, 'goal', WRITE_FUNCTION_NAMES.UPDATE_GOAL_PROGRESS, params.goalId,
      () => `Update goal progress to ${params.currentAmount.toFixed(2)}`,
    );
  }

  async completeGoalAction(params: CompleteGoalParams): Promise<PendingAction> {
    return this.simpleUpdateAction(params, 'goal', WRITE_FUNCTION_NAMES.COMPLETE_GOAL, params.goalId,
      () => 'Mark goal as completed',
    );
  }

  async deleteGoalAction(params: DeleteGoalParams): Promise<PendingAction> {
    return this.deleteAction(params, 'goal', WRITE_FUNCTION_NAMES.DELETE_GOAL, params.goalId, (p) => ({ goalId: p.goalId }));
  }

  // ============================================================================
  // Debt Operations
  // ============================================================================

  async createDebtAction(params: CreateDebtParams): Promise<PendingAction> {
    return this.createAction(params, 'debt', WRITE_FUNCTION_NAMES.CREATE_DEBT,
      (p) => this.validator.validateDebtInput(p),
      (v) => `Record ${v.amount.toFixed(2)} ${params.type} ${params.type === 'lent' ? 'to' : 'from'} ${v.personName}`,
    );
  }

  async updateDebtAction(params: UpdateDebtParams): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists('debt', params.debtId);

      const resolvedData: Record<string, any> = { debtId: params.debtId };
      const updates: string[] = [];

      if (params.personName !== undefined) {
        this.validator.validateStringLength(params.personName, 'Person name', 1, 100);
        resolvedData.personName = params.personName.trim();
        updates.push(`person: ${params.personName}`);
      }

      if (params.amount !== undefined) {
        this.validator.validatePositiveNumber(params.amount, 'Amount');
        resolvedData.amount = params.amount;
        updates.push(`amount: ${params.amount.toFixed(2)}`);
      }

      if (params.dueDate) {
        resolvedData.dueDate = this.validator.validateDateString(params.dueDate, 'Due date');
        updates.push(`due: ${params.dueDate}`);
      }

      if (params.description !== undefined) {
        resolvedData.description = params.description;
      }

      return this.createPendingAction(WRITE_FUNCTION_NAMES.UPDATE_DEBT, 'update', 'debt', params, resolvedData, `Update debt - ${updates.join(', ')}`);
    } catch (error) {
      throw this.handleError(error, 'update debt');
    }
  }

  async recordDebtPaymentAction(params: RecordDebtPaymentParams): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists('debt', params.debtId);
      this.validator.validatePositiveNumber(params.paymentAmount, 'Payment amount');
      return this.createPendingAction(WRITE_FUNCTION_NAMES.RECORD_DEBT_PAYMENT, 'update', 'debt', params, params as any, `Record payment of ${params.paymentAmount.toFixed(2)} for debt`);
    } catch (error) {
      throw this.handleError(error, 'record debt payment');
    }
  }

  async markDebtAsPaidAction(params: MarkDebtAsPaidParams): Promise<PendingAction> {
    return this.simpleUpdateAction(params, 'debt', WRITE_FUNCTION_NAMES.MARK_DEBT_AS_PAID, params.debtId,
      () => 'Mark debt as fully paid',
    );
  }

  async deleteDebtAction(params: DeleteDebtParams): Promise<PendingAction> {
    return this.deleteAction(params, 'debt', WRITE_FUNCTION_NAMES.DELETE_DEBT, params.debtId, (p) => ({ debtId: p.debtId }));
  }

  // ============================================================================
  // Subscription Operations
  // ============================================================================

  async createSubscriptionAction(params: CreateSubscriptionParams): Promise<PendingAction> {
    return this.createAction(params, 'subscription', WRITE_FUNCTION_NAMES.CREATE_SUBSCRIPTION,
      (p) => this.validator.validateSubscriptionInput(p),
      (v) => `Create subscription "${v.name}" - ${v.amount.toFixed(2)} on day ${v.billingDay}`,
    );
  }

  async updateSubscriptionAction(params: UpdateSubscriptionParams): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists('subscription', params.subscriptionId);

      const resolvedData: Record<string, any> = { subscriptionId: params.subscriptionId };
      const updates: string[] = [];

      if (params.name !== undefined) {
        this.validator.validateStringLength(params.name, 'Subscription name', 1, 100);
        resolvedData.name = params.name.trim();
        updates.push(`name: ${params.name}`);
      }

      if (params.amount !== undefined) {
        this.validator.validatePositiveNumber(params.amount, 'Amount');
        resolvedData.amount = params.amount;
        updates.push(`amount: ${params.amount.toFixed(2)}`);
      }

      if (params.categoryName) {
        const category = await this.validator.resolveCategoryName(params.categoryName, 'expense');
        resolvedData.categoryId = category.id;
        resolvedData.categoryName = category.name;
        updates.push(`category: ${category.name}`);
      }

      if (params.billingDay !== undefined) {
        this.validator.validateBillingDay(params.billingDay);
        resolvedData.billingDay = params.billingDay;
        updates.push(`billing day: ${params.billingDay}`);
      }

      if (params.isActive !== undefined) {
        resolvedData.isActive = params.isActive;
        updates.push(`active: ${params.isActive}`);
      }

      return this.createPendingAction(WRITE_FUNCTION_NAMES.UPDATE_SUBSCRIPTION, 'update', 'subscription', params, resolvedData, `Update subscription - ${updates.join(', ')}`);
    } catch (error) {
      throw this.handleError(error, 'update subscription');
    }
  }

  async toggleSubscriptionAction(params: ToggleSubscriptionParams): Promise<PendingAction> {
    return this.simpleUpdateAction(params, 'subscription', WRITE_FUNCTION_NAMES.TOGGLE_SUBSCRIPTION, params.subscriptionId,
      () => `${params.isActive ? 'Activate' : 'Deactivate'} subscription`,
    );
  }

  async deleteSubscriptionAction(params: DeleteSubscriptionParams): Promise<PendingAction> {
    return this.deleteAction(params, 'subscription', WRITE_FUNCTION_NAMES.DELETE_SUBSCRIPTION, params.subscriptionId, (p) => ({ subscriptionId: p.subscriptionId }));
  }

  // ============================================================================
  // Recurring Expense Operations
  // ============================================================================

  async createRecurringExpenseAction(params: CreateRecurringExpenseParams): Promise<PendingAction> {
    return this.createAction(params, 'recurringExpense', WRITE_FUNCTION_NAMES.CREATE_RECURRING_EXPENSE,
      (p) => this.validator.validateRecurringExpenseInput(p),
      (v) => `Create recurring expense "${v.name}" - ${v.amount.toFixed(2)} ${params.frequency}`,
    );
  }

  async updateRecurringExpenseAction(params: UpdateRecurringExpenseParams): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists('recurringExpense', params.recurringExpenseId);

      const resolvedData: Record<string, any> = { recurringExpenseId: params.recurringExpenseId };
      const updates: string[] = [];

      if (params.name !== undefined) {
        this.validator.validateStringLength(params.name, 'Expense name', 1, 100);
        resolvedData.name = params.name.trim();
        updates.push(`name: ${params.name}`);
      }

      if (params.amount !== undefined) {
        this.validator.validatePositiveNumber(params.amount, 'Amount');
        resolvedData.amount = params.amount;
        updates.push(`amount: ${params.amount.toFixed(2)}`);
      }

      if (params.categoryName) {
        const category = await this.validator.resolveCategoryName(params.categoryName, 'expense');
        resolvedData.categoryId = category.id;
        resolvedData.categoryName = category.name;
        updates.push(`category: ${category.name}`);
      }

      if (params.frequency) {
        resolvedData.frequency = this.validator.validateEnum(params.frequency, ['daily', 'weekly', 'monthly', 'yearly'] as const, 'Frequency');
        updates.push(`frequency: ${params.frequency}`);
      }

      if (params.interval !== undefined) {
        this.validator.validateInterval(params.interval);
        resolvedData.interval = params.interval;
        updates.push(`interval: ${params.interval}`);
      }

      if (params.isActive !== undefined) {
        resolvedData.isActive = params.isActive;
        updates.push(`active: ${params.isActive}`);
      }

      return this.createPendingAction(WRITE_FUNCTION_NAMES.UPDATE_RECURRING_EXPENSE, 'update', 'recurringExpense', params, resolvedData, `Update recurring expense - ${updates.join(', ')}`);
    } catch (error) {
      throw this.handleError(error, 'update recurring expense');
    }
  }

  async deleteRecurringExpenseAction(params: DeleteRecurringExpenseParams): Promise<PendingAction> {
    return this.deleteAction(params, 'recurringExpense', WRITE_FUNCTION_NAMES.DELETE_RECURRING_EXPENSE, params.recurringExpenseId, (p) => ({ recurringExpenseId: p.recurringExpenseId }));
  }

  // ============================================================================
  // Category Operations
  // ============================================================================

  async createCategoryAction(params: CreateCategoryParams): Promise<PendingAction> {
    return this.createAction(params, 'category', WRITE_FUNCTION_NAMES.CREATE_CATEGORY,
      (p) => this.validator.validateCategoryInput(p),
      (v) => `Create ${v.type} category "${v.name}"`,
    );
  }

  async updateCategoryAction(params: UpdateCategoryParams): Promise<PendingAction> {
    try {
      await this.validator.validateEntityExists('category', params.categoryId);

      const resolvedData: Record<string, any> = { categoryId: params.categoryId };
      const updates: string[] = [];

      if (params.name !== undefined) {
        this.validator.validateStringLength(params.name, 'Category name', 1, 50);
        resolvedData.name = params.name.trim();
        updates.push(`name: ${params.name}`);
      }

      if (params.icon !== undefined) {
        resolvedData.icon = params.icon;
        updates.push(`icon: ${params.icon}`);
      }

      if (params.color !== undefined) {
        resolvedData.color = params.color;
        updates.push(`color: ${params.color}`);
      }

      return this.createPendingAction(WRITE_FUNCTION_NAMES.UPDATE_CATEGORY, 'update', 'category', params, resolvedData, `Update category - ${updates.join(', ')}`);
    } catch (error) {
      throw this.handleError(error, 'update category');
    }
  }

  async deleteCategoryAction(params: DeleteCategoryParams): Promise<PendingAction> {
    try {
      await this.validator.validateCategoryDeletion(params.categoryId);
      return this.createPendingAction(WRITE_FUNCTION_NAMES.DELETE_CATEGORY, 'delete', 'category', params, { categoryId: params.categoryId }, 'Delete category');
    } catch (error) {
      throw this.handleError(error, 'delete category');
    }
  }

  // ============================================================================
  // Execute Action (on user confirmation)
  // ============================================================================

  async executeAction(actionId: string, providedAction?: PendingAction): Promise<ActionResult> {
    const action = providedAction || this.pendingActions.get(actionId);

    if (!action) {
      throw new AIOperationError(AIOperationErrorType.ACTION_NOT_FOUND, 'Action not found', 'This action no longer exists. Please try again.');
    }

    if (action.status === 'expired') {
      throw new AIOperationError(AIOperationErrorType.ACTION_EXPIRED, 'Action expired', 'This action has expired. Would you like me to create it again?');
    }

    if (action.status !== 'pending') {
      throw new AIOperationError(AIOperationErrorType.PERMISSION_DENIED, `Action is ${action.status}`, `This action is ${action.status} and cannot be executed.`);
    }

    try {
      const handler = this.executeHandlers.get(action.functionName);
      if (!handler) {
        throw new AIOperationError(AIOperationErrorType.PERMISSION_DENIED, `Unknown function: ${action.functionName}`, 'Unknown operation.');
      }

      const entityId = await handler(action.resolvedData);

      // Sync MMKV store with recalculated balances from DB
      await this.syncBalance();

      action.status = 'confirmed';
      this.pendingActions.set(actionId, action);

      return { success: true, actionId, entityType: action.entityType, entityId };
    } catch (error) {
      action.status = 'failed';
      this.pendingActions.set(actionId, action);
      throw this.handleError(error, 'execute action');
    }
  }

  // ============================================================================
  // Execute Helpers
  // ============================================================================

  private async executeCreateTransaction(data: any): Promise<string> {
    const transaction = await this.transactionRepo.create({
      accountId: this.accountId,
      type: data.type,
      amount: data.amount,
      categoryId: data.categoryId,
      description: data.description ?? '',
      date: data.date ?? Date.now(),
      vaultType: data.vaultType ?? 'main',
      isRecurring: false,
      currency: data.currency ?? 'USD',
    });
    return transaction.id;
  }

  private async executeUpdateTransaction(data: any): Promise<void> {
    const updates: any = {};
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
    if (data.description !== undefined) updates.description = data.description;
    if (data.date !== undefined) updates.date = data.date;
    if (data.vaultType !== undefined) updates.vaultType = data.vaultType;
    await this.transactionRepo.update(data.transactionId, updates);
  }

  private async executeCreateGoal(data: any): Promise<string> {
    const goal = await this.goalRepo.create({
      accountId: this.accountId,
      name: data.name,
      targetAmount: data.targetAmount,
      fundingSource: data.fundingSource ?? 'main',
      icon: data.icon ?? 'flag',
      color: data.color ?? '#4CAF50',
    });
    return goal.id;
  }

  private async executeCreateDebt(data: any): Promise<string> {
    const debt = await this.debtRepo.create({
      accountId: this.accountId,
      type: data.type,
      personName: data.personName,
      amount: data.amount,
      dueDate: data.dueDate ?? null,
      description: data.description ?? '',
      categoryId: data.categoryId ?? null,
    });
    return debt.id;
  }

  private async executeCreateSubscription(data: any): Promise<string> {
    const subscription = await this.subscriptionRepo.create({
      accountId: this.accountId,
      name: data.name,
      amount: data.amount,
      categoryId: data.categoryId,
      billingDay: data.billingDay,
      vaultType: data.vaultType,
      isActive: true,
    });
    return subscription.id;
  }

  private async executeCreateRecurringExpense(data: any): Promise<string> {
    const recurring = await this.recurringRepo.create({
      accountId: this.accountId,
      name: data.name,
      amount: data.amount,
      categoryId: data.categoryId,
      frequency: data.frequency,
      interval: data.interval,
      nextOccurrence: data.nextOccurrence,
      vaultType: data.vaultType,
      autoDeduct: data.autoDeduct,
      isActive: true,
    });
    return recurring.id;
  }

  private async executeCreateCategory(data: any): Promise<string> {
    const category = await this.categoryRepo.create({
      userId: this.userId,
      name: data.name,
      type: data.type,
      icon: data.icon,
      color: data.color,
      isDefault: false,
    });
    return category.id;
  }

  // ============================================================================
  // Balance Sync (recalculate from DB and update MMKV store)
  // ============================================================================

  private async syncBalance(): Promise<void> {
    try {
      const transactions = await this.transactionRepo.findByAccount(this.accountId);
      const balances = calculateVaultBalances(transactions);
      const accountStore = useAccountStore.getState();
      accountStore.updateBalance(this.accountId, balances);
    } catch (error) {
      logger.error('[DataMutationService] Failed to sync balance:', error);
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleError(error: any, operation: string): AIOperationError {
    if (error instanceof AIOperationError) {
      return error;
    }
    logger.error('[DataMutationService]', `Error in ${operation}`, error);

    return new AIOperationError(
      AIOperationErrorType.DATABASE_ERROR,
      error.message || 'Unknown error',
      `Failed to ${operation}. Please try again.`
    );
  }
}
