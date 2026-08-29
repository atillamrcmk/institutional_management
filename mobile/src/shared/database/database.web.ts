import { Asset } from 'expo-asset';
import initSqlJs, {
  type BindParams,
  type Database as SqlJsDatabase,
  type SqlJsStatic,
} from 'sql.js';
import type { SQLiteDatabaseAdapter } from './types';

const SQL_WASM = require('sql.js/dist/sql-wasm-browser.wasm');

const DB_STORAGE_KEY = 'personel_planla_web_db';

let sqlModulePromise: Promise<SqlJsStatic> | null = null;

async function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModulePromise) {
    sqlModulePromise = (async () => {
      const asset = Asset.fromModule(SQL_WASM);
      await asset.downloadAsync();
      const wasmUri = asset.localUri ?? asset.uri;
      if (!wasmUri) {
        throw new Error('sql.js wasm dosyası yüklenemedi');
      }
      return initSqlJs({
        locateFile: (file) => (file.endsWith('.wasm') ? wasmUri : file),
      });
    })();
  }
  return sqlModulePromise;
}

class WebSQLiteDatabase implements SQLiteDatabaseAdapter {
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly db: SqlJsDatabase) {}

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
    this.schedulePersist();
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(params as BindParams);
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    this.db.run(sql, params as (string | number | null)[]);
    this.schedulePersist();
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    // sql.js db.exec() ends implicit transactions; run sequentially on web.
    await fn();
    this.flushPersist();
  }

  async closeAsync(): Promise<void> {
    this.flushPersist();
    this.db.close();
  }

  async flushAsync(): Promise<void> {
    this.flushPersist();
  }

  private schedulePersist(): void {
    if (typeof localStorage === 'undefined') return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, 300);
  }

  private flushPersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persist();
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    const binary = this.db.export();
    let binaryString = '';
    for (let i = 0; i < binary.length; i++) {
      binaryString += String.fromCharCode(binary[i]);
    }
    localStorage.setItem(DB_STORAGE_KEY, btoa(binaryString));
  }
}

let database: WebSQLiteDatabase | null = null;

function loadSavedDatabase(SQL: SqlJsStatic): SqlJsDatabase {
  if (typeof localStorage === 'undefined') {
    return new SQL.Database();
  }
  const saved = localStorage.getItem(DB_STORAGE_KEY);
  if (!saved) {
    return new SQL.Database();
  }
  const bytes = Uint8Array.from(atob(saved), (char) => char.charCodeAt(0));
  return new SQL.Database(bytes);
}

export async function getDatabase(): Promise<SQLiteDatabaseAdapter> {
  if (!database) {
    const SQL = await getSqlModule();
    const db = loadSavedDatabase(SQL);
    database = new WebSQLiteDatabase(db);
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
  return database;
}

export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.closeAsync();
    database = null;
  }
}
