import { randomUUID } from 'node:crypto';
import type pg from 'pg';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
}

/**
 * Denetim kaydı yazar. Asla çağıran isteği düşürmez — hata yalnızca loglanır.
 */
export async function writeAuditLog(pool: pg.Pool, entry: AuditEntry): Promise<void> {
  try {
    const details =
      entry.details === undefined || entry.details === null
        ? null
        : typeof entry.details === 'string'
          ? entry.details
          : JSON.stringify(entry.details);

    await pool.query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        entry.userId ?? null,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        details,
      ],
    );
  } catch (error) {
    console.error('audit_logs yazılamadı:', error);
  }
}
