import { calculateShiftForDate, isWorkingShift } from '@/features/shifts/engine/shiftCalculator';
import { getRepositories } from '@/shared/repositories';
import type { Personnel, ShiftGroup } from '@/shared/types';
import { addDaysToDateString } from '@/shared/utils/id';

export interface ShiftSlotAssignment {
  shiftType: 'DAY' | 'NIGHT';
  startTime: string;
  endTime: string;
  group: ShiftGroup;
  personnel: Personnel[];
}

export interface UnitDaySchedule {
  date: string;
  unitId: string;
  unitName: string;
  daySlot: ShiftSlotAssignment | null;
  nightSlot: ShiftSlotAssignment | null;
  offGroups: Array<{ group: ShiftGroup; personnel: Personnel[] }>;
}

export async function getUnitScheduleForDate(
  unitId: string,
  date: string,
): Promise<UnitDaySchedule | null> {
  const repos = getRepositories();
  const unit = await repos.units.getById(unitId);
  if (!unit) return null;

  const groups = await repos.shifts.getGroupsByUnit(unitId);
  let daySlot: ShiftSlotAssignment | null = null;
  let nightSlot: ShiftSlotAssignment | null = null;
  const offGroups: UnitDaySchedule['offGroups'] = [];

  for (const group of groups) {
    const pattern = await repos.shifts.getPatternById(group.patternId);
    if (!pattern) continue;

    const patternDays = await repos.shifts.getPatternDays(group.patternId);
    const shift = calculateShiftForDate(
      patternDays,
      pattern.referenceDate,
      date,
      group.cycleOffset,
    );
    const personnel = await repos.shifts.getPersonnelInGroup(group.id);

    if (!isWorkingShift(shift.shiftType)) {
      offGroups.push({ group, personnel });
      continue;
    }

    const slot: ShiftSlotAssignment = {
      shiftType: shift.shiftType as 'DAY' | 'NIGHT',
      startTime: shift.startTime!,
      endTime: shift.endTime!,
      group,
      personnel,
    };

    if (shift.shiftType === 'DAY') {
      daySlot = slot;
    } else {
      nightSlot = slot;
    }
  }

  return {
    date,
    unitId,
    unitName: unit.name,
    daySlot,
    nightSlot,
    offGroups,
  };
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
