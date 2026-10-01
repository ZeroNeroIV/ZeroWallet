export type VaultTypeString =
  | 'main'
  | 'savings'
  | 'held'
  | 'salary'
  | 'emergency'
  | 'card'
  | 'physical'
  | (string & {});

export const VAULT_TYPE_VALUES: readonly VaultTypeString[] = [
  'main',
  'savings',
  'held',
  'salary',
  'emergency',
  'card',
  'physical',
] as const;

const KEYS: Record<string, keyof AccountBalanceShape> = {
  main: 'mainBalance',
  savings: 'savingsBalance',
  held: 'heldBalance',
  salary: 'salaryBalance',
  emergency: 'emergencyBalance',
  card: 'cardBalance',
  physical: 'physicalBalance',
};

/**
 * Purpose: Derive the balance field name for any wallet id.
 * The 7 built-in wallets use fixed fields; custom wallets (ids like
 * 'w_abc123') use `<id>Balance` so no schema change is ever needed.
 */
export function walletBalanceKey(vault: string): string {
  return KEYS[vault] ?? `${vault}Balance`;
}

export interface AccountBalanceShape {
  mainBalance: number;
  savingsBalance: number;
  heldBalance: number;
  salaryBalance: number;
  emergencyBalance: number;
  cardBalance: number;
  physicalBalance: number;
}

export const EMPTY_WALLET_BALANCES: AccountBalanceShape = {
  mainBalance: 0,
  savingsBalance: 0,
  heldBalance: 0,
  salaryBalance: 0,
  emergencyBalance: 0,
  cardBalance: 0,
  physicalBalance: 0,
};

export class VaultType {
  private constructor(readonly type: VaultTypeString) {}

  static readonly Main = new VaultType('main');
  static readonly Savings = new VaultType('savings');
  static readonly Held = new VaultType('held');
  static readonly Salary = new VaultType('salary');
  static readonly Emergency = new VaultType('emergency');
  static readonly Card = new VaultType('card');
  static readonly Physical = new VaultType('physical');

  private static readonly ALL: Record<string, VaultType> = {
    main: VaultType.Main,
    savings: VaultType.Savings,
    held: VaultType.Held,
    salary: VaultType.Salary,
    emergency: VaultType.Emergency,
    card: VaultType.Card,
    physical: VaultType.Physical,
  };

  private static readonly ALIASES: Record<string, VaultTypeString> = {
    investment: 'main',
    invest: 'main',
    spending: 'main',
    general: 'main',
    recurring: 'held',
    bills: 'held',
    emergency_fund: 'emergency',
    'emergency-fund': 'emergency',
    cash: 'physical',
    credit: 'card',
    debit: 'card',
    credit_card: 'card',
    'credit-card': 'card',
  };

  /**
   * Resilient parsing of vault strings. Tolerates null, undefined, casing,
   * legacy aliases, and custom wallet identifiers.
   */
  static parse(s: unknown): VaultType {
    if (!s || typeof s !== 'string') {
      return VaultType.Main;
    }
    const clean = s.trim().toLowerCase();
    const alias = VaultType.ALIASES[clean];
    const key = (alias ?? clean) as VaultTypeString;

    const vt = VaultType.ALL[key];
    return vt ?? new VaultType(s.trim());
  }

  get key(): keyof AccountBalanceShape {
    return (KEYS[this.type] ?? `${this.type}Balance`) as keyof AccountBalanceShape;
  }

  getBalance(balances: AccountBalanceShape | Record<string, number | undefined>): number {
    if (!balances) return 0;
    const field = KEYS[this.type] ?? `${this.type}Balance`;
    return (balances as Record<string, any>)[field] ?? 0;
  }

  adjustBalance(
    balances: AccountBalanceShape | Record<string, number | undefined>,
    delta: number
  ): Partial<AccountBalanceShape> {
    const field = (KEYS[this.type] ?? `${this.type}Balance`) as keyof AccountBalanceShape;
    return { [field]: this.getBalance(balances) + delta };
  }
}
