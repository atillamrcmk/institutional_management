import { mapPersonnel, type PersonnelRow } from '@/shared/api/mappers';
import type { CreatePersonnelInput, Personnel, UpdatePersonnelInput } from '@/shared/types';
import type { PersonnelRepository } from '../interfaces';
import { authRequest, authRequestOrNull, queryString } from './request';

const BASE = '/api/v1/personnel';

export class ApiPersonnelRepository implements PersonnelRepository {
  async getAll(institutionId: string): Promise<Personnel[]> {
    const rows = await authRequest<PersonnelRow[]>(BASE);
    return rows.map((row) => mapPersonnel(row, institutionId));
  }

  async getById(id: string): Promise<Personnel | null> {
    const row = await authRequestOrNull<PersonnelRow>(`${BASE}/${encodeURIComponent(id)}`);
    return row ? mapPersonnel(row) : null;
  }

  async findActiveBySicilNo(
    institutionId: string,
    sicilNo: string,
    excludeId?: string,
  ): Promise<Personnel | null> {
    const normalized = sicilNo.trim();
    if (!normalized) return null;

    // Sunucu araması yalnızca ACTIVE kayıtlarda ve kısmi eşleşmeyle çalışır,
    // bu yüzden tam sicil eşleşmesi burada süzülür.
    const rows = await authRequest<PersonnelRow[]>(`${BASE}${queryString({ q: normalized })}`);
    const match = rows.find(
      (row) => row.sicil_no?.trim() === normalized && row.id !== excludeId,
    );
    return match ? mapPersonnel(match, institutionId) : null;
  }

  async search(institutionId: string, query: string): Promise<Personnel[]> {
    const rows = await authRequest<PersonnelRow[]>(`${BASE}${queryString({ q: query })}`);
    return rows.map((row) => mapPersonnel(row, institutionId));
  }

  async create(institutionId: string, input: CreatePersonnelInput): Promise<Personnel> {
    const row = await authRequest<PersonnelRow>(BASE, {
      method: 'POST',
      body: {
        firstName: input.firstName,
        lastName: input.lastName,
        sicilNo: input.sicilNo.trim(),
        title: input.title ?? null,
        photoUri: input.photoUri ?? null,
      },
    });
    return mapPersonnel(row, institutionId);
  }

  async update(id: string, input: UpdatePersonnelInput): Promise<Personnel> {
    const row = await authRequest<PersonnelRow>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        firstName: input.firstName,
        lastName: input.lastName,
        sicilNo: input.sicilNo?.trim(),
        title: input.title,
        photoUri: input.photoUri,
        status: input.status,
      },
    });
    return mapPersonnel(row);
  }

  async delete(id: string): Promise<void> {
    await authRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
