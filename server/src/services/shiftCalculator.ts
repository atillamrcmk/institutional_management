/**
 * mobile/src/features/shifts/engine/shiftCalculator.ts ve
 * mobile/src/features/units/services/officeSchedule.ts port'u.
 * Aynı girdiler için mobil ile birebir aynı sonucu üretmelidir.
 */

export type ShiftType = 'DAY' | 'NIGHT' | 'FULL' | 'OFF';

export interface PatternDayRow {
  day_index: number;
  shift_type: string;
  start_time: string | null;
  end_time: string | null;
}

export interface CalculatedShift {
  date: string;
  shiftType: ShiftType;
  startTime: string | null;
  endTime: string | null;
  cycleDayIndex: number;
}

export interface OfficeUnitRow {
  work_schedule_type: string | null;
  office_start_time: string | null;
  office_end_time: string | null;
}

const OFF_SHIFT = (date: string): CalculatedShift => ({
  date,
  shiftType: 'OFF',
  startTime: null,
  endTime: null,
  cycleDayIndex: 0,
});

export function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetweenDates(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return result.toISOString().slice(0, 10);
}

/**
 * cycleStartDate = bu grup için desenin 0. gününün başladığı tarih.
 */
export function calculateShiftForDate(
  patternDays: PatternDayRow[],
  cycleStartDate: string,
  targetDate: string,
): CalculatedShift {
  if (patternDays.length === 0 || !cycleStartDate) {
    return OFF_SHIFT(targetDate);
  }

  const sorted = [...patternDays].sort((a, b) => a.day_index - b.day_index);
  const cycleLength = sorted.length;
  const dayOffset = daysBetweenDates(cycleStartDate, targetDate);
  const normalizedOffset = ((dayOffset % cycleLength) + cycleLength) % cycleLength;
  const patternDay = sorted.find((day) => day.day_index === normalizedOffset) ?? sorted[0];

  return {
    date: targetDate,
    shiftType: (patternDay.shift_type as ShiftType) ?? 'OFF',
    startTime: patternDay.start_time,
    endTime: patternDay.end_time,
    cycleDayIndex: normalizedOffset,
  };
}

export function isWorkingShift(shiftType: ShiftType): boolean {
  return shiftType === 'DAY' || shiftType === 'NIGHT' || shiftType === 'FULL';
}

/** Hafta içi (Pzt–Cum) mesai günü mü? */
export function isOfficeWorkday(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function getOfficeShiftForDate(unit: OfficeUnitRow, date: string): CalculatedShift {
  if (unit.work_schedule_type !== 'OFFICE' || !isOfficeWorkday(date)) {
    return OFF_SHIFT(date);
  }

  return {
    date,
    shiftType: 'DAY',
    startTime: unit.office_start_time || '08:00',
    endTime: unit.office_end_time || '17:00',
    cycleDayIndex: 0,
  };
}

export function shiftTypeLabel(shiftType: ShiftType): string {
  switch (shiftType) {
    case 'DAY':
      return 'Gündüz';
    case 'NIGHT':
      return 'Gece';
    case 'FULL':
      return '24 Saat';
    default:
      return 'İzin';
  }
}
