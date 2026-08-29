import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import { getDatabase } from '../database';
import * as m001 from './migration_001_initial';
import * as m002 from './migration_002_shift_engine';
import * as m003 from './migration_003_assignments';

import * as m004 from './migration_004_shift_group_offset';

const migrations = [m001, m002, m003, m004];

async function ensureMigrationsTable(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

async function getAppliedVersions(db: SQLiteDatabaseAdapter): Promise<Set<number>> {
  const rows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  return new Set(rows.map((r) => r.version));
}

export async function runMigrations(db?: SQLiteDatabaseAdapter): Promise<void> {
  const database = db ?? (await getDatabase());
  await ensureMigrationsTable(database);
  const applied = await getAppliedVersions(database);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }
    await database.withTransactionAsync(async () => {
      await migration.up(database);
      await database.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        migration.version,
        new Date().toISOString(),
      );
    });
  }
}
