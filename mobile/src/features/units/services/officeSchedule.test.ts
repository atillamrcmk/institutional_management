import { getOfficeShiftForDate, isOfficeWorkday } from './officeSchedule';
import type { Unit } from '@/shared/types';

const officeUnit: Unit = {
  id: 'u1',
  institutionId: 'i1',
  parentId: null,
  name: 'İdari',
  minimumStaff: 0,
  managerPersonnelId: null,
  workScheduleType: 'OFFICE',
  officeStartTime: '08:00',
  officeEndTime: '17:00',
  createdAt: '',
  updatedAt: '',
};

describe('officeSchedule', () => {
  it('treats weekdays as office workdays', () => {
    expect(isOfficeWorkday('2026-09-02')).toBe(true);
    expect(isOfficeWorkday('2026-09-04')).toBe(true);
  });

  it('treats weekends as non-workdays', () => {
    expect(isOfficeWorkday('2026-09-05')).toBe(false);
    expect(isOfficeWorkday('2026-09-06')).toBe(false);
  });

  it('returns DAY shift on office weekdays', () => {
    const shift = getOfficeShiftForDate(officeUnit, '2026-09-02');
    expect(shift.shiftType).toBe('DAY');
    expect(shift.startTime).toBe('08:00');
    expect(shift.endTime).toBe('17:00');
  });

  it('returns OFF on weekends', () => {
    const shift = getOfficeShiftForDate(officeUnit, '2026-09-06');
    expect(shift.shiftType).toBe('OFF');
  });
});
