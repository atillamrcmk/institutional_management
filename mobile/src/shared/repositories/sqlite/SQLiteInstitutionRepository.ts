import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type { InstitutionRepository } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

export class SQLiteInstitutionRepository implements InstitutionRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getFirst(): Promise<{ id: string; name: string } | null> {
    const row = await this.db.getFirstAsync<{ id: string; name: string }>(
      'SELECT id, name FROM institutions ORDER BY created_at LIMIT 1',
    );
    return row ?? null;
  }

  async create(name: string): Promise<{ id: string; name: string }> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      'INSERT INTO institutions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      id,
      name,
      ts,
      ts,
    );
    return { id, name };
  }

  async clearAllData(): Promise<void> {
    const tables = [
      'audit_logs',
      'assignment_personnel',
      'assignments',
      'task_types',
      'personnel_absences',
      'personnel_shift_assignments',
      'shift_groups',
      'shift_pattern_days',
      'shift_patterns',
      'personnel_unit_history',
      'users',
      'units',
      'personnel',
      'institutions',
    ];
    await this.db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      for (const table of tables) {
        await this.db.runAsync(`DELETE FROM ${table}`);
      }
    } finally {
      await this.db.execAsync('PRAGMA foreign_keys = ON;');
      await this.db.flushAsync?.();
    }
  }

  async persist(): Promise<void> {
    await this.db.flushAsync?.();
  }
}
