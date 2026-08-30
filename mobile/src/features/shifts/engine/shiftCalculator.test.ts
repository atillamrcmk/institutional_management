import {
  calculateShiftForDate,
  daysBetweenDates,
  isWorkingShift,
} from './shiftCalculator';
import type { ShiftPatternDay } from '@/shared/types';

const MERKEZ_PATTERN: ShiftPatternDay[] = [
  { id: '1', patternId: 'p', dayIndex: 0, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
  { id: '2', patternId: 'p', dayIndex: 1, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
  { id: '3', patternId: 'p', dayIndex: 2, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
  { id: '4', patternId: 'p', dayIndex: 3, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
];

const DAY_NIGHT_OFF_PATTERN: ShiftPatternDay[] = [
  { id: '1', patternId: 'p1', dayIndex: 0, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
  { id: '2', patternId: 'p1', dayIndex: 1, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
  { id: '3', patternId: 'p1', dayIndex: 2, shiftType: 'OFF', startTime: null, endTime: null },
  { id: '4', patternId: 'p1', dayIndex: 3, shiftType: 'OFF', startTime: null, endTime: null },
];

const REFERENCE = '2026-08-29';

describe('shiftCalculator', () => {
  describe('calculateShiftForDate', () => {
    it('maps cycle days from group cycle start date', () => {
      const aStart = '2026-08-27';
      expect(calculateShiftForDate(MERKEZ_PATTERN, aStart, '2026-08-27').shiftType).toBe('DAY');
      expect(calculateShiftForDate(MERKEZ_PATTERN, aStart, '2026-08-28').shiftType).toBe('DAY');
      expect(calculateShiftForDate(MERKEZ_PATTERN, aStart, '2026-08-29').shiftType).toBe('NIGHT');
      expect(calculateShiftForDate(MERKEZ_PATTERN, aStart, '2026-08-30').shiftType).toBe('NIGHT');
    });

    it('B group starts later with its own cycle start date', () => {
      const bStart = '2026-08-31';
      expect(calculateShiftForDate(MERKEZ_PATTERN, bStart, '2026-08-31').shiftType).toBe('DAY');
      expect(calculateShiftForDate(MERKEZ_PATTERN, bStart, '2026-09-01').shiftType).toBe('DAY');
      expect(calculateShiftForDate(MERKEZ_PATTERN, bStart, '2026-09-02').shiftType).toBe('NIGHT');
      expect(calculateShiftForDate(MERKEZ_PATTERN, bStart, '2026-09-03').shiftType).toBe('NIGHT');
    });

    it('A night handover: D on day while A on night Aug 29', () => {
      const aStart = '2026-08-27';
      const dStart = '2026-08-29';
      const date = '2026-08-29';
      expect(calculateShiftForDate(MERKEZ_PATTERN, aStart, date).shiftType).toBe('NIGHT');
      expect(calculateShiftForDate(MERKEZ_PATTERN, dStart, date).shiftType).toBe('DAY');
    });

    it('maps generic 4-day cycle from reference', () => {
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-29').shiftType).toBe('DAY');
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-30').shiftType).toBe('NIGHT');
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-31').shiftType).toBe('OFF');
    });

    it('handles leap year boundary', () => {
      const leapPattern: ShiftPatternDay[] = [
        { id: '1', patternId: 'p2', dayIndex: 0, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
        { id: '2', patternId: 'p2', dayIndex: 1, shiftType: 'OFF', startTime: null, endTime: null },
      ];
      const ref = '2024-02-28';
      expect(calculateShiftForDate(leapPattern, ref, '2024-02-29').shiftType).toBe('OFF');
      expect(calculateShiftForDate(leapPattern, ref, '2024-03-01').shiftType).toBe('DAY');
    });

    it('handles dates before cycle start', () => {
      const result = calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-28');
      expect(result.shiftType).toBe('OFF');
      expect(result.cycleDayIndex).toBe(3);
    });
  });

  describe('daysBetweenDates', () => {
    it('calculates positive and negative offsets', () => {
      expect(daysBetweenDates('2026-08-29', '2026-08-30')).toBe(1);
      expect(daysBetweenDates('2026-08-29', '2026-08-28')).toBe(-1);
    });
  });

  describe('isWorkingShift', () => {
    it('identifies working shifts', () => {
      expect(isWorkingShift('DAY')).toBe(true);
      expect(isWorkingShift('NIGHT')).toBe(true);
      expect(isWorkingShift('FULL')).toBe(true);
      expect(isWorkingShift('OFF')).toBe(false);
    });
  });
});
