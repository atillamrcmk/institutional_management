import pg from 'pg';

const { Pool } = pg;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} ortam değişkeni tanımlı değil`);
  }
  return value;
}

/** Control plane — kurum kaydı */
export const controlPool = new Pool({
  connectionString: process.env.CONTROL_DATABASE_URL ?? process.env.DATABASE_URL,
});

/** CREATE DATABASE için süperuser bağlantısı (genelde postgres DB) */
export function createAdminPool(): pg.Pool {
  return new Pool({
    connectionString: requireEnv('ADMIN_DATABASE_URL'),
  });
}

export function tenantDatabaseUrl(dbName: string): string {
  const template = requireEnv('TENANT_DATABASE_URL_TEMPLATE');
  return template.replace('{db}', dbName);
}

const tenantPools = new Map<string, pg.Pool>();

export function getTenantPool(dbName: string): pg.Pool {
  const existing = tenantPools.get(dbName);
  if (existing) return existing;

  const pool = new Pool({
    connectionString: tenantDatabaseUrl(dbName),
    max: 10,
  });
  tenantPools.set(dbName, pool);
  return pool;
}

export async function closeAllPools(): Promise<void> {
  await Promise.all([
    controlPool.end(),
    ...[...tenantPools.values()].map((pool) => pool.end()),
  ]);
  tenantPools.clear();
}
