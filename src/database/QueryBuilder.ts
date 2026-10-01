/**
 * Type-Safe Fluent SQL Query Builder for SQLite
 *
 * Provides structured query construction with parameter binding to prevent
 * SQL injection and eliminate string concatenation across repositories.
 */

import { executeSql } from './index';

export type ComparisonOperator =
  | '='
  | '!='
  | '<>'
  | '>'
  | '>='
  | '<'
  | '<='
  | 'LIKE'
  | 'ILIKE'
  | 'IN'
  | 'NOT IN';

export type SortDirection = 'ASC' | 'DESC';

interface WhereClause {
  combinator: 'AND' | 'OR';
  type: 'FIELD' | 'RAW';
  column?: string;
  operator?: ComparisonOperator;
  value?: any;
  rawSql?: string;
  params?: any[];
}

interface OrderByClause {
  column: string;
  direction: SortDirection;
}

export type QueryOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COUNT';

export class QueryBuilder<T = Record<string, any>> {
  private operation: QueryOperation = 'SELECT';
  private targetTable: string = '';
  private selectedColumns: string[] = ['*'];
  private whereClauses: WhereClause[] = [];
  private orderByClauses: OrderByClause[] = [];
  private groupByColumns: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private updateValues: Record<string, any> = {};
  private insertRows: Record<string, any>[] = [];

  constructor(table?: string) {
    if (table) {
      this.targetTable = table;
    }
  }

  // ============================================
  // Table & Columns
  // ============================================

  from(table: string): this {
    this.targetTable = table;
    return this;
  }

  select(...columns: string[]): this {
    this.operation = 'SELECT';
    if (columns.length > 0) {
      this.selectedColumns = columns;
    }
    return this;
  }

  // ============================================
  // Where Filtering
  // ============================================

  where(column: string, operatorOrValue: ComparisonOperator | any, value?: any): this {
    return this.addWhere('AND', column, operatorOrValue, value);
  }

  andWhere(column: string, operatorOrValue: ComparisonOperator | any, value?: any): this {
    return this.addWhere('AND', column, operatorOrValue, value);
  }

  orWhere(column: string, operatorOrValue: ComparisonOperator | any, value?: any): this {
    return this.addWhere('OR', column, operatorOrValue, value);
  }

  whereRaw(rawSql: string, params: any[] = [], combinator: 'AND' | 'OR' = 'AND'): this {
    this.whereClauses.push({
      combinator,
      type: 'RAW',
      rawSql,
      params,
    });
    return this;
  }

  whereIn(column: string, values: any[]): this {
    if (values.length === 0) {
      // If empty set, condition is always false
      return this.whereRaw('1 = 0');
    }
    const placeholders = values.map(() => '?').join(', ');
    return this.whereRaw(`${column} IN (${placeholders})`, values);
  }

  whereNotIn(column: string, values: any[]): this {
    if (values.length === 0) {
      return this;
    }
    const placeholders = values.map(() => '?').join(', ');
    return this.whereRaw(`${column} NOT IN (${placeholders})`, values);
  }

  whereNull(column: string): this {
    return this.whereRaw(`${column} IS NULL`);
  }

  whereNotNull(column: string): this {
    return this.whereRaw(`${column} IS NOT NULL`);
  }

  private addWhere(
    combinator: 'AND' | 'OR',
    column: string,
    operatorOrValue: ComparisonOperator | any,
    value?: any
  ): this {
    let op: ComparisonOperator = '=';
    let val: any = operatorOrValue;

    if (value !== undefined) {
      op = operatorOrValue as ComparisonOperator;
      val = value;
    }

    this.whereClauses.push({
      combinator,
      type: 'FIELD',
      column,
      operator: op,
      value: val,
    });
    return this;
  }

  // ============================================
  // Ordering, Grouping & Pagination
  // ============================================

  orderBy(column: string, direction: SortDirection = 'ASC'): this {
    this.orderByClauses.push({ column, direction });
    return this;
  }

