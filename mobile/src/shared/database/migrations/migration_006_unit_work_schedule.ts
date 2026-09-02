import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 6;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    ALTER TABLE units ADD COLUMN work_schedule_type TEXT DEFAULT 'OFFICE';
    ALTER TABLE units ADD COLUMN office_start_time TEXT DEFAULT '08:00';
    ALTER TABLE units ADD COLUMN office_end_time TEXT DEFAULT '17:00';
  `);

  await db.runAsync(`
    UPDATE units
    SET work_schedule_type = 'SHIFT'
    WHERE id IN (SELECT DISTINCT unit_id FROM shift_groups)
  `);
}
