import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { controlPool, getTenantPool } from '../db.js';
import { getTenantById } from './tenantProvisioning.js';

export interface AuthUser {
  accountId: string;
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: string;
  permissions: string[];
  dbName: string;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tanımlı değil');
  return secret;
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser; tenant: Record<string, unknown> }> {
  const normalized = email.trim().toLowerCase();
  const accountResult = await controlPool.query(
    `SELECT a.*, t.db_name, t.name AS tenant_name, t.slug, t.status AS tenant_status, t.org_type
     FROM tenant_accounts a
     INNER JOIN tenants t ON t.id = a.tenant_id
     WHERE a.email = $1 AND a.is_active = TRUE`,
    [normalized],
  );

  const account = accountResult.rows[0];
  if (!account) {
    throw new Error('E-posta veya şifre hatalı.');
  }
  if (account.tenant_status !== 'ACTIVE') {
    throw new Error('Kurum hesabı aktif değil.');
  }

  const ok = await bcrypt.compare(password, account.password_hash);
  if (!ok) {
    throw new Error('E-posta veya şifre hatalı.');
  }

  const tenantPool = getTenantPool(account.db_name);
  const grantsResult = await tenantPool.query<{ permission: string }>(
    `SELECT permission FROM user_grants WHERE user_id = $1`,
    [account.tenant_user_id],
  );

  const permissions =
    account.role === 'INSTITUTION_ADMIN'
      ? ['*']
      : grantsResult.rows.map((row) => row.permission);

  const user: AuthUser = {
    accountId: account.id,
    userId: account.tenant_user_id,
    tenantId: account.tenant_id,
    email: account.email,
    displayName: account.display_name,
    role: account.role,
    permissions,
    dbName: account.db_name,
  };

  const token = jwt.sign(
    {
      sub: user.userId,
      accountId: user.accountId,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions,
      dbName: user.dbName,
    },
    jwtSecret(),
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'] },
  );

  return {
    token,
    user,
    tenant: {
      id: account.tenant_id,
      name: account.tenant_name,
      slug: account.slug,
      orgType: account.org_type,
      status: account.tenant_status,
    },
  };
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
  return {
    accountId: String(payload.accountId),
    userId: String(payload.sub),
    tenantId: String(payload.tenantId),
    email: '',
    displayName: '',
    role: String(payload.role),
    permissions: (payload.permissions as string[]) ?? [],
    dbName: String(payload.dbName),
  };
}

export async function hydrateAuthUser(partial: AuthUser): Promise<AuthUser> {
  const tenant = await getTenantById(partial.tenantId);
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw new Error('Kurum bulunamadı veya aktif değil.');
  }

  const accountResult = await controlPool.query(
    `SELECT * FROM tenant_accounts WHERE id = $1 AND is_active = TRUE`,
    [partial.accountId],
  );
  const account = accountResult.rows[0];
  if (!account) throw new Error('Oturum geçersiz.');

  return {
    ...partial,
    email: account.email,
    displayName: account.display_name,
    role: account.role,
    dbName: tenant.db_name,
  };
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (user.role === 'INSTITUTION_ADMIN' || user.permissions.includes('*')) {
    return true;
  }
  return user.permissions.includes(permission);
}
