import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type { User } from '@/shared/types';
import type { AuthRepository } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    personnelId: (row.personnel_id as string) ?? null,
    displayName: row.display_name as string,
    role: row.role as User['role'],
    pin: (row.pin as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SQLiteAuthRepository implements AuthRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getDemoUsers(institutionId: string): Promise<User[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM users WHERE institution_id = ? ORDER BY display_name',
      institutionId,
    );
    return rows.map(mapUser);
  }

  async getById(id: string): Promise<User | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM users WHERE id = ?',
      id,
    );
    return row ? mapUser(row) : null;
  }

  async login(userId: string, pin?: string): Promise<User | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM users WHERE id = ?',
      userId,
    );
    if (!row) return null;

    const user = mapUser(row);
    if (user.pin && user.pin !== (pin ?? '')) {
      return null;
    }
    return user;
  }

  async createUser(input: {
    institutionId: string;
    displayName: string;
    role: User['role'];
    personnelId?: string | null;
    pin?: string | null;
  }): Promise<User> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO users (id, institution_id, personnel_id, display_name, role, pin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.institutionId,
      input.personnelId ?? null,
      input.displayName,
      input.role,
      input.pin ?? null,
      ts,
      ts,
    );
    const user = await this.getById(id);
    if (!user) throw new Error('Kullanıcı oluşturulamadı');
    return user;
  }
}
