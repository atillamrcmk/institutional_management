import { getRepositories, isUsingApiRepositories } from '@/shared/repositories';
import type { Message, MessageAudienceType, SendMessageInput, User } from '@/shared/types';
import { isAdminRole } from '@/features/auth/store/authStore';
import { sendPushNotifications } from './pushNotificationService';
import { syncMessageToServer } from './messageApi';

export interface ResolvedRecipient {
  userId?: string | null;
  personnelId?: string | null;
}

async function resolveAdminRecipients(institutionId: string): Promise<ResolvedRecipient[]> {
  const repos = getRepositories();
  const admins = await repos.auth.getUsersByRole(institutionId, [
    'INSTITUTION_ADMIN',
    'UNIT_MANAGER',
  ]);
  return admins.map((user) => ({ userId: user.id, personnelId: user.personnelId }));
}

async function resolvePersonnelRecipients(
  institutionId: string,
  personnelIds: string[],
): Promise<ResolvedRecipient[]> {
  const repos = getRepositories();
  const recipients: ResolvedRecipient[] = [];

  for (const personnelId of personnelIds) {
    const user = await repos.auth.getUserByPersonnelId(personnelId);
    recipients.push({
      userId: user?.id ?? null,
      personnelId,
    });
  }

  return recipients;
}

async function resolveUnitRecipients(
  institutionId: string,
  unitId: string,
): Promise<ResolvedRecipient[]> {
  const repos = getRepositories();
  const personnel = await repos.units.getActivePersonnelForUnit(unitId);
  return resolvePersonnelRecipients(institutionId, personnel.map((p) => p.id));
}

async function resolveAllPersonnelRecipients(institutionId: string): Promise<ResolvedRecipient[]> {
  const repos = getRepositories();
  const personnel = await repos.personnel.getAll(institutionId);
  return resolvePersonnelRecipients(
    institutionId,
    personnel.filter((p) => p.status === 'ACTIVE').map((p) => p.id),
  );
}

export async function resolveRecipients(
  institutionId: string,
  input: SendMessageInput,
): Promise<ResolvedRecipient[]> {
  switch (input.audienceType) {
    case 'ADMINS':
      return resolveAdminRecipients(institutionId);
    case 'UNIT':
      if (!input.unitId) throw new Error('Birim seçilmelidir.');
      return resolveUnitRecipients(institutionId, input.unitId);
    case 'PERSONNEL':
      if (!input.personnelIds?.length) throw new Error('En az bir personel seçilmelidir.');
      return resolvePersonnelRecipients(institutionId, input.personnelIds);
    case 'ALL_PERSONNEL':
      return resolveAllPersonnelRecipients(institutionId);
    default:
      throw new Error('Geçersiz alıcı türü.');
  }
}

function assertCanSend(sender: User, input: SendMessageInput): void {
  if (input.audienceType === 'ADMINS') {
    if (!sender.canMessageAdmins) {
      throw new Error('Yöneticilere mesaj gönderme yetkiniz yok.');
    }
    return;
  }

  if (!isAdminRole(sender.role)) {
    throw new Error('Bu mesajı gönderme yetkiniz yok.');
  }
}

export async function sendMessage(
  institutionId: string,
  sender: User,
  input: SendMessageInput,
): Promise<Message> {
  assertCanSend(sender, input);

  const repos = getRepositories();

  // Sunucu modunda alıcı çözümü, kayıt ve bildirim gönderimi API tarafında yapılır.
  if (isUsingApiRepositories()) {
    return repos.messages.create(
      institutionId,
      { userId: sender.id, displayName: sender.displayName },
      input,
      [],
    );
  }

  const recipients = await resolveRecipients(institutionId, input);
  const uniqueRecipients = dedupeRecipients(recipients);

  if (uniqueRecipients.length === 0) {
    throw new Error('Mesaj için alıcı bulunamadı.');
  }

  const message = await repos.messages.create(
    institutionId,
    { userId: sender.id, displayName: sender.displayName },
    input,
    uniqueRecipients,
  );

  const recipientUserIds = uniqueRecipients
    .map((r) => r.userId)
    .filter((id): id is string => Boolean(id));

  if (recipientUserIds.length > 0) {
    const tokens = await repos.messages.getPushTokensForUsers(recipientUserIds);
    if (tokens.length > 0) {
      await sendPushNotifications(tokens, {
        title: message.subject,
        body: message.body,
        data: { messageId: message.id, type: 'message' },
      });
    }
  }

  await syncMessageToServer(institutionId, sender, input, message.id);

  return message;
}

function dedupeRecipients(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const result: ResolvedRecipient[] = [];

  for (const recipient of recipients) {
    const key = recipient.userId
      ? `u:${recipient.userId}`
      : `p:${recipient.personnelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(recipient);
  }

  return result;
}

export async function getInbox(
  institutionId: string,
  user: User,
): Promise<import('@/shared/types').InboxMessage[]> {
  return getRepositories().messages.getInbox(institutionId, user.id, user.personnelId);
}

export async function getSentMessages(userId: string): Promise<Message[]> {
  return getRepositories().messages.getSent(userId);
}

export async function markMessageRead(recipientId: string): Promise<void> {
  await getRepositories().messages.markRead(recipientId);
}

export async function getUnreadMessageCount(
  institutionId: string,
  user: User,
): Promise<number> {
  return getRepositories().messages.getUnreadCount(
    institutionId,
    user.id,
    user.personnelId,
  );
}

export function getAudienceLabel(audienceType: MessageAudienceType, unitName?: string): string {
  switch (audienceType) {
    case 'UNIT':
      return unitName ? `Birim: ${unitName}` : 'Birim';
    case 'PERSONNEL':
      return 'Seçili personel';
    case 'ALL_PERSONNEL':
      return 'Tüm personel';
    case 'ADMINS':
      return 'Yöneticiler';
    default:
      return audienceType;
  }
}
