import {
  mapCalculatedShift,
  mapPersonnel,
  mapPersonnelShiftAssignment,
  mapShiftGroup,
  mapShiftPattern,
  mapShiftPatternDay,
  mapUnit,
  type CalculatedShiftPayload,
  type PersonnelRow,
  type PersonnelShiftAssignmentRow,
  type ShiftGroupRow,
  type ShiftPatternDayRow,
  type ShiftPatternRow,
  type UnitRow,
} from '@/shared/api/mappers';
import type {
  CalculatedShift,
  Personnel,
  PersonnelShiftAssignment,
  ShiftGroup,
  ShiftPattern,
  ShiftPatternDay,
  Unit,
} from '@/shared/types';
import type { ShiftRepository } from '../interfaces';
import { authRequest, authRequestOrNull, queryString } from './request';

const BASE = '/api/v1/shifts';

interface ActiveAssignmentResponse {
  assignment: PersonnelShiftAssignmentRow;
  group: ShiftGroupRow;
  patternDays: ShiftPatternDayRow[];
  referenceDate: string;
  shift?: CalculatedShiftPayload;
}

interface ByDateResponse {
  date: string;
  groups: Array<{
    group: ShiftGroupRow;
    unit: UnitRow;
    personnel: PersonnelRow[];
    shift: CalculatedShiftPayload;
  }>;
}

type AssignToGroupResponse =
  | PersonnelShiftAssignmentRow
  | { ok: true; alreadyAssigned: true; shiftGroupId: string; personnelId: string };

function isAssignmentRow(
  value: AssignToGroupResponse,
): value is PersonnelShiftAssignmentRow {
  return 'id' in value && typeof value.id === 'string';
}

function serializeDays(
  days: Array<{ shiftType: ShiftPatternDay['shiftType']; startTime?: string; endTime?: string }>,
) {
  return days.map((day) => ({
    shiftType: day.shiftType,
    startTime: day.startTime ?? null,
    endTime: day.endTime ?? null,
  }));
}

