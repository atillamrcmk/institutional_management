import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getRepositories } from '@/shared/repositories';
import type { SendMessageInput, User } from '@/shared/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

type PushProvider = 'firebase' | 'expo';

function resolvePushProvider(): PushProvider {
  const fromExtra = Constants.expoConfig?.extra?.pushProvider;
  const fromEnv = process.env.EXPO_PUBLIC_PUSH_PROVIDER;
  const value = (fromEnv ?? fromExtra ?? 'firebase').toLowerCase();
  return value === 'expo' ? 'expo' : 'firebase';
}

function resolveExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function obtainPushToken(provider: PushProvider): Promise<string> {
  if (provider === 'expo') {
    const projectId = resolveExpoProjectId();
    if (!projectId) {
      throw new Error(
        'Expo push için EXPO_PUBLIC_EAS_PROJECT_ID gerekli. Firebase kullanmak için EXPO_PUBLIC_PUSH_PROVIDER=firebase bırakın.',
      );
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  }

  // Firebase FCM (Android) / APNs (iOS) — google-services.json + development/production build gerekir.
  const tokenData = await Notifications.getDevicePushTokenAsync();
  return tokenData.data;
}

export async function registerPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) {
      console.warn('[push] Emülatörde push token alınamaz; fiziksel cihaz kullanın.');
    }
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

  const provider = resolvePushProvider();

  try {
    const token = await obtainPushToken(provider);
    await getRepositories().messages.savePushToken(userId, token, Platform.OS);

    if (__DEV__) {
      console.log(`[push] Token kaydedildi (${provider}):`, token.slice(0, 24), '...');
    }

    return token;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `[push] Token alınamadı (${provider}). Firebase için google-services.json + eas build gerekir:`,
        error,
      );
    }
    return null;
  }
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
