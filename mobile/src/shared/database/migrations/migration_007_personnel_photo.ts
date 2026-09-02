import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 7;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    ALTER TABLE personnel ADD COLUMN photo_uri TEXT;
  `);
}
