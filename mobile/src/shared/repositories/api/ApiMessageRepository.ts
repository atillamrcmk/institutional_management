import {
  mapInboxMessage,
  mapMessage,
  type InboxMessageRow,
  type MessageRow,
} from '@/shared/api/mappers';
import type { InboxMessage, Message, SendMessageInput } from '@/shared/types';
import type { MessageRepository } from '../interfaces';
import { authRequest, authRequestOrNull } from './request';

const BASE = '/api/v1/messages';

export class ApiMessageRepository implements MessageRepository {
  /**
   * Sunucu okundu bilgisini mesaj kimliği üzerinden işaretler, arayüz ise alıcı kaydının
   * kimliğini taşır. Gelen kutusu okundukça eşleşme burada tutulur.
   */
  private readonly messageIdByRecipientId = new Map<string, string>();

  async create(
    institutionId: string,
    _sender: { userId: string; displayName: string },
    input: SendMessageInput,
  ): Promise<Message> {
    // Alıcılar sunucuda çözülür; gönderen bilgisi oturum jetonundan okunur.
    const created = await authRequest<{ id: string; recipientCount: number }>(BASE, {
      method: 'POST',
      body: {
        subject: input.subject.trim(),
        body: input.body.trim(),
        audienceType: input.audienceType,
        unitId: input.unitId ?? null,
        personnelIds: input.personnelIds ?? [],
      },
    });

    const message = await this.getById(created.id);
    if (!message) throw new Error('Mesaj oluşturulamadı');
    return message;
  }

  async getInbox(institutionId: string): Promise<InboxMessage[]> {
    const rows = await authRequest<InboxMessageRow[]>(`${BASE}/inbox`);
    for (const row of rows) {
      if (row.recipient_id) this.messageIdByRecipientId.set(row.recipient_id, row.id);
    }
    return rows.map((row) => mapInboxMessage(row, institutionId));
  }

  async getSent(): Promise<Message[]> {
    const rows = await authRequest<MessageRow[]>(`${BASE}/sent`);
    return rows.map((row) => mapMessage(row));
  }

  async getById(id: string): Promise<Message | null> {
    const row = await authRequestOrNull<InboxMessageRow>(`${BASE}/${encodeURIComponent(id)}`);
    if (!row) return null;
    if (row.recipient_id) this.messageIdByRecipientId.set(row.recipient_id, row.id);
    return mapMessage(row);
  }

  async markRead(recipientId: string): Promise<void> {
    const messageId = this.messageIdByRecipientId.get(recipientId) ?? recipientId;
    await authRequest(`${BASE}/${encodeURIComponent(messageId)}/read`, { method: 'POST' });
  }

  async getUnreadCount(): Promise<number> {
    const response = await authRequest<{ count: number }>(`${BASE}/unread-count`);
    return Number(response.count ?? 0);
  }

  async savePushToken(_userId: string, token: string, platform: string): Promise<void> {
    await authRequest('/api/v1/devices/register', {
      method: 'POST',
      body: { token, platform },
    });
  }

  /** Bildirimleri sunucu gönderir; istemcinin jeton listesine erişimi yoktur. */
  async getPushTokensForUsers(): Promise<string[]> {
    return [];
  }
}
