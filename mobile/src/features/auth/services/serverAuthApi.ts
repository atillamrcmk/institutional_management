import { apiRequest } from '@/shared/api/client';
import type { User, UserRole } from '@/shared/types';

export interface ServerTenant {
  id: string;
  name: string;
  slug: string;
  orgType: 'INSTITUTION' | 'BUSINESS';
  dbName?: string;
  status?: string;
}

export interface ServerAuthUser {
  accountId: string;
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: string[];
  dbName: string;
}

export interface ServerLoginResult {
  token: string;
  user: ServerAuthUser;
  tenant: ServerTenant;
}

export interface CreateTenantPayload {
  name: string;
  slug: string;
  orgType?: 'INSTITUTION' | 'BUSINESS';
  owner: {
    email: string;
    password: string;
    displayName: string;
  };
}

export function mapServerUserToAppUser(serverUser: ServerAuthUser): User {
  return {
    id: serverUser.userId,
    institutionId: serverUser.tenantId,
    personnelId: null,
    displayName: serverUser.displayName,
    role: serverUser.role,
    pin: null,
    canMessageAdmins: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function serverLogin(email: string, password: string): Promise<ServerLoginResult> {
  return apiRequest<ServerLoginResult>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function serverCreateTenant(
  payload: CreateTenantPayload,
): Promise<ServerLoginResult & { tenant: ServerTenant; owner: unknown }> {
  return apiRequest('/api/v1/tenants', {
    method: 'POST',
    body: payload,
  });
}

export async function serverMe(token: string): Promise<{ user: ServerAuthUser }> {
  return apiRequest('/api/v1/auth/me', { token });
}
