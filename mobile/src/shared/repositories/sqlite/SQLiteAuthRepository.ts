import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type { User, Permission } from '@/shared/types';
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
    canMessageAdmins: Boolean(row.can_message_admins),
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
    canMessageAdmins?: boolean;
  }): Promise<User> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO users (id, institution_id, personnel_id, display_name, role, pin, can_message_admins, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.institutionId,
      input.personnelId ?? null,
      input.displayName,
      input.role,
      input.pin ?? null,
      input.canMessageAdmins ? 1 : 0,
      ts,
      ts,
    );
    const user = await this.getById(id);
    if (!user) throw new Error('Kullanıcı oluşturulamadı');
    return user;
  }

  async updateUser(
    id: string,
    input: { canMessageAdmins?: boolean; displayName?: string },
  ): Promise<User> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.canMessageAdmins !== undefined) {
      updates.push('can_message_admins = ?');
      values.push(input.canMessageAdmins ? 1 : 0);
    }
    if (input.displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(input.displayName);
    }

    if (updates.length === 0) {
      const user = await this.getById(id);
      if (!user) throw new Error('Kullanıcı bulunamadı');
      return user;
    }

    updates.push('updated_at = ?');
    values.push(nowIso());
    values.push(id);

    await this.db.runAsync(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      ...values,
    );

    const user = await this.getById(id);
    if (!user) throw new Error('Kullanıcı bulunamadı');
    return user;
  }

  async getUsersByRole(institutionId: string, roles: User['role'][]): Promise<User[]> {
    if (roles.length === 0) return [];
    const placeholders = roles.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM users WHERE institution_id = ? AND role IN (${placeholders}) ORDER BY display_name`,
      institutionId,
      ...roles,
    );
    return rows.map(mapUser);
  }

  async getUserByPersonnelId(personnelId: string): Promise<User | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM users WHERE personnel_id = ?',
      personnelId,
    );
    return row ? mapUser(row) : null;
  }

  async getUserGrants(
    userId: string,
  ): Promise<Array<{ permission: Permission; unitId: string | null }>> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT permission, unit_id FROM user_grants WHERE user_id = ?',
      userId,
    );
    return rows.map((row) => ({
      permission: row.permission as Permission,
      unitId: (row.unit_id as string) ?? null,
    }));
  }

  async grantPermission(
    userId: string,
    permission: Permission,
    unitId?: string | null,
  ): Promise<void> {
    const existing = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM user_grants
       WHERE user_id = ? AND permission = ? AND COALESCE(unit_id, '') = COALESCE(?, '')`,
      userId,
      permission,
      unitId ?? null,
    );
    if (existing) return;

    await this.db.runAsync(
      `INSERT INTO user_grants (id, user_id, permission, unit_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      generateId(),
      userId,
      permission,
      unitId ?? null,
      nowIso(),
    );
  }
}
