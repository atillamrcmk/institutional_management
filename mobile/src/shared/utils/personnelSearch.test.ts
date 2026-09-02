import type { Personnel } from '@/shared/types';
import { filterPersonnelBySearch, formatPersonnelPreview } from './personnelSearch';

const sample: Personnel[] = [
  {
    id: '1',
    institutionId: 'i1',
    firstName: 'Ali',
    lastName: 'Yılmaz',
    sicilNo: 'KP-0001',
    title: 'Güvenlik',
    photoUri: null,
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    institutionId: 'i1',
    firstName: 'Ayşe',
    lastName: 'Demir',
    sicilNo: 'KP-0002',
    title: 'İdari',
    photoUri: null,
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: '',
  },
];

describe('personnelSearch', () => {
  it('filters by name and sicil', () => {
    expect(filterPersonnelBySearch(sample, 'ali')).toHaveLength(1);
    expect(filterPersonnelBySearch(sample, '0002')).toHaveLength(1);
    expect(filterPersonnelBySearch(sample, '')).toHaveLength(2);
  });

  it('formats preview with overflow count', () => {
    expect(formatPersonnelPreview(sample, 1)).toBe('Ali Yılmaz +1');
  });
});
