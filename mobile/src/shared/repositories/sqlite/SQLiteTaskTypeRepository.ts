import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type { TaskType } from '@/shared/types';
import type { TaskTypeRepository } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

function mapTaskType(row: Record<string, unknown>): TaskType {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    name: row.name as string,
    code: row.code as string,
    createdAt: row.created_at as string,
  };
}

export class SQLiteTaskTypeRepository implements TaskTypeRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getAll(institutionId: string): Promise<TaskType[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM task_types WHERE institution_id = ? ORDER BY name',
      institutionId,
    );
    return rows.map(mapTaskType);
  }

  async getById(id: string): Promise<TaskType | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM task_types WHERE id = ?',
      id,
    );
    return row ? mapTaskType(row) : null;
  }

  async create(institutionId: string, name: string, code: string): Promise<TaskType> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      'INSERT INTO task_types (id, institution_id, name, code, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      institutionId,
      name,
      code,
      ts,
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Görev türü oluşturulamadı');
    return created;
  }
}
