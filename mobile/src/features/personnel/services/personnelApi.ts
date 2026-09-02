import { apiRequest } from '@/shared/api/client';
import { mapPersonnel, type PersonnelRow } from '@/shared/api/mappers';
import { queryString } from '@/shared/repositories/api/request';
import type { Personnel } from '@/shared/types';

/**
 * Jetonu açıkça alan ince sarmalayıcılar. Genel veri erişimi
 * `ApiPersonnelRepository` üzerinden yapılır; buradaki uçlar ve eşleyici onunla ortaktır.
 */
const BASE = '/api/v1/personnel';

export async function fetchPersonnelList(
  token: string,
  institutionId: string,
  query?: string,
): Promise<Personnel[]> {
  const rows = await apiRequest<PersonnelRow[]>(`${BASE}${queryString({ q: query })}`, {
    token,
  });
  return rows.map((row) => mapPersonnel(row, institutionId));
}

export async function fetchPersonnelById(
  token: string,
  institutionId: string,
  id: string,
): Promise<Personnel | null> {
  try {
    const row = await apiRequest<PersonnelRow>(`${BASE}/${encodeURIComponent(id)}`, { token });
    return mapPersonnel(row, institutionId);
  } catch {
    return null;
  }
}

export async function createPersonnelOnServer(
  token: string,
  institutionId: string,
  input: {
    firstName: string;
    lastName: string;
    sicilNo: string;
    title?: string | null;
    photoUri?: string | null;
  },
): Promise<Personnel> {
  const row = await apiRequest<PersonnelRow>(BASE, {
    method: 'POST',
    token,
    body: {
      firstName: input.firstName,
      lastName: input.lastName,
      sicilNo: input.sicilNo,
      title: input.title ?? null,
      photoUri: input.photoUri ?? null,
    },
  });
  return mapPersonnel(row, institutionId);
}

export async function updatePersonnelOnServer(
  token: string,
  institutionId: string,
  id: string,
  input: {
    firstName?: string;
    lastName?: string;
    sicilNo?: string;
    title?: string | null;
    photoUri?: string | null;
    status?: string;
  },
): Promise<Personnel> {
  const row = await apiRequest<PersonnelRow>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return mapPersonnel(row, institutionId);
}
