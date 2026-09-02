import { calculateShiftForDate, getShiftTypeLabel, isWorkingShift } from '@/features/shifts/engine/shiftCalculator';
import { getOfficeShiftForDate } from '@/features/units/services/officeSchedule';
import { formatSlotLabel } from '@/features/shifts/constants/shiftDefaults';
import {
  getInstitutionShiftOverview,
  getScheduleActiveSlots,
} from '@/features/shifts/services/scheduleService';
import { getOfficeUnitsSummary } from '@/features/presence/services/presenceService';
import { getRepositories } from '@/shared/repositories';
import type { ShiftType } from '@/shared/types';
import { addDaysToDateString, getPersonnelFullName, todayDateString } from '@/shared/utils/id';

export interface PersonnelCalendarDay {
  date: string;
  shiftType: ShiftType;
  startTime: string | null;
  endTime: string | null;
  label: string;
  unitName: string | null;
}

export interface PublicDutySlot {
  unitName: string;
  title: string;
  timeLabel: string;
  personnelNames: string[];
}

export async function getPersonnelCalendarDays(
  personnelId: string,
  startDate: string = todayDateString(),
  dayCount: number = 14,
): Promise<PersonnelCalendarDay[]> {
  const repos = getRepositories();
  const unit = await repos.units.getCurrentUnitForPersonnel(personnelId);
  const shiftData = await repos.shifts.getActiveAssignmentForPersonnel(personnelId, startDate);
  const days: PersonnelCalendarDay[] = [];

  for (let i = 0; i < dayCount; i++) {
    const date = addDaysToDateString(startDate, i);
    let shiftType: ShiftType = 'OFF';
    let startTime: string | null = null;
    let endTime: string | null = null;
    let label = 'İzin';

    if (shiftData) {
      const shift = calculateShiftForDate(
        shiftData.patternDays,
        shiftData.group.cycleStartDate,
        date,
      );
      shiftType = shift.shiftType;
      startTime = shift.startTime;
      endTime = shift.endTime;
      label = isWorkingShift(shift.shiftType)
        ? shiftData.group.name
        : getShiftTypeLabel(shift.shiftType);
    } else if (unit?.workScheduleType === 'OFFICE') {
      const officeShift = getOfficeShiftForDate(unit, date);
      shiftType = officeShift.shiftType;
      startTime = officeShift.startTime;
      endTime = officeShift.endTime;
      label = isWorkingShift(officeShift.shiftType) ? 'Mesai' : 'İzin';
    }

    days.push({
      date,
      shiftType,
      startTime,
      endTime,
      label,
      unitName: unit?.name ?? null,
    });
  }

  return days;
}

export async function getPublicDutyOverview(
  institutionId: string,
  date: string = todayDateString(),
): Promise<PublicDutySlot[]> {
  const results: PublicDutySlot[] = [];

  const officeUnits = await getOfficeUnitsSummary(institutionId, date);
  for (const office of officeUnits) {
    results.push({
      unitName: office.unitName,
      title: 'Mesai',
      timeLabel: `${office.startTime} – ${office.endTime}`,
      personnelNames: office.personnel.map(getPersonnelFullName),
    });
  }

  const shiftOverview = await getInstitutionShiftOverview(institutionId, date);
  for (const unitItem of shiftOverview) {
    for (const slot of getScheduleActiveSlots(unitItem.schedule)) {
      results.push({
        unitName: unitItem.unitName,
        title: slot.group.name,
        timeLabel: formatSlotLabel(slot.startTime, slot.endTime, slot.shiftType),
        personnelNames: slot.personnel.map(getPersonnelFullName),
      });
    }
  }

  return results.sort((a, b) => a.unitName.localeCompare(b.unitName, 'tr'));
}

export async function getPersonnelProfileSummary(personnelId: string) {
  const repos = getRepositories();
  const personnel = await repos.personnel.getById(personnelId);
  if (!personnel) return null;

  const unit = await repos.units.getCurrentUnitForPersonnel(personnelId);
  const shiftData = await repos.shifts.getActiveAssignmentForPersonnel(personnelId, todayDateString());

  return {
    fullName: getPersonnelFullName(personnel),
    sicilNo: personnel.sicilNo,
    title: personnel.title,
    unitName: unit?.name ?? null,
    shiftGroupName: shiftData?.group.name ?? (unit?.workScheduleType === 'OFFICE' ? 'Mesai' : null),
  };
}
