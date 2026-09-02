import { create } from 'zustand';
import type { User, UserRole } from '@/shared/types';
import { getRepositories } from '@/shared/repositories';
import { deleteAuthItem, getAuthItem, setAuthItem } from './authStorage';
import {
  mapServerUserToAppUser,
  serverCreateTenant,
  serverLogin,
  serverMe,
  type CreateTenantPayload,
  type ServerTenant,
} from '../services/serverAuthApi';

const AUTH_KEY = 'auth_user_id';
const AUTH_MODE_KEY = 'auth_mode';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_TENANT_KEY = 'auth_tenant_json';

export type AuthMode = 'local' | 'server';

interface AuthState {
  user: User | null;
  institutionId: string | null;
  accessToken: string | null;
  authMode: AuthMode;
  tenant: ServerTenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  login: (userId: string, pin?: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  createTenantAndLogin: (payload: CreateTenantPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  resetAfterSeed: () => Promise<void>;
  isAdminRole: () => boolean;
  isServerMode: () => boolean;
}

async function clearServerSession(): Promise<void> {
  await deleteAuthItem(AUTH_TOKEN_KEY);
  await deleteAuthItem(AUTH_TENANT_KEY);
  await deleteAuthItem(AUTH_MODE_KEY);
  await deleteAuthItem(AUTH_KEY);
}

async function persistServerSession(
  token: string,
  user: User,
  tenant: ServerTenant,
): Promise<void> {
  await setAuthItem(AUTH_MODE_KEY, 'server');
  await setAuthItem(AUTH_TOKEN_KEY, token);
  await setAuthItem(AUTH_KEY, user.id);
  await setAuthItem(AUTH_TENANT_KEY, JSON.stringify(tenant));
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  institutionId: null,
  accessToken: null,
  authMode: 'local',
  tenant: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const mode = ((await getAuthItem(AUTH_MODE_KEY)) as AuthMode | null) ?? 'local';

      if (mode === 'server') {
        const token = await getAuthItem(AUTH_TOKEN_KEY);
        const tenantJson = await getAuthItem(AUTH_TENANT_KEY);
        if (!token || !tenantJson) {
          await clearServerSession();
          set({ isLoading: false });
          return;
        }

        const tenant = JSON.parse(tenantJson) as ServerTenant;
        const me = await serverMe(token);
        const user = mapServerUserToAppUser(me.user);

        set({
          authMode: 'server',
          accessToken: token,
          tenant,
          user,
          institutionId: me.user.tenantId,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      const userId = await getAuthItem(AUTH_KEY);
      if (!userId) {
        set({ isLoading: false });
        return;
      }
      const repos = getRepositories();
      const institution = await repos.institution.getFirst();
      if (!institution) {
        await deleteAuthItem(AUTH_KEY);
        set({ isLoading: false });
        return;
      }
      const user = await repos.auth.getById(userId);
      if (!user) {
        await deleteAuthItem(AUTH_KEY);
        set({ isLoading: false });
        return;
      }
      set({
        authMode: 'local',
        accessToken: null,
        tenant: null,
        user,
        institutionId: institution.id,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await clearServerSession().catch(() => undefined);
      set({
        user: null,
        institutionId: null,
        accessToken: null,
        authMode: 'local',
        tenant: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (userId, pin) => {
    const repos = getRepositories();
    const institution = await repos.institution.getFirst();
    if (!institution) return false;

    const user = await repos.auth.login(userId, pin);
    if (!user) return false;

    await setAuthItem(AUTH_MODE_KEY, 'local');
    await setAuthItem(AUTH_KEY, user.id);
    await deleteAuthItem(AUTH_TOKEN_KEY);
    await deleteAuthItem(AUTH_TENANT_KEY);

    set({
      authMode: 'local',
      accessToken: null,
      tenant: null,
      user,
      institutionId: institution.id,
      isAuthenticated: true,
    });
    return true;
  },

  loginWithEmail: async (email, password) => {
    const result = await serverLogin(email.trim(), password);
    const user = mapServerUserToAppUser(result.user);
    await persistServerSession(result.token, user, result.tenant);
    set({
      authMode: 'server',
      accessToken: result.token,
      tenant: result.tenant,
      user,
      institutionId: result.tenant.id,
      isAuthenticated: true,
    });
    return true;
  },

  createTenantAndLogin: async (payload) => {
    const result = await serverCreateTenant(payload);
    const user = mapServerUserToAppUser(result.user);
    await persistServerSession(result.token, user, result.tenant);
    set({
      authMode: 'server',
      accessToken: result.token,
      tenant: result.tenant,
      user,
      institutionId: result.tenant.id,
      isAuthenticated: true,
    });
    return true;
  },

  logout: async () => {
    await clearServerSession();
    set({
      user: null,
      institutionId: null,
      accessToken: null,
      authMode: 'local',
      tenant: null,
      isAuthenticated: false,
    });
  },

  resetAfterSeed: async () => {
    await clearServerSession();
    set({
      user: null,
      institutionId: null,
      accessToken: null,
      authMode: 'local',
      tenant: null,
      isAuthenticated: false,
    });
  },

  isAdminRole: () => {
    const role = get().user?.role;
    return role === 'INSTITUTION_ADMIN' || role === 'UNIT_MANAGER';
  },

  isServerMode: () => get().authMode === 'server',
}));

export function isAdminRole(role: UserRole): boolean {
  return role === 'INSTITUTION_ADMIN' || role === 'UNIT_MANAGER';
}
