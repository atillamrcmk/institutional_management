import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import { addDaysToDateString } from '@/shared/utils/id';

export const version = 5;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    ALTER TABLE shift_groups ADD COLUMN cycle_start_date TEXT;
  `);

  const rows = await db.getAllAsync<{
    id: string;
    cycle_offset: number;
    reference_date: string;
  }>(
    `SELECT sg.id, sg.cycle_offset, sp.reference_date
     FROM shift_groups sg
     INNER JOIN shift_patterns sp ON sp.id = sg.pattern_id`,
  );

  for (const row of rows) {
    const offset = row.cycle_offset ?? 0;
    const cycleStartDate = addDaysToDateString(row.reference_date, -offset);
    await db.runAsync(
      'UPDATE shift_groups SET cycle_start_date = ? WHERE id = ?',
      cycleStartDate,
      row.id,
    );
  }
}