  groupBy(...columns: string[]): this {
    this.groupByColumns.push(...columns);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  // ============================================
  // Mutation Setters
  // ============================================

  insert(data: Record<string, any> | Record<string, any>[]): this {
    this.operation = 'INSERT';
    this.insertRows = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data: Record<string, any>): this {
    this.operation = 'UPDATE';
    this.updateValues = data;
    return this;
  }

  delete(): this {
    this.operation = 'DELETE';
    return this;
  }

  // ============================================
  // SQL Generation
  // ============================================

  toSql(): { sql: string; params: any[] } {
    if (!this.targetTable) {
      throw new Error('[QueryBuilder] Target table must be specified.');
    }

    switch (this.operation) {
      case 'SELECT':
        return this.buildSelectSql();
      case 'COUNT':
        return this.buildCountSql();
      case 'INSERT':
        return this.buildInsertSql();
      case 'UPDATE':
        return this.buildUpdateSql();
      case 'DELETE':
        return this.buildDeleteSql();
    }
  }

  private buildWhereClause(): { whereSql: string; params: any[] } {
    if (this.whereClauses.length === 0) {
      return { whereSql: '', params: [] };
    }

    const parts: string[] = [];
    const params: any[] = [];

    this.whereClauses.forEach((clause, index) => {
      const prefix = index === 0 ? '' : ` ${clause.combinator} `;

      if (clause.type === 'RAW' && clause.rawSql) {
        parts.push(`${prefix}(${clause.rawSql})`);
        if (clause.params) {
          params.push(...clause.params);
        }
      } else if (clause.column && clause.operator) {
        parts.push(`${prefix}${clause.column} ${clause.operator} ?`);
        params.push(clause.value);
      }
    });

    return {
      whereSql: ` WHERE ${parts.join('')}`,
      params,
    };
  }

  private buildSelectSql(): { sql: string; params: any[] } {
    const columns = this.selectedColumns.join(', ');
    let sql = `SELECT ${columns} FROM ${this.targetTable}`;
    const { whereSql, params } = this.buildWhereClause();
    sql += whereSql;

    if (this.groupByColumns.length > 0) {
      sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
    }

    if (this.orderByClauses.length > 0) {
      const orderParts = this.orderByClauses.map(
        (o) => `${o.column} ${o.direction}`
      );
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  private buildCountSql(): { sql: string; params: any[] } {
    let sql = `SELECT COUNT(*) as count FROM ${this.targetTable}`;
    const { whereSql, params } = this.buildWhereClause();
    sql += whereSql;
    return { sql, params };
  }

  private buildInsertSql(): { sql: string; params: any[] } {
    if (this.insertRows.length === 0) {
      throw new Error('[QueryBuilder] No rows provided for INSERT');
    }

    const firstRow = this.insertRows[0];
    const columns = Object.keys(firstRow);
    const params: any[] = [];

    const rowPlaceholders = this.insertRows.map((row) => {
      const rowVals = columns.map((col) => row[col]);
      params.push(...rowVals);
      return `(${columns.map(() => '?').join(', ')})`;
    });

    const sql = `INSERT INTO ${this.targetTable} (${columns.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`;
    return { sql, params };
  }

  private buildUpdateSql(): { sql: string; params: any[] } {
    const entries = Object.entries(this.updateValues);
    if (entries.length === 0) {
      throw new Error('[QueryBuilder] No values provided for UPDATE');
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    for (const [col, val] of entries) {
      setClauses.push(`${col} = ?`);
      params.push(val);
    }

    let sql = `UPDATE ${this.targetTable} SET ${setClauses.join(', ')}`;
    const { whereSql, params: whereParams } = this.buildWhereClause();
    sql += whereSql;
    params.push(...whereParams);

    return { sql, params };
  }

  private buildDeleteSql(): { sql: string; params: any[] } {
    let sql = `DELETE FROM ${this.targetTable}`;
    const { whereSql, params } = this.buildWhereClause();
    sql += whereSql;
    return { sql, params };
  }

  // ============================================
  // Execution Helpers
  // ============================================

  async execute(
    customExecutor?: (sql: string, params: any[]) => Promise<any[]>
  ): Promise<T[]> {
    const { sql, params } = this.toSql();
    const run = customExecutor ?? executeSql;
    return (await run(sql, params)) as T[];
  }

  async first(
    customExecutor?: (sql: string, params: any[]) => Promise<any[]>
  ): Promise<T | null> {
    this.limit(1);
    const rows = await this.execute(customExecutor);
    return rows.length > 0 ? rows[0] : null;
  }

  async count(
    customExecutor?: (sql: string, params: any[]) => Promise<any[]>
  ): Promise<number> {
    this.operation = 'COUNT';
    const { sql, params } = this.toSql();
    const run = customExecutor ?? executeSql;
    const rows = await run(sql, params);
    return (rows[0] as any)?.count ?? 0;
  }
}

/**
 * Factory helper for creating a new QueryBuilder instance
 */
export function createQueryBuilder<T = Record<string, any>>(table?: string): QueryBuilder<T> {
  return new QueryBuilder<T>(table);
}
