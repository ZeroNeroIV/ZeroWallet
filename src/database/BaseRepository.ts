// Generic base repository — eliminates copy-paste CRUD across all 8 repositories
// Extend this and provide table name, field mappings, and row mapper
// Key win: 30-60 lines of update() boilerplate becomes 1 generic implementation
//           create() calls a 1-line insert helper instead of 30 lines of SQL+params

import { v4 as uuidv4 } from 'uuid';
import { executeSql } from './index';
import { createQueryBuilder, QueryBuilder } from './QueryBuilder';
import type { IRepository, FieldMapping } from './types';

export abstract class BaseRepository<TEntity, TInput = Partial<TEntity>>
  implements IRepository<TEntity, TInput>
{
  protected abstract tableName: string;
  protected abstract fieldMappings: FieldMapping[];
  protected abstract mapRow(row: Record<string, unknown>): TEntity;

  /**
   * Creates a fluent QueryBuilder targeted at this repository's table
   */
  createQuery(): QueryBuilder<Record<string, unknown>> {
    return createQueryBuilder(this.tableName);
  }

  // ============================================
  // Create (generic INSERT via field mappings)
  // Override in subclass if computed fields needed
  // ============================================

  async create(data: TInput): Promise<TEntity> {
    const id = uuidv4();
    const now = Date.now();
    const flat = data as Record<string, unknown>;

    const row: Record<string, unknown> = { id };
    for (const mapping of this.fieldMappings) {
      const val = flat[mapping.field];
      if (val !== undefined) {
        row[mapping.column] = val;
      }
    }
    row.created_at = now;
    row.updated_at = now;

    await this.createQuery().insert(row).execute();
    return (await this.findById(id)) as TEntity;
  }

  // ============================================
  // Batch Insert
  // ============================================

  async insertBatch(items: TInput[]): Promise<void> {
    if (items.length === 0) return;
    const now = Date.now();
    const rows = items.map((data) => {
      const id = uuidv4();
      const flat = data as Record<string, unknown>;
      const row: Record<string, unknown> = { id };
      for (const mapping of this.fieldMappings) {
        const val = flat[mapping.field];
        if (val !== undefined) {
          row[mapping.column] = val;
        }
      }
      row.created_at = now;
      row.updated_at = now;
      return row;
    });

    await this.createQuery().insert(rows).execute();
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

    const row: Record<string, unknown> = { id };
    for (const mapping of this.fieldMappings) {
      const val = data[mapping.field];
      if (val !== undefined) {
        row[mapping.column] = val;
      }
    }

    if (extraColumns) {
      for (const [col, val] of Object.entries(extraColumns)) {
        row[col] = val;
      }
    }

    row.created_at = now;
    row.updated_at = now;

    await this.createQuery().insert(row).execute();
    return id;
  }

  // ============================================
  // Find by ID
  // ============================================

  async findById(id: string): Promise<TEntity | null> {
    const row = await this.createQuery().where('id', id).first();
    return row ? this.mapRow(row) : null;
  }

  // ============================================
  // Find All (with pagination)
  // ============================================

  async findAll(limit?: number, offset?: number): Promise<TEntity[]> {
    const qb = this.createQuery().orderBy('created_at', 'DESC');
    if (limit !== undefined) qb.limit(limit);
    if (offset !== undefined) qb.offset(offset);
    const rows = await qb.execute();
    return rows.map((r) => this.mapRow(r));
  }

  // ============================================
  // Count
  // ============================================

  async count(): Promise<number> {
    return this.createQuery().count();
  }

  // ============================================
  // Update — built dynamically from fieldMappings
  // Eliminates 30-60 lines of if-else per repo
  // ============================================

  async update(id: string, updates: Partial<TEntity>): Promise<void> {
    const flat = updates as Record<string, unknown>;
    const updateValues: Record<string, unknown> = {};

    for (const mapping of this.fieldMappings) {
      if (flat[mapping.field] !== undefined) {
        updateValues[mapping.column] = flat[mapping.field];
      }
    }

    if (Object.keys(updateValues).length === 0) return;

    updateValues.updated_at = Date.now();

    await this.createQuery().update(updateValues).where('id', id).execute();
  }

  // ============================================
  // Delete
  // ============================================

  async delete(id: string): Promise<void> {
    await this.createQuery().delete().where('id', id).execute();
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
