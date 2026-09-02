import { useAuthStore } from '@/features/auth/store/authStore';

/** Oturumdaki JWT — yoksa null. */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/** Oturumdaki JWT — yoksa hata fırlatır. */
export function requireAccessToken(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
  }
  return token;
}

/** Aktif kurumun (tenant) kimliği. */
export function getTenantId(): string | null {
  const state = useAuthStore.getState();
  return state.tenant?.id ?? state.institutionId ?? null;
}

/** Aktif kurumun kısa adı — üretilen kimliklerde alan adı olarak kullanılır. */
export function getTenantSlug(): string | null {
  return useAuthStore.getState().tenant?.slug ?? null;
}

/** Sunucu oturumu açık mı? */
export function hasServerSession(): boolean {
  const state = useAuthStore.getState();
  return state.authMode === 'server' && Boolean(state.accessToken);
}
