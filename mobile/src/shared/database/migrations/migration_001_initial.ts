import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 1;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personnel (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      sicil_no TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      parent_id TEXT,
      name TEXT NOT NULL,
      minimum_staff INTEGER NOT NULL DEFAULT 0,
      manager_personnel_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (parent_id) REFERENCES units(id),
      FOREIGN KEY (manager_personnel_id) REFERENCES personnel(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      personnel_id TEXT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (personnel_id) REFERENCES personnel(id)
    );

    CREATE TABLE IF NOT EXISTS personnel_unit_history (
      id TEXT PRIMARY KEY NOT NULL,
      personnel_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE INDEX IF NOT EXISTS idx_personnel_institution ON personnel(institution_id);
    CREATE INDEX IF NOT EXISTS idx_units_institution ON units(institution_id);
    CREATE INDEX IF NOT EXISTS idx_units_parent ON units(parent_id);
    CREATE INDEX IF NOT EXISTS idx_puh_personnel ON personnel_unit_history(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_puh_unit ON personnel_unit_history(unit_id);
  `);
}
