import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 2;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS shift_patterns (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      name TEXT NOT NULL,
      reference_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    CREATE TABLE IF NOT EXISTS shift_pattern_days (
      id TEXT PRIMARY KEY NOT NULL,
      pattern_id TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      shift_type TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      FOREIGN KEY (pattern_id) REFERENCES shift_patterns(id)
    );

    CREATE TABLE IF NOT EXISTS shift_groups (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pattern_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (pattern_id) REFERENCES shift_patterns(id)
    );

    CREATE TABLE IF NOT EXISTS personnel_shift_assignments (
      id TEXT PRIMARY KEY NOT NULL,
      personnel_id TEXT NOT NULL,
      shift_group_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id),
      FOREIGN KEY (shift_group_id) REFERENCES shift_groups(id)
    );

    CREATE INDEX IF NOT EXISTS idx_shift_groups_unit ON shift_groups(unit_id);
    CREATE INDEX IF NOT EXISTS idx_psa_personnel ON personnel_shift_assignments(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_psa_group ON personnel_shift_assignments(shift_group_id);
  `);
}
