/** TanStack Query anahtarları — vardiya verisi değişince hepsini invalidate edin. */
export const shiftQueryKeys = {
  all: ['shifts'] as const,
  activeShifts: (institutionId: string, date: string) =>
    ['active-shifts', institutionId, date] as const,
  unitSchedulesToday: (institutionId: string, date: string) =>
    ['unit-schedules-today', institutionId, date] as const,
  overview: (institutionId: string, date: string) =>
    ['shift-overview', institutionId, date] as const,
};

export function shiftQueryKeyPrefixes() {
  return [
    shiftQueryKeys.all,
    ['active-shifts'],
    ['unit-schedules-today'],
    ['shift-overview'],
    ['units-with-shifts'],
    ['presence'],
    ['dashboard'],
  ];
}
