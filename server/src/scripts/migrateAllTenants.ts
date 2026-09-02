import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { closeAllPools, controlPool, getTenantPool } from '../db.js';
import { readTenantMigration } from '../services/tenantProvisioning.js';

/**
 * Tüm ACTIVE tenant veritabanlarına operasyonel şemayı uygular.
 *
 *   npm run migrate:tenants
 *   npm run migrate:tenants -- 002_operations.sql 003_x.sql
 *
 * Dosyalar idempotent (IF NOT EXISTS) olduğu için tekrar tekrar çalıştırılabilir.
 */

const DEFAULT_MIGRATIONS = ['002_operations.sql'];

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  db_name: string;
}

async function main(): Promise<void> {
  const migrations = process.argv.slice(2).filter((arg) => arg.endsWith('.sql'));
  const files = migrations.length > 0 ? migrations : DEFAULT_MIGRATIONS;

  const sqlByFile = new Map<string, string>();
  for (const file of files) {
    sqlByFile.set(file, readTenantMigration(file));
  }

  const tenants = await controlPool.query<TenantRow>(
    `SELECT id, name, slug, db_name FROM tenants WHERE status = 'ACTIVE' ORDER BY created_at`,
  );

  const total = tenants.rows.length;
  if (total === 0) {
    console.log('Migrate edilecek ACTIVE kurum bulunamadı.');
    return;
  }

  console.log(`${total} kurum bulundu. Uygulanacak dosyalar: ${files.join(', ')}`);

  const failures: Array<{ tenant: TenantRow; error: string }> = [];

  for (const tenant of tenants.rows) {
    const pool = getTenantPool(tenant.db_name);
    try {
      for (const file of files) {
        await pool.query(sqlByFile.get(file)!);
        await logStep(tenant.id, `migrate:${file}`, 'OK');
      }
      console.log(`  OK    ${tenant.slug} (${tenant.db_name})`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push({ tenant, error: detail });
      await logStep(tenant.id, 'migrate', 'ERROR', detail).catch(() => undefined);
      console.error(`  HATA  ${tenant.slug} (${tenant.db_name}): ${detail}`);
    }
  }

  console.log(
    `\nTamamlandı: ${total - failures.length} başarılı, ${failures.length} hatalı.`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
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

main()
  .catch((error) => {
    console.error('Migration başarısız:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllPools().catch(() => undefined);
  });
