import { ApiError, apiRequest } from '@/shared/api/client';
import { requireAccessToken } from '@/shared/api/session';

type RequestOptions = {
  method?: string;
  body?: unknown;
};

/** Oturum jetonunu otomatik ekleyen istek yardımcısı. */
export function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, token: requireAccessToken() });
}

/** 404 durumunda hata yerine `null` döner — repository sözleşmeleri böyle bekliyor. */
export async function authRequestOrNull<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  try {
    return await authRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Boş/undefined değerleri atlayarak sorgu dizesi üretir. */
export function queryString(
  params: Record<string, string | number | null | undefined>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const stringValue = String(value).trim();
    if (!stringValue) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(stringValue)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
