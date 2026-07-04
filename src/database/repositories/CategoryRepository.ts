// Category Repository — extends BaseRepository
import { executeSql } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { Category, CategoryType } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'userId', column: 'user_id' },
  { field: 'name', column: 'name' },
  { field: 'type', column: 'type' },
  { field: 'icon', column: 'icon' },
  { field: 'color', column: 'color' },
  { field: 'isDefault', column: 'is_default' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'food', color: '#FF6B6B' },
  { name: 'Transportation', icon: 'car', color: '#4ECDC4' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#FFE66D' },
  { name: 'Entertainment', icon: 'movie', color: '#A8E6CF' },
  { name: 'Bills & Utilities', icon: 'receipt', color: '#FF8B94' },
  { name: 'Healthcare', icon: 'medical-bag', color: '#B4A7D6' },
  { name: 'Education', icon: 'school', color: '#89CFF0' },
  { name: 'Other', icon: 'dots-horizontal', color: '#C7CEEA' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'briefcase', color: '#06D6A0' },
  { name: 'Freelance', icon: 'laptop', color: '#118AB2' },
  { name: 'Investment', icon: 'trending-up', color: '#FFD166' },
  { name: 'Gift', icon: 'gift', color: '#EF476F' },
  { name: 'Other', icon: 'cash', color: '#26547C' },
];

export class CategoryRepository extends BaseRepository<Category> {
  protected tableName = 'categories';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Category {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      type: row.type as CategoryType,
      icon: row.icon as string,
      color: row.color as string,
      isDefault: (row.is_default as number) === 1,
      createdAt: row.created_at as number,
    };
  }

  async findByUser(userId: string): Promise<Category[]> {
    return this.rawQuery(
      'SELECT * FROM categories WHERE user_id = ? ORDER BY is_default DESC, name ASC',
      [userId],
    );
  }

  async findByUserAndType(userId: string, type: CategoryType): Promise<Category[]> {
    return this.rawQuery(
      'SELECT * FROM categories WHERE user_id = ? AND type = ? ORDER BY is_default DESC, name ASC',
      [userId, type],
    );
  }

  async delete(id: string): Promise<void> {
    const category = await this.findById(id);
    if (category?.isDefault) {
      throw new Error('Cannot delete default category');
    }
    const usage = await this.getUsageCount(id);
    if (usage > 0) {
      throw new Error('Category is in use by transactions');
    }
    await executeSql('DELETE FROM categories WHERE id = ?', [id]);
  }

  async getUsageCount(id: string): Promise<number> {
    const rows = await executeSql<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
      [id],
    );
    return rows[0]?.count || 0;
  }

  async findSalaryCategory(userId: string): Promise<Category | null> {
    const rows = await this.rawQuery(
      'SELECT * FROM categories WHERE user_id = ? AND type = ? AND name = ?',
      [userId, 'income', 'Salary'],
    );
    return rows[0] || null;
  }
}

export async function createDefaultCategories(userId: string): Promise<void> {
  const repo = new CategoryRepository();
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    await repo.create({ ...cat, userId, type: 'expense', isDefault: true });
  }
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    await repo.create({ ...cat, userId, type: 'income', isDefault: true });
  }
}
