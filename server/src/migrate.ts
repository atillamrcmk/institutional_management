import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlPool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrateControl(): Promise<void> {
  const sqlPath = path.join(__dirname, '..', 'sql', 'control', '001_control.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await controlPool.query(sql);
  console.log('Control DB migration tamamlandı.');
  await controlPool.end();
}

migrateControl().catch((error) => {
  console.error(error);
  process.exit(1);
});
