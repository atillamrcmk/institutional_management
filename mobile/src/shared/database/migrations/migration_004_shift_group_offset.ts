import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 4;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    ALTER TABLE shift_groups ADD COLUMN cycle_offset INTEGER NOT NULL DEFAULT 0;
  `);
}
