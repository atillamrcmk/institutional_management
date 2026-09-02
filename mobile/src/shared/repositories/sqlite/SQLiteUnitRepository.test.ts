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
import { PRESET_CYCLE_4_DAY } from '@/features/shifts/constants/shiftDefaults';
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

describe('SQLiteUnitRepository.delete', () => {
  it('deletes unit with shift groups and personnel history', async () => {
    const SQL = await initSqlJs();
    const db = new TestDatabase(new SQL.Database());
    await runMigrationsOn(db);
    const repos = initRepositories(db);

    const institution = await repos.institution.create('Test Kurum');
    const unit = await repos.units.create(institution.id, { name: 'Malta' });
    const personnel = await repos.personnel.create(institution.id, {
      firstName: 'Ali',
      lastName: 'Veli',
      sicilNo: 'T-001',
    });
    await repos.units.assignPersonnel(unit.id, personnel.id);

    const pattern = await repos.shifts.createPattern(
      institution.id,
      'Test Döngü',
      '2026-08-27',
      PRESET_CYCLE_4_DAY,
    );
    const group = await repos.shifts.createGroup(
      unit.id,
      'A Vardiyası',
      pattern.id,
      '2026-08-27',
    );
    await repos.shifts.assignPersonnelToGroup(personnel.id, group.id);

    await repos.units.delete(unit.id);

    expect(await repos.units.getById(unit.id)).toBeNull();
    expect(await repos.shifts.getGroupsByUnit(unit.id)).toHaveLength(0);
    expect(await repos.shifts.getPatternById(pattern.id)).toBeNull();
  });

  it('blocks delete when child units exist', async () => {
    const SQL = await initSqlJs();
    const db = new TestDatabase(new SQL.Database());
    await runMigrationsOn(db);
    const repos = initRepositories(db);

    const institution = await repos.institution.create('Test Kurum');
    const parent = await repos.units.create(institution.id, { name: 'Güvenlik' });
    await repos.units.create(institution.id, { name: 'Malta', parentId: parent.id });

    await expect(repos.units.delete(parent.id)).rejects.toThrow(/alt birim/i);
  });
});

describe('SQLiteUnitRepository.assignPersonnel', () => {
  it('blocks assigning personnel who already belong to another unit', async () => {
    const SQL = await initSqlJs();
    const db = new TestDatabase(new SQL.Database());
    await runMigrationsOn(db);
    const repos = initRepositories(db);

    const institution = await repos.institution.create('Test Kurum');
    const malta = await repos.units.create(institution.id, { name: 'Malta' });
    const merkez = await repos.units.create(institution.id, { name: 'Merkez Kontrol' });
    const personnel = await repos.personnel.create(institution.id, {
      firstName: 'Ali',
      lastName: 'Veli',
      sicilNo: 'T-001',
    });

    await repos.units.assignPersonnel(malta.id, personnel.id);

    await expect(repos.units.assignPersonnel(merkez.id, personnel.id)).rejects.toThrow(
      /Malta.*biriminde görevli/i,
    );
  });

  it('returns only personnel without an active unit assignment', async () => {
    const SQL = await initSqlJs();
    const db = new TestDatabase(new SQL.Database());
    await runMigrationsOn(db);
    const repos = initRepositories(db);

    const institution = await repos.institution.create('Test Kurum');
    const unit = await repos.units.create(institution.id, { name: 'Malta' });
    const assigned = await repos.personnel.create(institution.id, {
      firstName: 'Ali',
      lastName: 'Atanmış',
      sicilNo: 'T-001',
    });
    const unassigned = await repos.personnel.create(institution.id, {
      firstName: 'Ayşe',
      lastName: 'Boşta',
      sicilNo: 'T-002',
    });

    await repos.units.assignPersonnel(unit.id, assigned.id);

    const available = await repos.units.getUnassignedPersonnel(institution.id);
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe(unassigned.id);
  });
});
