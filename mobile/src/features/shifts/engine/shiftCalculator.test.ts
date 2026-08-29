import {
  calculateShiftForDate,
  daysBetweenDates,
  isWorkingShift,
} from './shiftCalculator';
import type { ShiftPatternDay } from '@/shared/types';

const DAY_NIGHT_OFF_PATTERN: ShiftPatternDay[] = [
  { id: '1', patternId: 'p1', dayIndex: 0, shiftType: 'DAY', startTime: '07:00', endTime: '19:00' },
  { id: '2', patternId: 'p1', dayIndex: 1, shiftType: 'NIGHT', startTime: '19:00', endTime: '07:00' },
  { id: '3', patternId: 'p1', dayIndex: 2, shiftType: 'OFF', startTime: null, endTime: null },
  { id: '4', patternId: 'p1', dayIndex: 3, shiftType: 'OFF', startTime: null, endTime: null },
];

const REFERENCE = '2026-08-29';

describe('shiftCalculator', () => {
  describe('calculateShiftForDate', () => {
    it('maps cycle days correctly from reference date', () => {
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-29').shiftType).toBe('DAY');
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-30').shiftType).toBe('NIGHT');
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-31').shiftType).toBe('OFF');
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-09-01').shiftType).toBe('OFF');
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-09-02').shiftType).toBe('DAY');
    });

    it('handles overnight shifts', () => {
      const night = calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-30');
      expect(night.shiftType).toBe('NIGHT');
      expect(night.startTime).toBe('19:00');
      expect(night.endTime).toBe('07:00');
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

    it('handles month boundaries', () => {
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-31').cycleDayIndex).toBe(2);
      expect(calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-09-01').cycleDayIndex).toBe(3);
    });

    it('handles year boundaries', () => {
      const result = calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, '2025-12-31', '2026-01-01');
      expect(result.shiftType).toBe('NIGHT');
    });

    it('handles dates before reference', () => {
      const result = calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, '2026-08-28');
      expect(result.shiftType).toBe('OFF');
      expect(result.cycleDayIndex).toBe(3);
    });

    it('staggers groups with cycle offset', () => {
      const merkezPattern: ShiftPatternDay[] = [
        { id: '1', patternId: 'p3', dayIndex: 0, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
        { id: '2', patternId: 'p3', dayIndex: 1, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
        { id: '3', patternId: 'p3', dayIndex: 2, shiftType: 'OFF', startTime: null, endTime: null },
      ];
      const date = '2026-08-30'; // day 1 from reference = NIGHT for offset 0

      const groupA = calculateShiftForDate(merkezPattern, REFERENCE, date, 0);
      const groupB = calculateShiftForDate(merkezPattern, REFERENCE, date, 2);

      expect(groupA.shiftType).toBe('NIGHT');
      expect(groupB.shiftType).toBe('DAY');
    });

    it('rotates four groups across a four-day cycle', () => {
      const date = REFERENCE;
      const offsets = [0, 1, 2, 3];
      const shifts = offsets.map((offset) =>
        calculateShiftForDate(DAY_NIGHT_OFF_PATTERN, REFERENCE, date, offset).shiftType,
      );
      expect(shifts).toEqual(['DAY', 'NIGHT', 'OFF', 'OFF']);
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
      expect(isWorkingShift('OFF')).toBe(false);
    });
  });
});
