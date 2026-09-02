import {
  mapPersonnel,
  mapPersonnelUnitHistory,
  mapUnit,
  type PersonnelRow,
  type PersonnelUnitHistoryRow,
  type UnitRow,
} from '@/shared/api/mappers';
import type {
  CreateUnitInput,
  Personnel,
  PersonnelUnitHistory,
  Unit,
  UpdateUnitInput,
} from '@/shared/types';
import type { UnitRepository } from '../interfaces';
import { authRequest, authRequestOrNull, queryString } from './request';

const BASE = '/api/v1/units';

type AssignPersonnelResponse =
  | PersonnelUnitHistoryRow
  | { ok: true; unitId: string; personnelId: string; alreadyAssigned: true };

function isHistoryRow(value: AssignPersonnelResponse): value is PersonnelUnitHistoryRow {
  return 'id' in value && typeof value.id === 'string';
}

export class ApiUnitRepository implements UnitRepository {
  async getAll(institutionId: string): Promise<Unit[]> {
    const rows = await authRequest<UnitRow[]>(BASE);
    return rows.map((row) => mapUnit(row, institutionId));
  }

  async getById(id: string): Promise<Unit | null> {
    const row = await authRequestOrNull<UnitRow>(`${BASE}/${encodeURIComponent(id)}`);
    return row ? mapUnit(row) : null;
  }

  async getChildren(parentId: string | null, institutionId: string): Promise<Unit[]> {
    const rows = await authRequest<UnitRow[]>(
      `${BASE}${queryString({ parentId: parentId ?? 'root' })}`,
    );
    return rows.map((row) => mapUnit(row, institutionId));
  }

  async create(institutionId: string, input: CreateUnitInput): Promise<Unit> {
    const row = await authRequest<UnitRow>(BASE, {
      method: 'POST',
      body: {
        name: input.name,
        parentId: input.parentId ?? null,
        minimumStaff: input.minimumStaff ?? 0,
        managerPersonnelId: input.managerPersonnelId ?? null,
        workScheduleType: input.workScheduleType ?? 'OFFICE',
        officeStartTime: input.officeStartTime ?? '08:00',
        officeEndTime: input.officeEndTime ?? '17:00',
      },
    });
    return mapUnit(row, institutionId);
  }

  async update(id: string, input: UpdateUnitInput): Promise<Unit> {
    const row = await authRequest<UnitRow>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        name: input.name,
        parentId: input.parentId,
        minimumStaff: input.minimumStaff,
        managerPersonnelId: input.managerPersonnelId,
        workScheduleType: input.workScheduleType,
        officeStartTime: input.officeStartTime,
        officeEndTime: input.officeEndTime,
      },
    });
    return mapUnit(row);
  }

  async delete(id: string): Promise<void> {
    await authRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async assignPersonnel(unitId: string, personnelId: string): Promise<PersonnelUnitHistory> {
    const response = await authRequest<AssignPersonnelResponse>(
      `${BASE}/${encodeURIComponent(unitId)}/personnel`,
      { method: 'POST', body: { personnelId } },
    );

    if (!isHistoryRow(response)) {
      throw new Error('Personel zaten bu birimde.');
    }
    return mapPersonnelUnitHistory(response);
  }

  async removePersonnel(unitId: string, personnelId: string): Promise<void> {
    await authRequest(
      `${BASE}/${encodeURIComponent(unitId)}/personnel/${encodeURIComponent(personnelId)}`,
      { method: 'DELETE' },
    );
  }

  async getActivePersonnelForUnit(unitId: string): Promise<Personnel[]> {
    const rows = await authRequest<PersonnelRow[]>(
      `${BASE}/${encodeURIComponent(unitId)}/personnel`,
    );
    return rows.map((row) => mapPersonnel(row));
  }

  async getUnassignedPersonnel(institutionId: string, query?: string): Promise<Personnel[]> {
    const rows = await authRequest<PersonnelRow[]>(
      `${BASE}/unassigned${queryString({ q: query })}`,
    );
    return rows.map((row) => mapPersonnel(row, institutionId));
  }

  async getCurrentUnitForPersonnel(personnelId: string): Promise<Unit | null> {
    const row = await authRequestOrNull<UnitRow | null>(
      `${BASE}/personnel/${encodeURIComponent(personnelId)}/current`,
    );
    return row ? mapUnit(row) : null;
  }

  async getPersonnelCountForUnit(unitId: string): Promise<number> {
    const response = await authRequest<{ unitId: string; count: number }>(
      `${BASE}/${encodeURIComponent(unitId)}/personnel/count`,
    );
    return Number(response.count ?? 0);
  }
}
