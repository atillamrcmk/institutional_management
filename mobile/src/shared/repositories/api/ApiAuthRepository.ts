import { ApiError } from '@/shared/api/client';
import { mapUser, type UserRow } from '@/shared/api/mappers';
import { getTenantSlug } from '@/shared/api/session';
import {
  mapServerUserToAppUser,
  type ServerAuthUser,
} from '@/features/auth/services/serverAuthApi';
import type { Permission, User } from '@/shared/types';
import { nowIso } from '@/shared/utils/id';
import type { AuthRepository } from '../interfaces';
import { authRequest, authRequestOrNull } from './request';

const BASE = '/api/v1/users';

interface GrantRow {
  id: string;
  user_id: string;
  permission: string;
  unit_id?: string | null;
  unit_name?: string | null;
}

interface InviteResponse {
  userId: string;
  accountId: string;
  email: string;
  role: User['role'];
}

function randomToken(length: number): string {
  let value = '';
  while (value.length < length) {
    value += Math.random().toString(36).slice(2);
  }
  return value.slice(0, length);
}

/**
 * Sunucu her hesap için e-posta + parola ister. Arayüz yalnızca ad/rol topladığında
 * (PIN'li yerel akışın karşılığı) geçici bir kimlik üretilir; kullanıcı daha sonra
 * kurum yöneticisi tarafından güncellenebilir.
 */
function generateInviteEmail(displayName: string): string {
  const slug = (getTenantSlug() ?? 'kurum').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const namePart =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 24) || 'personel';
  return `${namePart}-${randomToken(6)}@${slug || 'kurum'}.local`;
}

function generateInvitePassword(): string {
  return `Gp${randomToken(14)}!`;
}

export class ApiAuthRepository implements AuthRepository {
  /** Sunucu modunda PIN ile demo girişi yoktur. */
  async getDemoUsers(): Promise<User[]> {
    return [];
  }

  async getById(id: string): Promise<User | null> {
    const me = await authRequestOrNull<{ user: ServerAuthUser }>('/api/v1/auth/me');
    if (me?.user && me.user.userId === id) {
      return mapServerUserToAppUser(me.user);
    }

    const rows = await this.listUsers();
    const row = rows.find((candidate) => candidate.id === id);
    return row ? mapUser(row) : null;
  }

  async login(): Promise<User | null> {
    throw new Error('Sunucu modunda e-posta ve parola ile giriş yapın.');
  }

  async getUserGrants(
    userId: string,
  ): Promise<Array<{ permission: Permission; unitId: string | null }>> {
    const rows = await authRequest<GrantRow[]>(
      `${BASE}/${encodeURIComponent(userId)}/grants`,
    );
    return rows.map((row) => ({
      permission: row.permission as Permission,
      unitId: row.unit_id ?? null,
    }));
  }

  async grantPermission(
    userId: string,
    permission: Permission,
    unitId?: string | null,
  ): Promise<void> {
    await authRequest(`${BASE}/${encodeURIComponent(userId)}/grants`, {
      method: 'POST',
      body: { permission, unitId: unitId ?? null },
    });
  }

  async createUser(input: {
    institutionId: string;
    displayName: string;
    role: User['role'];
    personnelId?: string | null;
    pin?: string | null;
    canMessageAdmins?: boolean;
    email?: string | null;
    password?: string | null;
  }): Promise<User> {
    const email = input.email?.trim() || generateInviteEmail(input.displayName);
    const password = input.password || generateInvitePassword();

    const response = await authRequest<InviteResponse>(`${BASE}/invite`, {
      method: 'POST',
      body: {
        displayName: input.displayName,
        email,
        password,
        role: input.role,
        personnelId: input.personnelId ?? null,
        canMessageAdmins: input.canMessageAdmins ?? false,
      },
    });

    const created = await this.findUserById(response.userId);
    if (created) return created;

    const timestamp = nowIso();
    return {
      id: response.userId,
      institutionId: input.institutionId,
      personnelId: input.personnelId ?? null,
      displayName: input.displayName,
      role: response.role ?? input.role,
      pin: null,
      canMessageAdmins: input.canMessageAdmins ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  async updateUser(
    id: string,
    input: { canMessageAdmins?: boolean; displayName?: string },
  ): Promise<User> {
    const row = await authRequest<UserRow>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        displayName: input.displayName,
        canMessageAdmins: input.canMessageAdmins,
      },
    });
    return mapUser(row);
  }

  async getUsersByRole(institutionId: string, roles: User['role'][]): Promise<User[]> {
    if (roles.length === 0) return [];
    const rows = await this.listUsers();
    return rows
      .filter((row) => roles.includes(row.role as User['role']) && row.is_active !== false)
      .map((row) => mapUser(row, institutionId));
  }

  async getUserByPersonnelId(personnelId: string): Promise<User | null> {
    const rows = await this.listUsers();
    const row = rows.find((candidate) => candidate.personnel_id === personnelId);
    return row ? mapUser(row) : null;
  }

  /**
   * `/users` yalnızca `users.manage` izniyle okunabilir. Yetkisi olmayan kullanıcılar
   * için boş liste dönülür; çağıranlar bunu "kullanıcı bulunamadı" gibi ele alır.
   */
  private async listUsers(): Promise<UserRow[]> {
    try {
      return await authRequest<UserRow[]>(BASE);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
        return [];
      }
      throw error;
    }
  }

  private async findUserById(id: string): Promise<User | null> {
    const rows = await this.listUsers();
    const row = rows.find((candidate) => candidate.id === id);
    return row ? mapUser(row) : null;
  }
}
