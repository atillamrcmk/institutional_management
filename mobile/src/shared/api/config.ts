/** Canlı API tabanı — Expo public env */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://personel-api.atillamercimek.com'
).replace(/\/$/, '');

/**
 * Yalnızca EXPO_PUBLIC_API_URL tanımlıysa canlı sunucu kullanılır; tanımsız ortamlarda
 * (ör. testler, çevrimdışı derlemeler) uygulama yerel SQLite deposuna düşer.
 */
export function isServerApiConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_API_URL?.trim());
}
