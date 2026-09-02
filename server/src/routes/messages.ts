import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { sendPushNotifications } from '../services/pushService.js';

export const messagesRouter = Router();

type AudienceType = 'UNIT' | 'PERSONNEL' | 'ALL_PERSONNEL' | 'ADMINS';

interface CreateMessageBody {
  id?: string;
  subject: string;
  body: string;
  audienceType: AudienceType;
  unitId?: string | null;
  personnelIds?: string[];
}

async function resolveRecipients(
  pool: pg.Pool,
  audienceType: AudienceType,
  unitId?: string | null,
  personnelIds: string[] = [],
): Promise<Array<{ userId: string | null; personnelId: string | null }>> {
  switch (audienceType) {
    case 'ADMINS': {
      const result = await pool.query<{ id: string; personnel_id: string | null }>(
        `SELECT id, personnel_id FROM users
         WHERE role IN ('INSTITUTION_ADMIN', 'UNIT_MANAGER') AND is_active = TRUE`,
      );
      return result.rows.map((row) => ({
        userId: row.id,
        personnelId: row.personnel_id,
      }));
    }
    case 'ALL_PERSONNEL': {
      const result = await pool.query<{ id: string; personnel_id: string | null }>(
        `SELECT id, personnel_id FROM users WHERE role = 'PERSONNEL' AND is_active = TRUE`,
      );
      return result.rows.map((row) => ({
        userId: row.id,
        personnelId: row.personnel_id,
      }));
    }
    case 'UNIT': {
      if (!unitId) return [];
      const result = await pool.query<{ user_id: string | null; personnel_id: string }>(
        `SELECT u.id AS user_id, p.id AS personnel_id
         FROM personnel_unit_history puh
         INNER JOIN personnel p ON p.id = puh.personnel_id
         LEFT JOIN users u ON u.personnel_id = p.id
         WHERE puh.unit_id = $1 AND puh.ended_at IS NULL`,
        [unitId],
      );
      return result.rows.map((row) => ({
        userId: row.user_id,
        personnelId: row.personnel_id,
      }));
    }
    case 'PERSONNEL': {
      if (personnelIds.length === 0) return [];
      const result = await pool.query<{ user_id: string | null; personnel_id: string }>(
        `SELECT u.id AS user_id, p.id AS personnel_id
         FROM personnel p
         LEFT JOIN users u ON u.personnel_id = p.id
         WHERE p.id = ANY($1::text[])`,
        [personnelIds],
      );
      return result.rows.map((row) => ({
        userId: row.user_id,
        personnelId: row.personnel_id,
      }));
    }
    default:
      return [];
  }
}

async function tokensForUsers(pool: pg.Pool, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const result = await pool.query<{ token: string }>(
    `SELECT DISTINCT token FROM device_push_tokens WHERE user_id = ANY($1::text[])`,
    [userIds],
  );
  return result.rows.map((row) => row.token);
}

messagesRouter.use(requireAuth);

messagesRouter.post('/', async (req: AuthedRequest, res) => {
  const body = req.body as CreateMessageBody;
  const pool = req.tenantPool!;
  const auth = req.auth!;

  if (!body.subject?.trim() || !body.body?.trim() || !body.audienceType) {
    res.status(400).json({ error: 'Eksik alanlar' });
    return;
  }

  if (body.audienceType === 'ADMINS' && auth.role === 'PERSONNEL') {
    const can = await pool.query(
      `SELECT can_message_admins FROM users WHERE id = $1`,
      [auth.userId],
    );
    if (!can.rows[0]?.can_message_admins) {
      res.status(403).json({ error: 'Yöneticilere mesaj yetkiniz yok' });
      return;
    }
  }

  const messageId = body.id ?? randomUUID();
  const recipients = await resolveRecipients(
    pool,
    body.audienceType,
    body.unitId,
    body.personnelIds ?? [],
  );

  if (recipients.length === 0) {
    res.status(400).json({ error: 'Alıcı bulunamadı' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO messages (
        id, sender_user_id, sender_display_name, subject, body, audience_type, unit_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING`,
      [
        messageId,
        auth.userId,
        auth.displayName || 'Kullanıcı',
        body.subject.trim(),
        body.body.trim(),
        body.audienceType,
        body.unitId ?? null,
      ],
    );

    for (const recipient of recipients) {
      await client.query(
        `INSERT INTO message_recipients (id, message_id, user_id, personnel_id)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), messageId, recipient.userId, recipient.personnelId],
      );
    }

    await client.query('COMMIT');

    const userIds = recipients
      .map((recipient) => recipient.userId)
      .filter((id): id is string => Boolean(id));

    const tokens = await tokensForUsers(pool, userIds);
    if (tokens.length > 0) {
      await sendPushNotifications(tokens, {
        title: body.subject.trim(),
        body: body.body.trim(),
        data: { messageId, type: 'message' },
      });
    }

    res.status(201).json({ id: messageId, recipientCount: recipients.length });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

messagesRouter.get('/inbox', async (req: AuthedRequest, res) => {
  const pool = req.tenantPool!;
  const auth = req.auth!;

  const userRow = await pool.query<{ personnel_id: string | null }>(
    `SELECT personnel_id FROM users WHERE id = $1`,
    [auth.userId],
  );
  const personnelId = userRow.rows[0]?.personnel_id ?? null;

  const result = await pool.query(
    `SELECT m.*, mr.id AS recipient_id, mr.read_at
     FROM message_recipients mr
     INNER JOIN messages m ON m.id = mr.message_id
     WHERE mr.user_id = $1 OR ($2::text IS NOT NULL AND mr.personnel_id = $2::text)
     ORDER BY m.created_at DESC`,
    [auth.userId, personnelId],
  );

  res.json(result.rows);
});
