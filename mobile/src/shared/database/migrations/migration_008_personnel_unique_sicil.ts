import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import { nowIso } from '@/shared/utils/id';

export const version = 8;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  const ts = nowIso();

  await db.runAsync(
    `UPDATE personnel
     SET status = 'INACTIVE', updated_at = ?
     WHERE status = 'ACTIVE'
     AND id IN (
       SELECT p.id
       FROM personnel p
       WHERE p.status = 'ACTIVE'
       AND EXISTS (
         SELECT 1
         FROM personnel newer
         WHERE newer.institution_id = p.institution_id
           AND newer.sicil_no = p.sicil_no
           AND newer.status = 'ACTIVE'
           AND newer.created_at > p.created_at
       )
     )`,
    ts,
  );

  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_active_sicil
    ON personnel(institution_id, sicil_no)
    WHERE status = 'ACTIVE';
  `);
}
