import { calculateShiftForDate, isWorkingShift } from '@/features/shifts/engine/shiftCalculator';
import { getRepositories } from '@/shared/repositories';
import type { Personnel, ShiftGroup, ShiftType } from '@/shared/types';
import { addDaysToDateString } from '@/shared/utils/id';

export type WorkingShiftType = 'DAY' | 'NIGHT' | 'FULL';

export interface ShiftSlotAssignment {
  shiftType: WorkingShiftType;
  startTime: string;
  endTime: string;
  group: ShiftGroup;
  personnel: Personnel[];
}

export interface GroupDayStatus {
  group: ShiftGroup;
  shiftType: ShiftType;
  startTime: string | null;
  endTime: string | null;
  cycleDayIndex: number;
  personnel: Personnel[];
}

export interface UnitDaySchedule {
  date: string;
  unitId: string;
  unitName: string;
  daySlots: ShiftSlotAssignment[];
  nightSlots: ShiftSlotAssignment[];
  fullSlots: ShiftSlotAssignment[];
  /** @deprecated daySlots[0] kullanın */
  daySlot: ShiftSlotAssignment | null;
  /** @deprecated nightSlots[0] kullanın */
  nightSlot: ShiftSlotAssignment | null;
  offGroups: Array<{ group: ShiftGroup; personnel: Personnel[] }>;
  allGroups: GroupDayStatus[];
  collisions: string[];
}

export interface UnitShiftOverview {
  unitId: string;
  unitName: string;
  schedule: UnitDaySchedule;
}

export function getScheduleActiveSlots(schedule: UnitDaySchedule): ShiftSlotAssignment[] {
  return [...schedule.daySlots, ...schedule.nightSlots, ...schedule.fullSlots];
}

export async function getUnitGroupStatuses(
  unitId: string,
  date: string,
): Promise<GroupDayStatus[]> {
  const repos = getRepositories();
  const groups = await repos.shifts.getGroupsByUnit(unitId);
  const statuses: GroupDayStatus[] = [];

  for (const group of groups) {
    const patternDays = await repos.shifts.getPatternDays(group.patternId);
    const shift = calculateShiftForDate(patternDays, group.cycleStartDate, date);
    const personnel = await repos.shifts.getPersonnelInGroup(group.id);

    statuses.push({
      group,
      shiftType: shift.shiftType,
      startTime: shift.startTime,
      endTime: shift.endTime,
      cycleDayIndex: shift.cycleDayIndex,
      personnel,
    });
  }

  return statuses;
}

export async function getUnitScheduleForDate(
  unitId: string,
  date: string,
): Promise<UnitDaySchedule | null> {
  const repos = getRepositories();
  const unit = await repos.units.getById(unitId);
  if (!unit) return null;

  const allGroups = await getUnitGroupStatuses(unitId, date);
  const daySlots: ShiftSlotAssignment[] = [];
  const nightSlots: ShiftSlotAssignment[] = [];
  const fullSlots: ShiftSlotAssignment[] = [];
  const offGroups: UnitDaySchedule['offGroups'] = [];
  const collisions: string[] = [];

  for (const status of allGroups) {
    if (!isWorkingShift(status.shiftType)) {
      offGroups.push({ group: status.group, personnel: status.personnel });
      continue;
    }

    const slot: ShiftSlotAssignment = {
      shiftType: status.shiftType as WorkingShiftType,
      startTime: status.startTime!,
      endTime: status.endTime!,
      group: status.group,
      personnel: status.personnel,
    };

    if (status.shiftType === 'DAY') {
      daySlots.push(slot);
    } else if (status.shiftType === 'NIGHT') {
      nightSlots.push(slot);
    } else {
      fullSlots.push(slot);
    }
  }

  if (daySlots.length > 1) {
    collisions.push(
      `Gündüz çakışması: ${daySlots.map((s) => s.group.name).join(', ')}`,
    );
  }
  if (nightSlots.length > 1) {
    collisions.push(
      `Gece çakışması: ${nightSlots.map((s) => s.group.name).join(', ')}`,
    );
  }
  if (fullSlots.length > 1) {
    collisions.push(
      `24 saat çakışması: ${fullSlots.map((s) => s.group.name).join(', ')}`,
    );
  }

  return {
    date,
    unitId,
    unitName: unit.name,
    daySlots,
    nightSlots,
    fullSlots,
    daySlot: daySlots[0] ?? null,
    nightSlot: nightSlots[0] ?? null,
    offGroups,
    allGroups,
    collisions,
  };
}

export async function getInstitutionShiftOverview(
  institutionId: string,
  date: string,
): Promise<UnitShiftOverview[]> {
  const repos = getRepositories();
  const units = await repos.units.getAll(institutionId);
  const results: UnitShiftOverview[] = [];

  for (const unit of units) {
    const groups = await repos.shifts.getGroupsByUnit(unit.id);
    if (groups.length === 0) continue;

    const schedule = await getUnitScheduleForDate(unit.id, date);
    if (!schedule) continue;

    results.push({
      unitId: unit.id,
      unitName: unit.name,
      schedule,
    });
  }

  return results.sort((a, b) => a.unitName.localeCompare(b.unitName, 'tr'));
}

export async function getInstitutionActiveShifts(
  institutionId: string,
  date: string,
): Promise<Array<{ unitId: string; unitName: string; slot: ShiftSlotAssignment }>> {
  const overview = await getInstitutionShiftOverview(institutionId, date);
  const results: Array<{ unitId: string; unitName: string; slot: ShiftSlotAssignment }> = [];

  for (const { unitId, unitName, schedule } of overview) {
    for (const slot of getScheduleActiveSlots(schedule)) {
      results.push({ unitId, unitName, slot });
    }
  }

  const order: Record<WorkingShiftType, number> = { DAY: 0, FULL: 1, NIGHT: 2 };
  return results.sort((a, b) => {
    const unitCmp = a.unitName.localeCompare(b.unitName, 'tr');
    if (unitCmp !== 0) return unitCmp;
    return order[a.slot.shiftType] - order[b.slot.shiftType];
  });
}

export async function getUnitScheduleRange(
  unitId: string,
  startDate: string,
  dayCount: number,
): Promise<UnitDaySchedule[]> {
  const schedules: UnitDaySchedule[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDaysToDateString(startDate, i);
    const schedule = await getUnitScheduleForDate(unitId, date);
    if (schedule) schedules.push(schedule);
  }
  return schedules;
}
