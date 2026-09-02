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
import { initRepositories } from '@/shared/repositories';

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

async function runMigrationsOn(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  for (const migration of [m001, m002, m003, m004, m005, m006, m007, m008, m009]) {
    await migration.up(db);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      migration.version,
      new Date().toISOString(),
    );
  }
}

describe('SQLitePersonnelRepository', () => {
  it('blocks duplicate active sicil numbers', async () => {
    const SQL = await initSqlJs();
    const db = new TestDatabase(new SQL.Database());
    await runMigrationsOn(db);
    const repos = initRepositories(db);

    const institution = await repos.institution.create('Test Kurum');
    await repos.personnel.create(institution.id, {
      firstName: 'Ali',
      lastName: 'Veli',
      sicilNo: 'T-001',
    });

    await expect(
      repos.personnel.create(institution.id, {
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        sicilNo: 'T-001',
      }),
    ).rejects.toThrow(/sicil no zaten kayıtlı/i);
  });

  it('deduplicates active personnel with the same sicil during migration', async () => {
    const SQL = await initSqlJs();
    const db = new TestDatabase(new SQL.Database());
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    for (const migration of [m001, m002, m003, m004, m005, m006, m007]) {
      await migration.up(db);
    }

    const repos = initRepositories(db);
    const institution = await repos.institution.create('Test Kurum');
    const ts = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO personnel (id, institution_id, first_name, last_name, sicil_no, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'ACTIVE', ?, ?)`,
      'old-id',
      institution.id,
      'Eski',
      'Kayıt',
      'DUP-001',
      '2026-01-01T00:00:00.000Z',
      ts,
    );
    await db.runAsync(
      `INSERT INTO personnel (id, institution_id, first_name, last_name, sicil_no, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'ACTIVE', ?, ?)`,
      'new-id',
      institution.id,
      'Yeni',
      'Kayıt',
      'DUP-001',
      '2026-02-01T00:00:00.000Z',
      ts,
    );

    await m008.up(db);

    const active = await repos.personnel.getAll(institution.id);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('new-id');
  });
});
