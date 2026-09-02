import type { Personnel } from '@/shared/types';
import { getPersonnelFullName } from '@/shared/utils/id';

export function filterPersonnelBySearch(personnel: Personnel[], query: string): Personnel[] {
  const q = query.trim().toLowerCase();
  if (!q) return personnel;

  return personnel.filter((person) => {
    const fullName = getPersonnelFullName(person).toLowerCase();
    return (
      fullName.includes(q) ||
      person.sicilNo.toLowerCase().includes(q) ||
      (person.title?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function formatPersonnelPreview(
  personnel: Personnel[],
  maxNames: number = 3,
): string {
  if (personnel.length === 0) return '';
  const names = personnel.slice(0, maxNames).map(getPersonnelFullName);
  const suffix = personnel.length > maxNames ? ` +${personnel.length - maxNames}` : '';
  return `${names.join(', ')}${suffix}`;
}
