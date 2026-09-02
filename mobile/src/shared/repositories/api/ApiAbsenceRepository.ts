import { mapPersonnelAbsence, type PersonnelAbsenceRow } from '@/shared/api/mappers';
import type { PersonnelAbsence } from '@/shared/types';
import type { AbsenceRepository } from '../interfaces';
import { authRequest, queryString } from './request';

const BASE = '/api/v1/absences';

export class ApiAbsenceRepository implements AbsenceRepository {
  async getByPersonnel(personnelId: string): Promise<PersonnelAbsence[]> {
    const rows = await authRequest<PersonnelAbsenceRow[]>(
      `${BASE}/personnel/${encodeURIComponent(personnelId)}`,
    );
    return rows.map(mapPersonnelAbsence);
  }

  async isAbsentOnDate(personnelId: string, date: string): Promise<boolean> {
    const response = await authRequest<{ isAbsent: boolean }>(
      `${BASE}/personnel/${encodeURIComponent(personnelId)}/check${queryString({ date })}`,
    );
    return Boolean(response.isAbsent);
  }

  async create(input: Omit<PersonnelAbsence, 'id' | 'createdAt'>): Promise<PersonnelAbsence> {
    const row = await authRequest<PersonnelAbsenceRow>(BASE, {
      method: 'POST',
      body: {
        personnelId: input.personnelId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes ?? null,
      },
    });
    return mapPersonnelAbsence(row);
  }

  async delete(id: string): Promise<void> {
    await authRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
