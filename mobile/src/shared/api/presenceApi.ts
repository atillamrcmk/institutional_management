import { authRequest, queryString } from '@/shared/repositories/api/request';
import type { Personnel, PersonnelPresence } from '@/shared/types';
import {
  mapCalculatedShift,
  mapPersonnel,
  mapShiftGroup,
  mapUnit,
  type CalculatedShiftPayload,
  type PersonnelRow,
  type ShiftGroupRow,
  type UnitRow,
} from './mappers';

const BASE = '/api/v1/presence';

export interface PresenceQuery {
  unitId?: string;
  shiftGroupId?: string;
  status?: 'all' | 'on_duty' | 'on_assignment' | 'absent';
}

interface PresenceEntryPayload {
  personnel: PersonnelRow;
  unit: UnitRow | null;
  shiftGroup: ShiftGroupRow | null;
  shift: CalculatedShiftPayload;
  status: PersonnelPresence['status'];
  assignmentTitle?: string;
  assignmentTime?: string;
}

interface PresenceResponse {
  date: string;
  count: number;
  entries: PresenceEntryPayload[];
}

interface OfficeUnitPayload {
  unitId: string;
  unitName: string;
  startTime: string;
  endTime: string;
  personnel: PersonnelRow[];
}

interface OfficeUnitsResponse {
  date: string;
  units: OfficeUnitPayload[];
}

/** `GET /api/v1/presence` — sunucu tarafında hesaplanan görev durumu listesi. */
export async function fetchPresenceForDate(
  institutionId: string,
  date: string,
  filters: PresenceQuery = {},
): Promise<PersonnelPresence[]> {
  const response = await authRequest<PresenceResponse>(
    `${BASE}${queryString({
      date,
      unitId: filters.unitId,
      shiftGroupId: filters.shiftGroupId,
      status: filters.status,
    })}`,
  );

  return response.entries.map((entry) => ({
    personnel: mapPersonnel(entry.personnel, institutionId),
    unit: entry.unit ? mapUnit(entry.unit, institutionId) : null,
    shiftGroup: entry.shiftGroup ? mapShiftGroup(entry.shiftGroup, { institutionId }) : null,
    shift: mapCalculatedShift(entry.shift, response.date ?? date),
    status: entry.status,
    assignmentTitle: entry.assignmentTitle,
    assignmentTime: entry.assignmentTime,
  }));
}

/** `GET /api/v1/presence/office-units` — mesai düzenindeki birimler ve personelleri. */
export async function fetchOfficeUnitsSummary(
  institutionId: string,
  date: string,
): Promise<Array<{
  unitId: string;
  unitName: string;
  startTime: string;
  endTime: string;
  personnel: Personnel[];
}>> {
  const response = await authRequest<OfficeUnitsResponse>(
    `${BASE}/office-units${queryString({ date })}`,
  );

  return response.units
    .filter((unit) => unit.personnel.length > 0)
    .map((unit) => ({
      unitId: unit.unitId,
      unitName: unit.unitName,
      startTime: unit.startTime,
      endTime: unit.endTime,
      personnel: unit.personnel.map((row) => mapPersonnel(row, institutionId)),
    }));
}
