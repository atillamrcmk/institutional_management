import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type { InboxMessage, Message, SendMessageInput } from '@/shared/types';
import type { MessageRepository } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    senderUserId: row.sender_user_id as string,
    senderDisplayName: row.sender_display_name as string,
    subject: row.subject as string,
    body: row.body as string,
    audienceType: row.audience_type as Message['audienceType'],
    unitId: (row.unit_id as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapInboxMessage(row: Record<string, unknown>): InboxMessage {
  return {
    ...mapMessage(row),
    recipientId: row.recipient_id as string,
    readAt: (row.read_at as string) ?? null,
  };
}

export class SQLiteMessageRepository implements MessageRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async create(
    institutionId: string,
    sender: { userId: string; displayName: string },
    input: SendMessageInput,
    recipients: Array<{ userId?: string | null; personnelId?: string | null }>,
  ): Promise<Message> {
    const messageId = generateId();
    const ts = nowIso();

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO messages (
          id, institution_id, sender_user_id, sender_display_name,
          subject, body, audience_type, unit_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        messageId,
        institutionId,
        sender.userId,
        sender.displayName,
        input.subject.trim(),
        input.body.trim(),
        input.audienceType,
        input.unitId ?? null,
        ts,
      );

      for (const recipient of recipients) {
        await this.db.runAsync(
          `INSERT INTO message_recipients (id, message_id, user_id, personnel_id, read_at, created_at)
           VALUES (?, ?, ?, ?, NULL, ?)`,
          generateId(),
          messageId,
          recipient.userId ?? null,
          recipient.personnelId ?? null,
          ts,
        );
      }
    });

    const message = await this.getById(messageId);
    if (!message) throw new Error('Mesaj oluşturulamadı');
    return message;
  }

  async getInbox(
    institutionId: string,
    userId: string,
    personnelId: string | null,
  ): Promise<InboxMessage[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT m.*, mr.id AS recipient_id, mr.read_at
       FROM message_recipients mr
       INNER JOIN messages m ON m.id = mr.message_id
       WHERE m.institution_id = ?
         AND (mr.user_id = ? OR (? IS NOT NULL AND mr.personnel_id = ?))
       ORDER BY m.created_at DESC`,
      institutionId,
      userId,
      personnelId,
      personnelId,
    );
    return rows.map(mapInboxMessage);
  }

  async getSent(userId: string): Promise<Message[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM messages WHERE sender_user_id = ? ORDER BY created_at DESC`,
      userId,
    );
    return rows.map(mapMessage);
  }

  async getById(id: string): Promise<Message | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM messages WHERE id = ?',
      id,
    );
    return row ? mapMessage(row) : null;
  }

  async markRead(recipientId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE message_recipients SET read_at = ? WHERE id = ? AND read_at IS NULL',
      nowIso(),
      recipientId,
    );
  }

  async getUnreadCount(
    institutionId: string,
    userId: string,
    personnelId: string | null,
  ): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM message_recipients mr
       INNER JOIN messages m ON m.id = mr.message_id
       WHERE m.institution_id = ?
         AND mr.read_at IS NULL
         AND (mr.user_id = ? OR (? IS NOT NULL AND mr.personnel_id = ?))`,
      institutionId,
      userId,
      personnelId,
      personnelId,
    );
    return row?.count ?? 0;
  }

  async savePushToken(userId: string, token: string, platform: string): Promise<void> {
    const existing = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM device_push_tokens WHERE user_id = ? AND token = ?',
      userId,
      token,
    );
    const ts = nowIso();
    if (existing) {
      await this.db.runAsync(
        'UPDATE device_push_tokens SET updated_at = ?, platform = ? WHERE id = ?',
        ts,
        platform,
        existing.id,
      );
      return;
    }

    await this.db.runAsync(
      `INSERT INTO device_push_tokens (id, user_id, token, platform, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      generateId(),
      userId,
      token,
      platform,
      ts,
    );
  }

  async getPushTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const placeholders = userIds.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<{ token: string }>(
      `SELECT DISTINCT token FROM device_push_tokens WHERE user_id IN (${placeholders})`,
      ...userIds,
    );
    return rows.map((r) => r.token);
  }
}
