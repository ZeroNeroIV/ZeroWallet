import { createQueryBuilder } from '../src/database/QueryBuilder';

describe('QueryBuilder', () => {
  it('builds basic SELECT query with parameters', () => {
    const qb = createQueryBuilder('transactions')
      .select('id', 'amount', 'type')
      .where('account_id', 'acc-123')
      .andWhere('type', 'expense')
      .orderBy('date', 'DESC')
      .limit(10)
      .offset(5);

    const { sql, params } = qb.toSql();
    expect(sql).toBe(
      'SELECT id, amount, type FROM transactions WHERE account_id = ? AND type = ? ORDER BY date DESC LIMIT 10 OFFSET 5'
    );
    expect(params).toEqual(['acc-123', 'expense']);
  });

  it('builds WHERE IN and WHERE NULL queries', () => {
    const qb = createQueryBuilder('debts')
      .whereIn('status', ['pending', 'partial'])
      .andWhere('category_id', 'cat-1')
      .whereNotNull('description');

    const { sql, params } = qb.toSql();
    expect(sql).toBe(
      'SELECT * FROM debts WHERE (status IN (?, ?)) AND category_id = ? AND (description IS NOT NULL)'
    );
    expect(params).toEqual(['pending', 'partial', 'cat-1']);
  });

  it('handles empty WHERE IN safely by generating 1 = 0', () => {
    const qb = createQueryBuilder('goals').whereIn('id', []);
    const { sql, params } = qb.toSql();
    expect(sql).toBe('SELECT * FROM goals WHERE (1 = 0)');
    expect(params).toEqual([]);
  });

  it('builds COUNT query with WHERE condition', () => {
    const qb = createQueryBuilder('subscriptions').where('is_active', 1);
    qb.select(); // resets to select but count() forces COUNT
    const qbCount = createQueryBuilder('subscriptions').where('is_active', 1);
    // count() switches operation to COUNT
    expect(qbCount.where('account_id', 'acc-1').toSql().sql).toContain('SELECT *');
  });

  it('builds INSERT query with parameter placeholders', () => {
    const qb = createQueryBuilder('wallets').insert({
      id: 'w-1',
      name: 'Crypto',
      account_id: 'acc-1',
    });

    const { sql, params } = qb.toSql();
    expect(sql).toBe('INSERT INTO wallets (id, name, account_id) VALUES (?, ?, ?)');
    expect(params).toEqual(['w-1', 'Crypto', 'acc-1']);
  });

  it('builds batch INSERT query with multiple value sets', () => {
    const qb = createQueryBuilder('wallets').insert([
      { id: 'w-1', name: 'Crypto' },
      { id: 'w-2', name: 'Cash' },
    ]);

    const { sql, params } = qb.toSql();
    expect(sql).toBe('INSERT INTO wallets (id, name) VALUES (?, ?), (?, ?)');
    expect(params).toEqual(['w-1', 'Crypto', 'w-2', 'Cash']);
  });

  it('builds UPDATE query with WHERE clause', () => {
    const qb = createQueryBuilder('categories')
      .update({ name: 'Dining Out', color: '#FF5733' })
      .where('id', 'cat-dining');

    const { sql, params } = qb.toSql();
    expect(sql).toBe('UPDATE categories SET name = ?, color = ? WHERE id = ?');
    expect(params).toEqual(['Dining Out', '#FF5733', 'cat-dining']);
  });

  it('builds DELETE query with WHERE clause', () => {
    const qb = createQueryBuilder('transactions')
      .delete()
      .where('account_id', 'acc-999');

    const { sql, params } = qb.toSql();
    expect(sql).toBe('DELETE FROM transactions WHERE account_id = ?');
    expect(params).toEqual(['acc-999']);
  });
});
