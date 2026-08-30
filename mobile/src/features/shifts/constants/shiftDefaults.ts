import type { ShiftType } from '@/shared/types';

/** Kurum standardı vardiya saatleri — döngü oluştururken otomatik doldurulur. */
export const DEFAULT_DAY_START = '08:00';
export const DEFAULT_DAY_END = '20:00';
export const DEFAULT_NIGHT_START = '20:00';
export const DEFAULT_NIGHT_END = '08:00';
/** 24 saat nöbet: aynı saatte başlayıp ertesi gün aynı saatte biter */
export const DEFAULT_FULL_START = '08:00';
export const DEFAULT_FULL_END = '08:00';

export function defaultTimesForShiftType(shiftType: ShiftType): {
  startTime: string;
  endTime: string;
} {
  switch (shiftType) {
    case 'DAY':
      return { startTime: DEFAULT_DAY_START, endTime: DEFAULT_DAY_END };
    case 'NIGHT':
      return { startTime: DEFAULT_NIGHT_START, endTime: DEFAULT_NIGHT_END };
    case 'FULL':
      return { startTime: DEFAULT_FULL_START, endTime: DEFAULT_FULL_END };
    case 'OFF':
      return { startTime: '', endTime: '' };
  }
}

export const PRESET_CYCLE_3_DAY = [
  { shiftType: 'DAY' as const, ...defaultTimesForShiftType('DAY') },
  { shiftType: 'NIGHT' as const, ...defaultTimesForShiftType('NIGHT') },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
];

/** Merkez: 2 gündüz · 2 gece · 4 izin (8 günlük döngü) */
export const PRESET_CYCLE_MERKEZ = [
  { shiftType: 'DAY' as const, ...defaultTimesForShiftType('DAY') },
  { shiftType: 'DAY' as const, ...defaultTimesForShiftType('DAY') },
  { shiftType: 'NIGHT' as const, ...defaultTimesForShiftType('NIGHT') },
  { shiftType: 'NIGHT' as const, ...defaultTimesForShiftType('NIGHT') },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
];

export const PRESET_CYCLE_4_DAY = [
  { shiftType: 'DAY' as const, ...defaultTimesForShiftType('DAY') },
  { shiftType: 'NIGHT' as const, ...defaultTimesForShiftType('NIGHT') },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
];

/** 24 saat nöbet · 2 izin · 24 saat nöbet · 3 izin (7 günlük döngü) */
export const PRESET_CYCLE_24H_MIXED = [
  { shiftType: 'FULL' as const, ...defaultTimesForShiftType('FULL') },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'FULL' as const, ...defaultTimesForShiftType('FULL') },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
  { shiftType: 'OFF' as const, startTime: '', endTime: '' },
];

export function formatSlotLabel(
  startTime: string,
  endTime: string,
  shiftType?: ShiftType,
): string {
  if (shiftType === 'FULL') {
    return `${startTime} – ${endTime} (+1 gün, 24 saat)`;
  }
  return `${startTime} – ${endTime}`;
}

export function formatCycleSummary(
  days: Array<{ shiftType: ShiftType }>,
): string {
  let day = 0;
  let night = 0;
  let full = 0;
  let off = 0;
  for (const d of days) {
    if (d.shiftType === 'DAY') day += 1;
    else if (d.shiftType === 'NIGHT') night += 1;
    else if (d.shiftType === 'FULL') full += 1;
    else off += 1;
  }
  const parts: string[] = [];
  if (day) parts.push(`${day} Gündüz`);
  if (night) parts.push(`${night} Gece`);
  if (full) parts.push(`${full}×24 Saat`);
  if (off) parts.push(`${off} İzin`);
  return parts.join(' · ') || 'Boş döngü';
}
