import type { ShiftPatternDay } from '@/shared/types';
import { calculateShiftForDate } from '@/features/shifts/engine/shiftCalculator';

const MERKEZ_PATTERN: ShiftPatternDay[] = [
  { id: '1', patternId: 'p', dayIndex: 0, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
  { id: '2', patternId: 'p', dayIndex: 1, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
  { id: '3', patternId: 'p', dayIndex: 2, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
  { id: '4', patternId: 'p', dayIndex: 3, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
];

describe('schedule logic (per-group cycle start)', () => {
  it('A group: 2 day + 2 night from Aug 27', () => {
    const start = '2026-08-27';
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-08-27').shiftType).toBe('DAY');
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-08-28').shiftType).toBe('DAY');
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-08-29').shiftType).toBe('NIGHT');
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-08-30').shiftType).toBe('NIGHT');
  });

  it('B group starts Aug 31 on same pattern', () => {
    const start = '2026-08-31';
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-08-31').shiftType).toBe('DAY');
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-09-01').shiftType).toBe('DAY');
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-09-02').shiftType).toBe('NIGHT');
    expect(calculateShiftForDate(MERKEZ_PATTERN, start, '2026-09-03').shiftType).toBe('NIGHT');
  });

  it('handover: D day + A night on same date', () => {
    const date = '2026-08-29';
    expect(calculateShiftForDate(MERKEZ_PATTERN, '2026-08-27', date).shiftType).toBe('NIGHT');
    expect(calculateShiftForDate(MERKEZ_PATTERN, '2026-08-29', date).shiftType).toBe('DAY');
  });
});

const PATTERN_24H_MIXED: ShiftPatternDay[] = [
  { id: '1', patternId: 'p', dayIndex: 0, shiftType: 'FULL', startTime: '08:00', endTime: '08:00' },
  { id: '2', patternId: 'p', dayIndex: 1, shiftType: 'OFF', startTime: null, endTime: null },
  { id: '3', patternId: 'p', dayIndex: 2, shiftType: 'OFF', startTime: null, endTime: null },
  { id: '4', patternId: 'p', dayIndex: 3, shiftType: 'FULL', startTime: '08:00', endTime: '08:00' },
  { id: '5', patternId: 'p', dayIndex: 4, shiftType: 'OFF', startTime: null, endTime: null },
  { id: '6', patternId: 'p', dayIndex: 5, shiftType: 'OFF', startTime: null, endTime: null },
  { id: '7', patternId: 'p', dayIndex: 6, shiftType: 'OFF', startTime: null, endTime: null },
];

describe('24 hour shift pattern', () => {
  it('follows 1 full + 2 off + 1 full + 3 off cycle', () => {
    const start = '2026-08-01';
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-01').shiftType).toBe('FULL');
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-02').shiftType).toBe('OFF');
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-03').shiftType).toBe('OFF');
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-04').shiftType).toBe('FULL');
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-05').shiftType).toBe('OFF');
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-06').shiftType).toBe('OFF');
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-07').shiftType).toBe('OFF');
    expect(calculateShiftForDate(PATTERN_24H_MIXED, start, '2026-08-08').shiftType).toBe('FULL');
  });
});
