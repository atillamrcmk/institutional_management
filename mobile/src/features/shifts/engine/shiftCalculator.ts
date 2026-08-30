import type { CalculatedShift, ShiftPatternDay, ShiftType } from '@/shared/types';

/**
 * Calculates which pattern day applies to a shift group on targetDate.
 * cycleStartDate = the date when day index 0 of the pattern begins for this group.
 */
export function calculateShiftForDate(
  patternDays: ShiftPatternDay[],
  cycleStartDate: string,
  targetDate: string,
): CalculatedShift {
  if (patternDays.length === 0) {
    return {
      date: targetDate,
      shiftType: 'OFF',
      startTime: null,
      endTime: null,
      cycleDayIndex: 0,
    };
  }

  const sorted = [...patternDays].sort((a, b) => a.dayIndex - b.dayIndex);
  const cycleLength = sorted.length;
  const dayOffset = daysBetweenDates(cycleStartDate, targetDate);
  const normalizedOffset = ((dayOffset % cycleLength) + cycleLength) % cycleLength;
  const patternDay = sorted.find((d) => d.dayIndex === normalizedOffset) ?? sorted[0];

  return {
    date: targetDate,
    shiftType: patternDay.shiftType,
    startTime: patternDay.startTime,
    endTime: patternDay.endTime,
    cycleDayIndex: normalizedOffset,
  };
}

export function daysBetweenDates(from: string, to: string): number {
  const fromParts = from.split('-').map(Number);
  const toParts = to.split('-').map(Number);
  const fromUtc = Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2]);
  const toUtc = Date.UTC(toParts[0], toParts[1] - 1, toParts[2]);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export function isWorkingShift(shiftType: ShiftType): boolean {
  return shiftType === 'DAY' || shiftType === 'NIGHT' || shiftType === 'FULL';
}

export function formatShiftTime(start: string | null, end: string | null): string {
  if (!start || !end) return 'İzin';
  return `${start} – ${end}`;
}

export function getShiftTypeLabel(shiftType: ShiftType): string {
  switch (shiftType) {
    case 'DAY':
      return 'Gündüz';
    case 'NIGHT':
      return 'Gece';
    case 'FULL':
      return '24 Saat';
    case 'OFF':
      return 'İzin';
  }
}
