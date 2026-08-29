import type { ShiftPatternDay } from '@/shared/types';
import { calculateShiftForDate } from '@/features/shifts/engine/shiftCalculator';

const MERKEZ_PATTERN: ShiftPatternDay[] = [
  { id: '1', patternId: 'p', dayIndex: 0, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
  { id: '2', patternId: 'p', dayIndex: 1, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
  { id: '3', patternId: 'p', dayIndex: 2, shiftType: 'OFF', startTime: null, endTime: null },
];

const REF = '2026-08-29';

describe('schedule logic (unit day/night slots)', () => {
  it('assigns A to night and B to day on same date with offsets 0 and 2', () => {
    const date = '2026-08-30'; // ref+1 = NIGHT for offset 0

    const groupA = calculateShiftForDate(MERKEZ_PATTERN, REF, date, 0);
    const groupB = calculateShiftForDate(MERKEZ_PATTERN, REF, date, 2);

    expect(groupA.shiftType).toBe('NIGHT');
    expect(groupB.shiftType).toBe('DAY');
    expect(groupA.startTime).toBe('20:00');
    expect(groupB.startTime).toBe('08:00');
  });

  it('only one group works per slot in 4-group rotation', () => {
    const fourDay: ShiftPatternDay[] = [
      { id: '1', patternId: 'p', dayIndex: 0, shiftType: 'DAY', startTime: '08:00', endTime: '20:00' },
      { id: '2', patternId: 'p', dayIndex: 1, shiftType: 'NIGHT', startTime: '20:00', endTime: '08:00' },
      { id: '3', patternId: 'p', dayIndex: 2, shiftType: 'OFF', startTime: null, endTime: null },
      { id: '4', patternId: 'p', dayIndex: 3, shiftType: 'OFF', startTime: null, endTime: null },
    ];

    const date = REF;
    const shifts = [0, 1, 2, 3].map((offset) =>
      calculateShiftForDate(fourDay, REF, date, offset).shiftType,
    );

    const working = shifts.filter((s) => s === 'DAY' || s === 'NIGHT');
    expect(working).toHaveLength(2);
    expect(shifts).toEqual(['DAY', 'NIGHT', 'OFF', 'OFF']);
  });
});
