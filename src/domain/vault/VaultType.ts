export type VaultTypeString = 'main' | 'savings' | 'held';

const KEYS: Record<VaultTypeString, keyof AccountBalanceShape> = {
  main: 'mainBalance',
  savings: 'savingsBalance',
  held: 'heldBalance',
};

export interface AccountBalanceShape {
  mainBalance: number;
  savingsBalance: number;
  heldBalance: number;
}

export class VaultType {
  private constructor(readonly type: VaultTypeString) {}

  static readonly Main = new VaultType('main');
  static readonly Savings = new VaultType('savings');
  static readonly Held = new VaultType('held');

  private static readonly ALL: Record<VaultTypeString, VaultType> = {
    main: VaultType.Main,
    savings: VaultType.Savings,
    held: VaultType.Held,
  };

  static parse(s: string): VaultType {
    const vt = VaultType.ALL[s as VaultTypeString];
    if (!vt) throw new Error(`Invalid vault type: '${s}'. Must be main, savings, or held.`);
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
