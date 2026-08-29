import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabaseAdapter } from './types';

const DB_NAME = 'personel_planla.db';

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLiteDatabaseAdapter> {
  if (!database) {
    database = await SQLite.openDatabaseAsync(DB_NAME);
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
  return database as SQLiteDatabaseAdapter;
}

export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.closeAsync();
    database = null;
  }
}
