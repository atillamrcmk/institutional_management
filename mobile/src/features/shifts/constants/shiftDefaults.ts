import type { ShiftType } from '@/shared/types';

/** Kurum standardı vardiya saatleri — döngü oluştururken otomatik doldurulur. */
export const DEFAULT_DAY_START = '08:00';
export const DEFAULT_DAY_END = '20:00';
export const DEFAULT_NIGHT_START = '20:00';
export const DEFAULT_NIGHT_END = '08:00';

export function defaultTimesForShiftType(shiftType: ShiftType): {
  startTime: string;
  endTime: string;
} {
  switch (shiftType) {
    case 'DAY':
      return { startTime: DEFAULT_DAY_START, endTime: DEFAULT_DAY_END };
    case 'NIGHT':
      return { startTime: DEFAULT_NIGHT_START, endTime: DEFAULT_NIGHT_END };
    case 'OFF':
      return { startTime: '', endTime: '' };
  }
}

export const PRESET_CYCLE_3_DAY = [
  { shiftType: 'DAY' as const, ...defaultTimesForShiftType('DAY') },
  { shiftType: 'NIGHT' as const, ...defaultTimesForShiftType('NIGHT') },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
];

export const PRESET_CYCLE_4_DAY = [
  { shiftType: 'DAY' as const, ...defaultTimesForShiftType('DAY') },
  { shiftType: 'NIGHT' as const, ...defaultTimesForShiftType('NIGHT') },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
];

export function formatSlotLabel(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`;
}
