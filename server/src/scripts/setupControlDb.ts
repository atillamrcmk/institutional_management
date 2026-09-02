import 'dotenv/config';
import pg from 'pg';

/**
 * Control DB yoksa oluşturur, sonra migration çalıştırır.
 * ADMIN_DATABASE_URL gerekir.
 */
async function main(): Promise<void> {
  const adminUrl = process.env.ADMIN_DATABASE_URL;
  const controlUrl = process.env.CONTROL_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!adminUrl || !controlUrl) {
    throw new Error('ADMIN_DATABASE_URL ve CONTROL_DATABASE_URL gerekli');
  }

  const dbName = new URL(controlUrl).pathname.replace(/^\//, '');
  if (!dbName) throw new Error('CONTROL_DATABASE_URL içinde veritabanı adı yok');

  const admin = new pg.Pool({ connectionString: adminUrl });
  try {
    const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Oluşturuldu: ${dbName}`);
    } else {
      console.log(`Zaten var: ${dbName}`);
    }
  } finally {
    await admin.end();
  }

  // migrate.ts'i dinamik import etmek yerine aynı SQL'i uygula
  const { controlPool } = await import('../db.js');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'sql', 'control', '001_control.sql'),
    'utf8',
  );
  await controlPool.query(sql);
  console.log('Control şema uygulandı.');
  await controlPool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
