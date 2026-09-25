export type VaultTypeString =
  | 'main'
  | 'savings'
  | 'held'
  | 'salary'
  | 'emergency'
  | 'card'
  | 'physical';

export const VAULT_TYPE_VALUES: readonly VaultTypeString[] = [
  'main',
  'savings',
  'held',
  'salary',
  'emergency',
  'card',
  'physical',
] as const;

const KEYS: Record<VaultTypeString, keyof AccountBalanceShape> = {
  main: 'mainBalance',
  savings: 'savingsBalance',
  held: 'heldBalance',
  salary: 'salaryBalance',
  emergency: 'emergencyBalance',
  card: 'cardBalance',
  physical: 'physicalBalance',
};

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

  private static readonly ALL: Record<VaultTypeString, VaultType> = {
    main: VaultType.Main,
    savings: VaultType.Savings,
    held: VaultType.Held,
    salary: VaultType.Salary,
    emergency: VaultType.Emergency,
    card: VaultType.Card,
    physical: VaultType.Physical,
  };

  static parse(s: string): VaultType {
    const vt = VaultType.ALL[s as VaultTypeString];
    if (!vt) throw new Error(`Invalid vault type: '${s}'. Must be one of: ${VAULT_TYPE_VALUES.join(', ')}.`);
    return vt;
  }

  get key(): keyof AccountBalanceShape {
    return KEYS[this.type];
  }

  getBalance(balances: AccountBalanceShape): number {
    return balances[KEYS[this.type]] ?? 0;
  }

  adjustBalance(balances: AccountBalanceShape, delta: number): Partial<AccountBalanceShape> {
    return { [KEYS[this.type]]: this.getBalance(balances) + delta };
  }
}
