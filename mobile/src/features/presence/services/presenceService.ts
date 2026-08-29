import { calculateShiftForDate, isWorkingShift } from '@/features/shifts/engine/shiftCalculator';
import { getRepositories } from '@/shared/repositories';
import type { CalculatedShift, PersonnelPresence, ShiftGroup, Unit } from '@/shared/types';
import { todayDateString } from '@/shared/utils/id';

export interface PresenceFilters {
  unitId?: string;
  shiftGroupId?: string;
  status?: 'all' | 'on_duty' | 'on_assignment' | 'absent';
}

export async function getPresenceForDate(
  institutionId: string,
  date: string = todayDateString(),
  filters: PresenceFilters = {},
): Promise<PersonnelPresence[]> {
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
      shift = calculateShiftForDate(
        shiftData.patternDays,
        shiftData.referenceDate,
        date,
        shiftData.group.cycleOffset,
      );
      shiftGroup = shiftData.group;
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
    activeUnits: await getActiveUnitsSummary(institutionId, date),
  };
}

async function getActiveUnitsSummary(institutionId: string, date: string) {
  const repos = getRepositories();
  const presence = await getPresenceForDate(institutionId, date);
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
        shiftName: p.shiftGroup?.name,
      });
    }
  }

  return Array.from(unitMap.values()).sort((a, b) => a.unit.name.localeCompare(b.unit.name, 'tr'));
}
