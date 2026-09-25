/**
 * Purpose: Manage AI conversation context with message history and account snapshots
 *
 * Inputs:
 *   - messages (AIMessage[]): All conversation messages
 *   - accountId (string): Current account ID
 *
 * Outputs:
 *   - Returns (AIConversationContext): Context object for AI requests
 *
 * Side effects:
 *   - Queries database for account information
 *   - Caches account snapshots (5 min TTL)
 *   - Logs context building for debugging
 */

import type { AIMessage, AIConversationContext } from '../../types/ai';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { useAccountStore } from '../../store/accountStore';

interface AccountSnapshot {
  accountId: string;
  currency: string;
  balance: number;
  timestamp: number;
}

/**
 * Static caches for performance
 */
const accountSnapshotCache = new Map<string, AccountSnapshot>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Database schema description (static, doesn't change)
 */
const SCHEMA_DESCRIPTION = `
The wallet app uses SQLite with these tables:
- Transactions: income/expense records (amount, category, date, vault, description)
- Categories: user-defined income/expense categories
- Accounts: user accounts with currency and vault balances
- Goals: savings goals (name, target, current, deadline, status)
- Debts: lending/borrowing records (person, amount, paid, due date)
- Subscriptions: recurring monthly charges
- RecurringExpenses: scheduled expenses (weekly, monthly, yearly)
`;

export class ChatContextManager {
  /**
   * Build conversation context for AI request
   */
  static async buildContext(
    messages: AIMessage[],
    accountId: string
  ): Promise<AIConversationContext> {
    console.log(
      `[ContextManager] Building context for ${messages.length} messages`
    );

    // Get account snapshot (cached)
    const snapshot = await this.getAccountSnapshot(accountId);

    // Split messages: last 10 in full, older messages summarized
    const recentMessages = messages.slice(-10);
    const olderMessages = messages.slice(0, -10);

    // Summarize older messages if they exist
    let conversationSummary: string | undefined;
    if (olderMessages.length > 0) {
      conversationSummary = this.summarizeMessages(olderMessages);
    }

    const context: AIConversationContext = {
      accountId: snapshot.accountId,
      accountCurrency: snapshot.currency,
      accountBalance: snapshot.balance,
      conversationSummary,
      recentMessages,
      timestamp: Date.now(),
    };

    return context;
  }

  /**
   * Get account snapshot (with caching)
   */
  static async getAccountSnapshot(accountId: string): Promise<AccountSnapshot> {
    // Check cache first
    const cached = accountSnapshotCache.get(accountId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[ContextManager] Using cached account snapshot');
      return cached;
    }

    // Fetch fresh data
    console.log('[ContextManager] Fetching fresh account snapshot');
    try {
      const accountRepo = new AccountRepository();
      const account = await accountRepo.findById(accountId);

      if (!account) {
        throw new Error('Account not found');
      }

      const storeBalances = useAccountStore.getState().balances;
      const b = storeBalances[accountId];
      const totalBalance = b
        ? (b.totalBalance ?? (
          (b.mainBalance ?? 0) +
          (b.savingsBalance ?? 0) +
          (b.heldBalance ?? 0) +
          ((b as Record<string, number>).salaryBalance ?? 0) +
          ((b as Record<string, number>).emergencyBalance ?? 0) +
          ((b as Record<string, number>).cardBalance ?? 0) +
          ((b as Record<string, number>).physicalBalance ?? 0)
        ))
        : 0;

      const snapshot: AccountSnapshot = {
        accountId: account.id,
        currency: account.currency || 'USD',
        balance: totalBalance,
        timestamp: Date.now(),
      };

      // Cache it
      accountSnapshotCache.set(accountId, snapshot);

      return snapshot;
    } catch (error) {
      console.error('[ContextManager] Failed to get account snapshot:', error);
      // Return default snapshot on error
      return {
        accountId,
        currency: 'USD',
        balance: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Summarize older messages (simple concatenation + truncation)
   */
  private static summarizeMessages(messages: AIMessage[]): string {
    const summary = messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'User' : 'AI';
        return `${role}: ${msg.content}`;
      })
      .join('\n');

    // Truncate to 500 chars
    if (summary.length > 500) {
      return summary.substring(0, 497) + '...';
    }

    return summary;
  }

  /**
   * Get schema description (static)
   */
  static getSchemaDescription(): string {
    return SCHEMA_DESCRIPTION;
  }

  /**
   * Clear account snapshot cache (useful for testing or force refresh)
   */
  static clearCache(accountId?: string) {
    if (accountId) {
      accountSnapshotCache.delete(accountId);
      console.log(`[ContextManager] Cleared cache for account ${accountId}`);
    } else {
      accountSnapshotCache.clear();
      console.log('[ContextManager] Cleared all account caches');
    }
  }
}
