import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import {
  controlPool,
  createAdminPool,
  getTenantPool,
} from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type OrgType = 'INSTITUTION' | 'BUSINESS';

export interface CreateTenantInput {
  name: string;
  slug: string;
  orgType?: OrgType;
  owner: {
    email: string;
    password: string;
    displayName: string;
  };
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function dbNameForSlug(slug: string): string {
  return `pp_t_${slug}`;
}

async function logStep(
  tenantId: string,
  step: string,
  status: 'OK' | 'ERROR',
  detail?: string,
): Promise<void> {
  await controlPool.query(
    `INSERT INTO provisioning_logs (id, tenant_id, step, status, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), tenantId, step, status, detail ?? null],
  );
}

/** Sırayla uygulanan tenant şema dosyaları. Hepsi idempotent olmalıdır. */
export const TENANT_MIGRATIONS = ['001_tenant.sql', '002_operations.sql'] as const;

export function tenantSqlDir(): string {
  return path.join(__dirname, '..', '..', 'sql', 'tenant');
}

export function readTenantMigration(fileName: string): string {
  return fs.readFileSync(path.join(tenantSqlDir(), fileName), 'utf8');
}

export async function applyTenantSchema(dbName: string): Promise<void> {
  const pool = getTenantPool(dbName);
  for (const fileName of TENANT_MIGRATIONS) {
    await pool.query(readTenantMigration(fileName));
  }
}

export async function provisionTenant(input: CreateTenantInput) {
  const slug = sanitizeSlug(input.slug);
  if (!slug || slug.length < 2) {
    throw new Error('Geçersiz kurum kodu (slug). En az 2 karakter, harf/rakam.');
  }

  const name = input.name.trim();
  if (!name) throw new Error('Kurum adı zorunludur.');

  const email = input.owner.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Geçerli bir e-posta girin.');
  if (!input.owner.password || input.owner.password.length < 6) {
    throw new Error('Şifre en az 6 karakter olmalıdır.');
  }

  const existingSlug = await controlPool.query(
    'SELECT id FROM tenants WHERE slug = $1',
    [slug],
  );
  if (existingSlug.rowCount) {
    throw new Error('Bu kurum kodu zaten kullanılıyor.');
  }

  const existingEmail = await controlPool.query(
    'SELECT id FROM tenant_accounts WHERE email = $1',
    [email],
  );
  if (existingEmail.rowCount) {
    throw new Error('Bu e-posta zaten kayıtlı.');
  }

  const tenantId = randomUUID();
  const dbName = dbNameForSlug(slug);
  const orgType = input.orgType ?? 'INSTITUTION';
  const passwordHash = await bcrypt.hash(input.owner.password, 10);
  const accountId = randomUUID();
  const tenantUserId = randomUUID();

  await controlPool.query(
    `INSERT INTO tenants (id, name, slug, org_type, db_name, status)
     VALUES ($1, $2, $3, $4, $5, 'PROVISIONING')`,
    [tenantId, name, slug, orgType, dbName],
  );

  const adminPool = createAdminPool();
  try {
    await logStep(tenantId, 'create_database', 'OK', dbName);
    await adminPool.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await logStep(tenantId, 'create_database', 'ERROR', detail);
    await controlPool.query(`UPDATE tenants SET status = 'DELETED', updated_at = NOW() WHERE id = $1`, [
      tenantId,
    ]);
    await adminPool.end();
    throw new Error(`Veritabanı oluşturulamadı: ${detail}`);
  } finally {
    await adminPool.end();
  }

  try {
    await applyTenantSchema(dbName);
    await logStep(tenantId, 'apply_schema', 'OK');

    const tenantPool = getTenantPool(dbName);
    await tenantPool.query(
      `INSERT INTO meta (key, value) VALUES
        ('tenant_id', $1),
        ('slug', $2),
        ('name', $3),
        ('org_type', $4)`,
      [tenantId, slug, name, orgType],
    );

    await tenantPool.query(
      `INSERT INTO users (
        id, personnel_id, display_name, email, role, password_hash, is_active
      ) VALUES ($1, NULL, $2, $3, 'INSTITUTION_ADMIN', $4, TRUE)`,
      [tenantUserId, input.owner.displayName.trim(), email, passwordHash],
    );

    await controlPool.query(
      `INSERT INTO tenant_accounts (
        id, tenant_id, email, password_hash, display_name, role, tenant_user_id
      ) VALUES ($1, $2, $3, $4, $5, 'INSTITUTION_ADMIN', $6)`,
      [accountId, tenantId, email, passwordHash, input.owner.displayName.trim(), tenantUserId],
    );

    await controlPool.query(
      `UPDATE tenants SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
      [tenantId],
    );
    await logStep(tenantId, 'activate', 'OK');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await logStep(tenantId, 'bootstrap', 'ERROR', detail);
    await controlPool.query(`UPDATE tenants SET status = 'SUSPENDED', updated_at = NOW() WHERE id = $1`, [
      tenantId,
    ]);
    throw error;
  }

  return {
    tenantId,
    name,
    slug,
    orgType,
    dbName,
    owner: {
      accountId,
      userId: tenantUserId,
      email,
      displayName: input.owner.displayName.trim(),
      role: 'INSTITUTION_ADMIN' as const,
    },
  };
}

function quoteIdent(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error('Geçersiz veritabanı adı');
  }
  return `"${name}"`;
}

export async function getTenantById(tenantId: string) {
  const result = await controlPool.query(
    `SELECT id, name, slug, org_type, db_name, status, created_at
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return result.rows[0] ?? null;
}

export async function getTenantBySlug(slug: string) {
  const result = await controlPool.query(
    `SELECT id, name, slug, org_type, db_name, status, created_at
     FROM tenants WHERE slug = $1`,
    [sanitizeSlug(slug)],
  );
  return result.rows[0] ?? null;
}
