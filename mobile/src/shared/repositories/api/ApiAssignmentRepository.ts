import {
  mapAssignment,
  mapPersonnel,
  mapTaskType,
  type AssignmentRow,
  type PersonnelRow,
  type TaskTypeRow,
} from '@/shared/api/mappers';
import type { Assignment, AssignmentStatus, Personnel, TaskType } from '@/shared/types';
import type { AssignmentRepository, CreateAssignmentInput } from '../interfaces';
import { authRequest, authRequestOrNull, queryString } from './request';

const BASE = '/api/v1/assignments';

interface AssignmentDetailResponse {
  assignment: AssignmentRow;
  taskType: TaskTypeRow;
  personnel: PersonnelRow[];
}

export class ApiAssignmentRepository implements AssignmentRepository {
  async getAll(institutionId: string, options?: { date?: string }): Promise<Assignment[]> {
    const rows = await authRequest<AssignmentRow[]>(
      `${BASE}${queryString({ date: options?.date })}`,
    );
    return rows.map((row) => mapAssignment(row, institutionId));
  }

  async getById(id: string): Promise<Assignment | null> {
    const row = await authRequestOrNull<AssignmentRow>(`${BASE}/${encodeURIComponent(id)}`);
    return row ? mapAssignment(row) : null;
  }

  async getDetail(id: string): Promise<{
    assignment: Assignment;
    taskType: TaskType;
    personnel: Personnel[];
  } | null> {
    const response = await authRequestOrNull<AssignmentDetailResponse>(
      `${BASE}/${encodeURIComponent(id)}/detail`,
    );
    if (!response) return null;

    return {
      assignment: mapAssignment(response.assignment),
      taskType: mapTaskType(response.taskType),
      personnel: response.personnel.map((row) => mapPersonnel(row)),
    };
  }

  async getByPersonnel(personnelId: string, fromDate?: string): Promise<Assignment[]> {
    const rows = await authRequest<AssignmentRow[]>(
      `${BASE}/personnel/${encodeURIComponent(personnelId)}${queryString({ from: fromDate })}`,
    );
    return rows.map((row) => mapAssignment(row));
  }

  async getActiveForPersonnelOnDate(
    personnelId: string,
    date: string,
  ): Promise<Assignment | null> {
    const row = await authRequestOrNull<AssignmentRow | null>(
      `${BASE}/personnel/${encodeURIComponent(personnelId)}/active${queryString({ date })}`,
    );
    return row ? mapAssignment(row) : null;
  }

  async create(institutionId: string, input: CreateAssignmentInput): Promise<Assignment> {
    const row = await authRequest<AssignmentRow>(BASE, {
      method: 'POST',
      body: {
        taskTypeId: input.taskTypeId,
        title: input.title,
        description: input.description ?? null,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime ?? null,
        requiredPersonnelCount: input.requiredPersonnelCount,
        managerPersonnelId: input.managerPersonnelId ?? null,
        personnelIds: input.personnelIds,
      },
    });
    return mapAssignment(row, institutionId);
  }

  async updateStatus(id: string, status: AssignmentStatus): Promise<Assignment> {
    const row = await authRequest<AssignmentRow>(
      `${BASE}/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: { status } },
    );
    return mapAssignment(row);
  }

  async getAssignedPersonnelIds(assignmentId: string): Promise<string[]> {
    const response = await authRequestOrNull<AssignmentDetailResponse>(
      `${BASE}/${encodeURIComponent(assignmentId)}/detail`,
    );
    return response?.personnel.map((row) => row.id) ?? [];
  }
}
