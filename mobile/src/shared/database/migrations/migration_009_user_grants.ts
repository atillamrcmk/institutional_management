import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 9;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_grants (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      unit_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_grants_unique
    ON user_grants(user_id, permission, COALESCE(unit_id, ''));
  `);
}
