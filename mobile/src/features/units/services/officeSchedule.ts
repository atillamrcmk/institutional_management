import type { CalculatedShift, Unit } from '@/shared/types';

/** Hafta içi (Pzt–Cum) mesai günü mü? */
export function isOfficeWorkday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day >= 1 && day <= 5;
}

export function getOfficeShiftForDate(unit: Unit, date: string): CalculatedShift {
  if (unit.workScheduleType !== 'OFFICE' || !isOfficeWorkday(date)) {
    return {
      date,
      shiftType: 'OFF',
      startTime: null,
      endTime: null,
      cycleDayIndex: 0,
    };
  }

  return {
    date,
    shiftType: 'DAY',
    startTime: unit.officeStartTime || '08:00',
    endTime: unit.officeEndTime || '17:00',
    cycleDayIndex: 0,
  };
}

export function getUnitWorkScheduleLabel(unit: Unit): string {
  if (unit.workScheduleType === 'SHIFT') return 'Vardiyalı';
  return `Mesai ${unit.officeStartTime || '08:00'}–${unit.officeEndTime || '17:00'}`;
}
