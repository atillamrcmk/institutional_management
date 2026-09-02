import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getRepositories } from '@/shared/repositories';
import type { SendMessageInput, User } from '@/shared/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Mesajlar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenData.data;

  await getRepositories().messages.savePushToken(userId, token, Platform.OS);

  if (API_URL) {
    await fetch(`${API_URL}/api/v1/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
      body: JSON.stringify({
        userId,
        token,
        platform: Platform.OS,
      }),
    }).catch(() => undefined);
  }

  return token;
}

export async function sendPushNotifications(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  if (tokens.length === 0) return;

  if (API_URL) {
    await fetch(`${API_URL}/api/v1/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
      body: JSON.stringify({
        tokens,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      }),
    }).catch(() => undefined);
    return;
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default' as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  }).catch(() => undefined);
}

export async function syncMessageToServer(
  institutionId: string,
  sender: User,
  input: SendMessageInput,
  messageId: string,
): Promise<void> {
  if (!API_URL) return;

  await fetch(`${API_URL}/api/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    },
    body: JSON.stringify({
      id: messageId,
      institutionId,
      senderUserId: sender.id,
      senderDisplayName: sender.displayName,
      subject: input.subject,
      body: input.body,
      audienceType: input.audienceType,
      unitId: input.unitId ?? null,
      personnelIds: input.personnelIds ?? [],
    }),
  }).catch(() => undefined);
}
