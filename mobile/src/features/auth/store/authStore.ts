import { create } from 'zustand';
import type { User, UserRole } from '@/shared/types';
import { getRepositories } from '@/shared/repositories';
import { deleteAuthItem, getAuthItem, setAuthItem } from './authStorage';

const AUTH_KEY = 'auth_user_id';

interface AuthState {
  user: User | null;
  institutionId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialize: () => Promise<void>;
  login: (userId: string, pin?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetAfterSeed: () => Promise<void>;
  isAdminRole: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  institutionId: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
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
        user,
        institutionId: institution.id,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (userId, pin) => {
    const repos = getRepositories();
    const institution = await repos.institution.getFirst();
    if (!institution) return false;

    const user = await repos.auth.login(userId, pin);
    if (!user) return false;

    await setAuthItem(AUTH_KEY, user.id);
    set({
      user,
      institutionId: institution.id,
      isAuthenticated: true,
    });
    return true;
  },

  logout: async () => {
    await deleteAuthItem(AUTH_KEY);
    set({ user: null, institutionId: null, isAuthenticated: false });
  },

  resetAfterSeed: async () => {
    await deleteAuthItem(AUTH_KEY);
    set({ user: null, institutionId: null, isAuthenticated: false });
  },

  isAdminRole: () => {
    const role = get().user?.role;
    return role === 'INSTITUTION_ADMIN' || role === 'UNIT_MANAGER';
  },
}));

export function isAdminRole(role: UserRole): boolean {
  return role === 'INSTITUTION_ADMIN' || role === 'UNIT_MANAGER';
}
