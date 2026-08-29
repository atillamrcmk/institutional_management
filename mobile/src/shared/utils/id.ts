export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDateString(): string {
  return formatLocalDate(new Date());
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

export function daysBetween(from: string, to: string): number {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const diff = toDate.getTime() - fromDate.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function getPersonnelFullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}
