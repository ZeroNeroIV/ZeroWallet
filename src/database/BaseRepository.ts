// Generic base repository — eliminates copy-paste CRUD across all 8 repositories
// Extend this and provide table name, field mappings, and row mapper
// Key win: 30-60 lines of update() boilerplate becomes 1 generic implementation
//           create() calls a 1-line insert helper instead of 30 lines of SQL+params

import { v4 as uuidv4 } from 'uuid';
import { executeSql } from './index';
import type { IRepository, FieldMapping } from './types';

export abstract class BaseRepository<TEntity, TInput = Partial<TEntity>>
  implements IRepository<TEntity, TInput>
{
  protected abstract tableName: string;
  protected abstract fieldMappings: FieldMapping[];
  protected abstract mapRow(row: Record<string, unknown>): TEntity;

  // ============================================
  // Create (generic INSERT via field mappings)
  // Override in subclass if computed fields needed
  // ============================================

  async create(data: TInput): Promise<TEntity> {
    const id = uuidv4();
    const now = Date.now();
    const flat = data as Record<string, unknown>;

    const columns: string[] = ['id'];
    const values: unknown[] = [id];

    for (const mapping of this.fieldMappings) {
      const val = flat[mapping.field];
      if (val !== undefined) {
        columns.push(mapping.column);
        values.push(val);
      }
    }

    columns.push('created_at', 'updated_at');
    values.push(now, now);

    const placeholders = columns.map(() => '?').join(', ');

    await executeSql(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );
    return (await this.findById(id)) as TEntity;
  }

  // ============================================
  // Protected: insert with extra computed columns
  // For repos that need computed fields (Debt.status, etc.)
  // ============================================

  protected async insert(
    data: Record<string, unknown>,
    extraColumns?: Record<string, unknown>,
  ): Promise<string> {
    const id = uuidv4();
    const now = Date.now();

    const columns: string[] = ['id'];
    const values: unknown[] = [id];

    for (const mapping of this.fieldMappings) {
      const val = data[mapping.field];
      if (val !== undefined) {
        columns.push(mapping.column);
        values.push(val);
      }
    }

    if (extraColumns) {
      for (const [col, val] of Object.entries(extraColumns)) {
        columns.push(col);
        values.push(val);
      }
    }

    columns.push('created_at', 'updated_at');
    values.push(now, now);

    const placeholders = columns.map(() => '?').join(', ');

    await executeSql(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );
    return id;
  }

  // ============================================
  // Find by ID
  // ============================================

  async findById(id: string): Promise<TEntity | null> {
    const rows = await executeSql<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`, [id],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  // ============================================
  // Update — built dynamically from fieldMappings
  // Eliminates 30-60 lines of if-else per repo
  // ============================================

  async update(id: string, updates: Partial<TEntity>): Promise<void> {
    const flat = updates as Record<string, unknown>;
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const mapping of this.fieldMappings) {
      if (flat[mapping.field] !== undefined) {
        setClauses.push(`${mapping.column} = ?`);
        values.push(flat[mapping.field]);
      }
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = ?');
    values.push(Date.now(), id);

    await executeSql(
      `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
      values,
    );
  }

  // ============================================
  // Delete
  // ============================================

  async delete(id: string): Promise<void> {
    await executeSql(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  // ============================================
  // Type-safe query helpers
  // ============================================

  protected async rawQuery(sql: string, params: unknown[] = []): Promise<TEntity[]> {
    const rows = await executeSql<Record<string, unknown>>(sql, params);
    return rows.map((r) => this.mapRow(r));
  }

  async queryScalar<T = number>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    return executeSql<T>(sql, params);
  }
}
