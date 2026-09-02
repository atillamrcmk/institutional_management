import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { hasPermission } from '../services/authService.js';
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

  if (body.audienceType === 'ADMINS') {
    // Personel yöneticilere yalnızca kendisine bu hak tanınmışsa yazabilir.
    if (auth.role === 'PERSONNEL') {
      const can = await pool.query(
        `SELECT can_message_admins FROM users WHERE id = $1`,
        [auth.userId],
      );
      if (!can.rows[0]?.can_message_admins) {
        res.status(403).json({ error: 'Yöneticilere mesaj yetkiniz yok' });
        return;
      }
    }
  } else if (!hasPermission(auth, 'messages.send')) {
    // Toplu duyurular (birim / tüm personel / seçili personel) ayrı izin ister.
    res.status(403).json({ error: 'Toplu mesaj gönderme yetkiniz yok' });
    return;
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

async function personnelIdForUser(pool: pg.Pool, userId: string): Promise<string | null> {
  const result = await pool.query<{ personnel_id: string | null }>(
    `SELECT personnel_id FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0]?.personnel_id ?? null;
}

messagesRouter.get('/inbox', async (req: AuthedRequest, res) => {
  const pool = req.tenantPool!;
  const auth = req.auth!;
  const personnelId = await personnelIdForUser(pool, auth.userId);

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

/** Kullanıcının gönderdiği mesajlar + alıcı/okunma sayıları. */
messagesRouter.get('/sent', async (req: AuthedRequest, res) => {
  const result = await req.tenantPool!.query(
    `SELECT m.*,
            (SELECT COUNT(*)::int FROM message_recipients mr WHERE mr.message_id = m.id)
              AS recipient_count,
            (SELECT COUNT(*)::int FROM message_recipients mr
              WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL) AS read_count
       FROM messages m
      WHERE m.sender_user_id = $1
      ORDER BY m.created_at DESC`,
    [req.auth!.userId],
  );

  res.json(result.rows);
});

/** Okunmamış mesaj sayısı. */
messagesRouter.get('/unread-count', async (req: AuthedRequest, res) => {
  const pool = req.tenantPool!;
  const auth = req.auth!;
  const personnelId = await personnelIdForUser(pool, auth.userId);

  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM message_recipients mr
      WHERE mr.read_at IS NULL
        AND (mr.user_id = $1 OR ($2::text IS NOT NULL AND mr.personnel_id = $2::text))`,
    [auth.userId, personnelId],
  );

  res.json({ count: Number(result.rows[0]?.count ?? 0) });
});

/** Tek mesaj — yalnızca gönderen veya alıcı görebilir. */
messagesRouter.get('/:id', async (req: AuthedRequest, res) => {
  const pool = req.tenantPool!;
  const auth = req.auth!;
  const personnelId = await personnelIdForUser(pool, auth.userId);

  const result = await pool.query(
    `SELECT m.*, mr.id AS recipient_id, mr.read_at
       FROM messages m
       LEFT JOIN message_recipients mr
         ON mr.message_id = m.id
        AND (mr.user_id = $2 OR ($3::text IS NOT NULL AND mr.personnel_id = $3::text))
      WHERE m.id = $1
      LIMIT 1`,
    [req.params.id, auth.userId, personnelId],
  );

  const message = result.rows[0];
  if (!message) {
    res.status(404).json({ error: 'Mesaj bulunamadı' });
    return;
  }

  const isSender = message.sender_user_id === auth.userId;
  if (!isSender && !message.recipient_id) {
    res.status(403).json({ error: 'Bu mesaja erişiminiz yok' });
    return;
  }

  if (isSender) {
    const recipients = await pool.query(
      `SELECT mr.id, mr.user_id, mr.personnel_id, mr.read_at,
              p.first_name, p.last_name
         FROM message_recipients mr
         LEFT JOIN personnel p ON p.id = mr.personnel_id
        WHERE mr.message_id = $1`,
      [req.params.id],
    );
    res.json({ ...message, recipients: recipients.rows });
    return;
  }

  res.json(message);
});

/** Mesajı okundu olarak işaretle (yalnızca kendi alıcı kaydını). */
messagesRouter.post('/:id/read', async (req: AuthedRequest, res) => {
  const pool = req.tenantPool!;
  const auth = req.auth!;
  const personnelId = await personnelIdForUser(pool, auth.userId);

  const result = await pool.query(
    `UPDATE message_recipients SET read_at = NOW()
      WHERE message_id = $1
        AND read_at IS NULL
        AND (user_id = $2 OR ($3::text IS NOT NULL AND personnel_id = $3::text))
      RETURNING id, read_at`,
    [req.params.id, auth.userId, personnelId],
  );

  if (!result.rowCount) {
    const exists = await pool.query(
      `SELECT id FROM message_recipients
        WHERE message_id = $1
          AND (user_id = $2 OR ($3::text IS NOT NULL AND personnel_id = $3::text))`,
      [req.params.id, auth.userId, personnelId],
    );
    if (!exists.rowCount) {
      res.status(404).json({ error: 'Mesaj bulunamadı' });
      return;
    }
    res.json({ ok: true, alreadyRead: true });
    return;
  }

  res.json({ ok: true, readAt: result.rows[0].read_at });
});
