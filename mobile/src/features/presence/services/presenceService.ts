import { calculateShiftForDate, isWorkingShift } from '@/features/shifts/engine/shiftCalculator';
import { getOfficeShiftForDate } from '@/features/units/services/officeSchedule';
import { fetchOfficeUnitsSummary, fetchPresenceForDate } from '@/shared/api/presenceApi';
import { hasServerSession } from '@/shared/api/session';
import { getRepositories, isUsingApiRepositories } from '@/shared/repositories';
import type { CalculatedShift, Personnel, PersonnelPresence, ShiftGroup, Unit } from '@/shared/types';
import { todayDateString } from '@/shared/utils/id';

/** Görev durumu sunucuda hesaplanabiliyorsa istemci tarafı hesaplama atlanır. */
function useServerPresence(): boolean {
  return isUsingApiRepositories() && hasServerSession();
}

export interface PresenceFilters {
  unitId?: string;
  shiftGroupId?: string;
  status?: 'all' | 'on_duty' | 'on_assignment' | 'absent';
}

export interface OfficeUnitSummary {
  unitId: string;
  unitName: string;
  startTime: string;
  endTime: string;
  personnel: Personnel[];
}

export async function getOfficeUnitsSummary(
  institutionId: string,
  date: string = todayDateString(),
): Promise<OfficeUnitSummary[]> {
  if (useServerPresence()) {
    const summaries = await fetchOfficeUnitsSummary(institutionId, date);
    return summaries.sort((a, b) => a.unitName.localeCompare(b.unitName, 'tr'));
  }

  const repos = getRepositories();
  const units = await repos.units.getAll(institutionId);
  const results: OfficeUnitSummary[] = [];

  for (const unit of units) {
    if (unit.workScheduleType !== 'OFFICE') continue;

    const officeShift = getOfficeShiftForDate(unit, date);
    if (!isWorkingShift(officeShift.shiftType)) continue;

    const personnel = await repos.units.getActivePersonnelForUnit(unit.id);
    if (personnel.length === 0) continue;

    results.push({
      unitId: unit.id,
      unitName: unit.name,
      startTime: officeShift.startTime!,
      endTime: officeShift.endTime!,
      personnel,
    });
  }

  return results.sort((a, b) => a.unitName.localeCompare(b.unitName, 'tr'));
}

export async function getPresenceForDate(
  institutionId: string,
  date: string = todayDateString(),
  filters: PresenceFilters = {},
): Promise<PersonnelPresence[]> {
  if (useServerPresence()) {
    const entries = await fetchPresenceForDate(institutionId, date, filters);
    return entries.sort((a, b) =>
      a.personnel.lastName.localeCompare(b.personnel.lastName, 'tr'),
    );
  }

  const repos = getRepositories();
  const allPersonnel = await repos.personnel.getAll(institutionId);
  const results: PersonnelPresence[] = [];

  for (const personnel of allPersonnel) {
    const isAbsent = await repos.absences.isAbsentOnDate(personnel.id, date);
    const unit = await repos.units.getCurrentUnitForPersonnel(personnel.id);
    const shiftData = await repos.shifts.getActiveAssignmentForPersonnel(personnel.id, date);
    const activeAssignment = await repos.assignments.getActiveForPersonnelOnDate(personnel.id, date);

    let shift: CalculatedShift = {
      date,
      shiftType: 'OFF',
      startTime: null,
      endTime: null,
      cycleDayIndex: 0,
    };
    let shiftGroup: ShiftGroup | null = null;

    if (shiftData) {
      shift = calculateShiftForDate(shiftData.patternDays, shiftData.group.cycleStartDate, date);
      shiftGroup = shiftData.group;
    } else if (unit?.workScheduleType === 'OFFICE') {
      shift = getOfficeShiftForDate(unit, date);
    }

    let status: PersonnelPresence['status'] = 'ON_DUTY';
    let assignmentTitle: string | undefined;
    let assignmentTime: string | undefined;

    if (isAbsent) {
      status = 'ABSENT';
    } else if (activeAssignment) {
      status = 'ON_ASSIGNMENT';
      assignmentTitle = activeAssignment.title;
      assignmentTime = activeAssignment.endTime
        ? `${activeAssignment.startTime} – ${activeAssignment.endTime}`
        : activeAssignment.startTime;
    } else if (!isWorkingShift(shift.shiftType)) {
      continue;
    }

    if (filters.unitId && unit?.id !== filters.unitId) continue;
    if (filters.shiftGroupId && shiftGroup?.id !== filters.shiftGroupId) continue;
    if (filters.status === 'on_duty' && status !== 'ON_DUTY') continue;
    if (filters.status === 'on_assignment' && status !== 'ON_ASSIGNMENT') continue;
    if (filters.status === 'absent' && status !== 'ABSENT') continue;

    results.push({
      personnel,
      unit,
      shiftGroup,
      shift,
      status,
      assignmentTitle,
      assignmentTime,
    });
  }

  return results.sort((a, b) =>
    a.personnel.lastName.localeCompare(b.personnel.lastName, 'tr'),
  );
}

export async function getDashboardStats(institutionId: string, date: string = todayDateString()) {
  const repos = getRepositories();
  const presence = await getPresenceForDate(institutionId, date);
  const onDuty = presence.filter((p) => p.status === 'ON_DUTY');
  const onAssignment = presence.filter((p) => p.status === 'ON_ASSIGNMENT');
  const absent = presence.filter((p) => p.status === 'ABSENT');

  const shiftData = await repos.shifts.getShiftsForDate(institutionId, date);
  const activeShifts = shiftData.filter((s: { shift: CalculatedShift }) =>
    isWorkingShift(s.shift.shiftType),
  );

  return {
    date,
    totalOnDuty: onDuty.length + onAssignment.length,
    activeShiftGroups: activeShifts.length,
    absentCount: absent.length,
    onAssignment: onAssignment.length,
    available: onDuty.length,
    activeUnits: getActiveUnitsSummary(presence),
  };
}

function getActiveUnitsSummary(presence: PersonnelPresence[]) {
  const unitMap = new Map<string, { unit: Unit; count: number; shiftName?: string }>();

  for (const p of presence) {
    if (!p.unit || (p.status !== 'ON_DUTY' && p.status !== 'ON_ASSIGNMENT')) continue;
    const existing = unitMap.get(p.unit.id);
    if (existing) {
      existing.count += 1;
    } else {
      unitMap.set(p.unit.id, {
        unit: p.unit,
        count: 1,
        shiftName: p.shiftGroup?.name ?? (p.unit.workScheduleType === 'OFFICE' ? 'Mesai' : undefined),
      });
    }
  }

  return Array.from(unitMap.values()).sort((a, b) => a.unit.name.localeCompare(b.unit.name, 'tr'));
}
