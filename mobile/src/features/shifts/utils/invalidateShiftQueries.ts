import type { QueryClient } from '@tanstack/react-query';
import { shiftQueryKeyPrefixes } from '@/features/shifts/constants/shiftQueryKeys';

/** Vardiya verisi değişince tüm ilgili ekranları yenile. */
export async function invalidateShiftQueries(queryClient: QueryClient, unitId?: string) {
  await Promise.all(
    shiftQueryKeyPrefixes().map((key) => queryClient.invalidateQueries({ queryKey: key })),
  );
  if (unitId) {
    await queryClient.invalidateQueries({ queryKey: ['unit-detail', unitId] });
  }
}
