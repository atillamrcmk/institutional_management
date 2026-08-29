import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { getRepositories } from '@/shared/repositories';
import { getUnitScheduleForDate } from '@/features/shifts/services/scheduleService';
import { UnitShiftScheduleCard } from '@/shared/components/UnitShiftSchedule';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { colors, spacing } from '@/shared/theme';
import { todayDateString } from '@/shared/utils/id';

export default function ShiftsListScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const [selectedDate] = useState(todayDateString());

  const { data: units, isLoading: unitsLoading } = useQuery({
    queryKey: ['units-with-shifts', institutionId],
    queryFn: async () => {
      const repos = getRepositories();
      const allUnits = await repos.units.getAll(institutionId!);
      const withGroups = await Promise.all(
        allUnits.map(async (unit) => {
          const groups = await repos.shifts.getGroupsByUnit(unit.id);
          return groups.length > 0 ? unit : null;
        }),
      );
      return withGroups.filter(Boolean) as typeof allUnits;
    },
    enabled: !!institutionId,
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['unit-schedules-today', institutionId, selectedDate, units?.map((u) => u.id)],
    queryFn: async () => {
      if (!units?.length) return [];
      const results = await Promise.all(
        units.map((unit) => getUnitScheduleForDate(unit.id, selectedDate)),
      );
      return results.filter(Boolean);
    },
    enabled: !!units?.length,
  });

  if (unitsLoading || schedulesLoading) return <LoadingState />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          title="Vardiya Döngüleri"
          variant="outline"
          onPress={() => router.push('/(admin)/shifts/patterns')}
          fullWidth
        />
      </View>
      <FlatList
        data={schedules}
        keyExtractor={(item) => item!.unitId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Vardiya planı yok"
            message="Birimlere vardiya grubu ve döngü tanımlayın."
            module="shifts"
          />
        }
        renderItem={({ item }) =>
          item ? (
            <View style={styles.cardWrap}>
              <UnitShiftScheduleCard
                schedule={item}
                onPressDate={() => router.push(`/(admin)/units/${item.unitId}/schedule`)}
              />
              <Button
                title="Tüm Planı Gör"
                variant="ghost"
                onPress={() => router.push(`/(admin)/units/${item.unitId}/schedule`)}
                fullWidth
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md },
  list: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xxl, gap: spacing.md },
  cardWrap: { gap: spacing.xs, marginBottom: spacing.sm },
});
