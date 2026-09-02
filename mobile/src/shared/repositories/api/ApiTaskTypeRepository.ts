import { mapTaskType, type TaskTypeRow } from '@/shared/api/mappers';
import type { TaskType } from '@/shared/types';
import type { TaskTypeRepository } from '../interfaces';
import { authRequest, authRequestOrNull } from './request';

const BASE = '/api/v1/task-types';

export class ApiTaskTypeRepository implements TaskTypeRepository {
  async getAll(institutionId: string): Promise<TaskType[]> {
    const rows = await authRequest<TaskTypeRow[]>(BASE);
    return rows.map((row) => mapTaskType(row, institutionId));
  }

  async getById(id: string): Promise<TaskType | null> {
    const row = await authRequestOrNull<TaskTypeRow>(`${BASE}/${encodeURIComponent(id)}`);
    return row ? mapTaskType(row) : null;
  }

  async create(institutionId: string, name: string, code: string): Promise<TaskType> {
    const row = await authRequest<TaskTypeRow>(BASE, {
      method: 'POST',
      body: { name, code },
    });
    return mapTaskType(row, institutionId);
  }
}
