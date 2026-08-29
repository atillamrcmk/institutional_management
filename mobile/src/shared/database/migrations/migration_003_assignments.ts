import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 3;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS personnel_absences (
      id TEXT PRIMARY KEY NOT NULL,
      personnel_id TEXT NOT NULL,
      type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id)
    );

    CREATE TABLE IF NOT EXISTS task_types (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      task_type_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      required_personnel_count INTEGER NOT NULL,
      manager_personnel_id TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (task_type_id) REFERENCES task_types(id),
      FOREIGN KEY (manager_personnel_id) REFERENCES personnel(id)
    );

    CREATE TABLE IF NOT EXISTS assignment_personnel (
      id TEXT PRIMARY KEY NOT NULL,
      assignment_id TEXT NOT NULL,
      personnel_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (personnel_id) REFERENCES personnel(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_absences_personnel ON personnel_absences(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
    CREATE INDEX IF NOT EXISTS idx_ap_assignment ON assignment_personnel(assignment_id);
  `);
}
