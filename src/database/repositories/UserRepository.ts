// User Repository — extends BaseRepository
import { BaseRepository } from '../BaseRepository';
import type { User } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'email', column: 'email' },
  { field: 'passwordHash', column: 'password_hash' },
  { field: 'name', column: 'name' },
];

export class UserRepository extends BaseRepository<User> {
  protected tableName = 'users';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      passwordHash: row.password_hash as string,
      name: row.name as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.rawQuery(
      'SELECT * FROM users WHERE email = ?',
      [email],
    );
    return rows[0] || null;
  }
}