export class ApiShiftRepository implements ShiftRepository {
  async getPatterns(institutionId: string): Promise<ShiftPattern[]> {
    const rows = await authRequest<ShiftPatternRow[]>(`${BASE}/patterns`);
    return rows
      .map((row) => mapShiftPattern(row, institutionId))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  async getPatternById(id: string): Promise<ShiftPattern | null> {
    const row = await authRequestOrNull<ShiftPatternRow>(
      `${BASE}/patterns/${encodeURIComponent(id)}`,
    );
    return row ? mapShiftPattern(row) : null;
  }

  async getPatternDays(patternId: string): Promise<ShiftPatternDay[]> {
    const rows = await authRequest<ShiftPatternDayRow[]>(
      `${BASE}/patterns/${encodeURIComponent(patternId)}/days`,
    );
    return rows.map((row) => mapShiftPatternDay(row, patternId));
  }

  async getAllGroups(institutionId: string): Promise<ShiftGroup[]> {
    const rows = await authRequest<ShiftGroupRow[]>(`${BASE}/groups`);
    return rows.map((row) => mapShiftGroup(row, { institutionId }));
  }

  async getGroupsByUnit(unitId: string): Promise<ShiftGroup[]> {
    const rows = await authRequest<ShiftGroupRow[]>(`${BASE}/groups${queryString({ unitId })}`);
    return rows.map((row) => mapShiftGroup(row));
  }

  async getGroupById(id: string): Promise<ShiftGroup | null> {
    const row = await authRequestOrNull<ShiftGroupRow>(
      `${BASE}/groups/${encodeURIComponent(id)}`,
    );
    return row ? mapShiftGroup(row) : null;
  }

  async createPattern(
    institutionId: string,
    name: string,
    referenceDate: string,
    days: Array<{ shiftType: ShiftPatternDay['shiftType']; startTime?: string; endTime?: string }>,
  ): Promise<ShiftPattern> {
    const row = await authRequest<ShiftPatternRow>(`${BASE}/patterns`, {
      method: 'POST',
      body: { name, referenceDate, days: serializeDays(days) },
    });
    return mapShiftPattern(row, institutionId);
  }

  async updatePattern(
    id: string,
    input: {
      name?: string;
      referenceDate?: string;
      days?: Array<{
        shiftType: ShiftPatternDay['shiftType'];
        startTime?: string;
        endTime?: string;
      }>;
    },
  ): Promise<ShiftPattern> {
    const row = await authRequest<ShiftPatternRow>(
      `${BASE}/patterns/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: {
          name: input.name,
          referenceDate: input.referenceDate,
          days: input.days ? serializeDays(input.days) : undefined,
        },
      },
    );
    return mapShiftPattern(row);
  }

  async deletePattern(id: string): Promise<void> {
    await authRequest(`${BASE}/patterns/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async createGroup(
    unitId: string,
    name: string,
    patternId: string,
    cycleStartDate?: string,
  ): Promise<ShiftGroup> {
    const row = await authRequest<ShiftGroupRow>(`${BASE}/groups`, {
      method: 'POST',
      body: { unitId, name, patternId, cycleStartDate },
    });
    return mapShiftGroup(row);
  }

  async getSuggestedCycleStartDate(unitId: string, patternId: string): Promise<string> {
    const response = await authRequest<{ cycleStartDate: string }>(
      `${BASE}/groups/suggested-cycle-start${queryString({ unitId, patternId })}`,
    );
    return response.cycleStartDate;
  }

  async updateGroup(
    id: string,
    input: { name?: string; patternId?: string; cycleStartDate?: string },
  ): Promise<ShiftGroup> {
    const row = await authRequest<ShiftGroupRow>(`${BASE}/groups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        name: input.name,
        patternId: input.patternId,
        cycleStartDate: input.cycleStartDate,
      },
    });
    return mapShiftGroup(row);
  }

  async deleteGroup(id: string): Promise<void> {
    await authRequest(`${BASE}/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async assignPersonnelToGroup(
    personnelId: string,
    shiftGroupId: string,
  ): Promise<PersonnelShiftAssignment> {
    const response = await authRequest<AssignToGroupResponse>(
      `${BASE}/groups/${encodeURIComponent(shiftGroupId)}/personnel`,
      { method: 'POST', body: { personnelId } },
    );

    if (isAssignmentRow(response)) {
      return mapPersonnelShiftAssignment(response);
    }

    // Personel zaten bu gruptaysa sunucu yeni kayıt üretmez; mevcut atama okunur.
    const active = await this.getActiveAssignmentForPersonnel(personnelId, '');
    if (!active) throw new Error('Vardiya ataması oluşturulamadı');
    return active.assignment;
  }

  async removePersonnelFromGroup(personnelId: string, shiftGroupId: string): Promise<void> {
    await authRequest(
      `${BASE}/groups/${encodeURIComponent(shiftGroupId)}/personnel/${encodeURIComponent(
        personnelId,
      )}`,
      { method: 'DELETE' },
    );
  }

  async getPersonnelInGroup(shiftGroupId: string): Promise<Personnel[]> {
    const rows = await authRequest<PersonnelRow[]>(
      `${BASE}/groups/${encodeURIComponent(shiftGroupId)}/personnel`,
    );
    return rows.map((row) => mapPersonnel(row));
  }

  async getActiveAssignmentForPersonnel(
    personnelId: string,
    date: string,
  ): Promise<{
    assignment: PersonnelShiftAssignment;
    group: ShiftGroup;
    patternDays: ShiftPatternDay[];
    referenceDate: string;
  } | null> {
    const response = await authRequestOrNull<ActiveAssignmentResponse | null>(
      `${BASE}/personnel/${encodeURIComponent(personnelId)}/active${queryString({ date })}`,
    );
    if (!response) return null;

    return {
      assignment: mapPersonnelShiftAssignment(response.assignment),
      group: mapShiftGroup(response.group, { referenceDate: response.referenceDate }),
      patternDays: response.patternDays.map((day) =>
        mapShiftPatternDay(day, response.group.pattern_id),
      ),
      referenceDate: response.referenceDate,
    };
  }

  async getShiftsForDate(
    institutionId: string,
    date: string,
  ): Promise<Array<{
    group: ShiftGroup;
    unit: Unit;
    personnel: Personnel[];
    shift: CalculatedShift;
  }>> {
    const response = await authRequest<ByDateResponse>(
      `${BASE}/by-date${queryString({ date })}`,
    );

    return response.groups.map((entry) => ({
      group: mapShiftGroup(entry.group, { institutionId }),
      unit: mapUnit(entry.unit, institutionId),
      personnel: entry.personnel.map((row) => mapPersonnel(row, institutionId)),
      shift: mapCalculatedShift(entry.shift, response.date ?? date),
    }));
  }
}
