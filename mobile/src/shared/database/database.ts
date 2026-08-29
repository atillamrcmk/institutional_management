// TypeScript fallback — Metro web'de database.web.ts, native'de database.native.ts kullanır.
export { getDatabase, closeDatabase } from './database.native';
