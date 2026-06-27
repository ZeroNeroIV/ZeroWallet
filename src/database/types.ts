// Repository interface and related types

export interface IRepository<TEntity, TInput = Partial<TEntity>> {
  create(data: TInput): Promise<TEntity>;
  findById(id: string): Promise<TEntity | null>;
  delete(id: string): Promise<void>;
}

// Describes how a model field maps to a SQL column and vice versa
export interface FieldMapping {
  field: string;    // camelCase model field (e.g., 'accountId')
  column: string;   // snake_case DB column (e.g., 'account_id')
}

// Input for dynamic UPDATE building
export interface UpdateSet {
  clause: string;
  value: unknown;
}
