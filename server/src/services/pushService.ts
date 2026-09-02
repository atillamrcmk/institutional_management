import admin from 'firebase-admin';

let firebaseReady = false;

function initFirebase(): boolean {
  if (firebaseReady) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return false;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  firebaseReady = true;
  return true;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function sendExpoPush(tokens: string[], payload: PushPayload): Promise<void> {
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
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
  });
}

async function sendFcmPush(tokens: string[], payload: PushPayload): Promise<void> {
  if (!initFirebase()) {
    console.warn('[push] FIREBASE_* ortam değişkenleri tanımlı değil; FCM gönderilmedi.');
    return;
  }
  if (tokens.length === 0) return;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data ?? {},
    android: {
      priority: 'high',
      notification: {
        channelId: 'messages',
      },
    },
  });

  if (response.failureCount > 0) {
    const errors = response.responses
      .map((item, index) => (item.success ? null : { token: tokens[index], error: item.error?.message }))
      .filter(Boolean);
    console.error('[push] FCM hataları:', errors);
  }
}

export function isFirebasePushConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

export async function sendPushNotifications(
  tokens: string[],
  payload: PushPayload,
): Promise<void> {
  if (tokens.length === 0) return;

  const expoTokens = tokens.filter((token) => token.startsWith('ExponentPushToken'));
  const fcmTokens = tokens.filter((token) => !token.startsWith('ExponentPushToken'));

  await Promise.all([
    expoTokens.length > 0 ? sendExpoPush(expoTokens, payload) : Promise.resolve(),
    fcmTokens.length > 0 ? sendFcmPush(fcmTokens, payload) : Promise.resolve(),
  ]);
}
