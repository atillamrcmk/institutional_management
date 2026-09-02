import initSqlJs, { type BindParams, type Database as SqlJsDatabase } from 'sql.js';
import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import * as m001 from '@/shared/database/migrations/migration_001_initial';
import * as m002 from '@/shared/database/migrations/migration_002_shift_engine';
import * as m003 from '@/shared/database/migrations/migration_003_assignments';
import * as m004 from '@/shared/database/migrations/migration_004_shift_group_offset';
import * as m005 from '@/shared/database/migrations/migration_005_shift_group_cycle_start';
import * as m006 from '@/shared/database/migrations/migration_006_unit_work_schedule';
import * as m007 from '@/shared/database/migrations/migration_007_personnel_photo';
import * as m008 from '@/shared/database/migrations/migration_008_personnel_unique_sicil';
import * as m009 from '@/shared/database/migrations/migration_009_user_grants';
import * as m010 from '@/shared/database/migrations/migration_010_messaging';
import { initRepositories } from '@/shared/repositories';
import { seedDemoData } from './seedDemoData';

async function runMigrationsOn(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  for (const migration of [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010]) {
    await migration.up(db);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      migration.version,
      new Date().toISOString(),
    );
  }
}

class TestDatabase implements SQLiteDatabaseAdapter {
  constructor(private readonly db: SqlJsDatabase) {}

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      if (params.length > 0) stmt.bind(params as BindParams);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    this.db.run(sql, params as (string | number | null)[]);
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    this.db.run('BEGIN');
    try {
      await fn();
      this.db.run('COMMIT');
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

describe('seedDemoData', () => {
  it('creates institution, personnel and demo users', async () => {
    const SQL = await initSqlJs();
    const db = new TestDatabase(new SQL.Database());
    await runMigrationsOn(db);
    initRepositories(db);

    const { institutionId } = await seedDemoData();
    const repos = initRepositories(db);

    const institution = await repos.institution.getFirst();
    expect(institution?.id).toBe(institutionId);

    const personnel = await repos.personnel.getAll(institutionId);
    expect(personnel.length).toBeGreaterThanOrEqual(90);

    const users = await repos.auth.getDemoUsers(institutionId);
    expect(users).toHaveLength(4);
  });
});
