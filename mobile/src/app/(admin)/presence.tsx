import { useState } from 'react';
import { FlatList, View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getPresenceForDate } from '@/features/presence/services/presenceService';
import { getRepositories } from '@/shared/repositories';
import { PersonnelCard } from '@/shared/components/PersonnelCard';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { Chip } from '@/shared/components/layout/Chip';
import { colors, modules, spacing } from '@/shared/theme';
import type { Unit } from '@/shared/types';
import { todayDateString } from '@/shared/utils/id';

export default function PresenceScreen() {
  const router = useRouter();
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const [unitFilter, setUnitFilter] = useState<string | undefined>();

  const { data: units } = useQuery({
    queryKey: ['units', institutionId],
    queryFn: () => getRepositories().units.getAll(institutionId),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['presence', institutionId, unitFilter],
    queryFn: () =>
      getPresenceForDate(institutionId, todayDateString(), {
        unitId: unitFilter,
      }),
  });

  if (isLoading) {
    return <LoadingState message="Personel durumu yükleniyor..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent}>
        <Chip
          label="Tümü"
          selected={!unitFilter}
          onPress={() => setUnitFilter(undefined)}
          color={modules.presence.main}
        />
        {units?.map((unit: Unit) => (
          <Chip
            key={unit.id}
            label={unit.name}
            selected={unitFilter === unit.id}
            onPress={() => setUnitFilter(unit.id)}
            color={modules.presence.main}
          />
        ))}
      </ScrollView>

      <FlatList
        data={data}
        keyExtractor={(item) => item.personnel.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState title="Kurumda personel yok" module="presence" />
        }
        renderItem={({ item }) => (
          <PersonnelCard
            item={item}
            onPress={() => router.push(`/(admin)/personnel/${item.personnel.id}`)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { maxHeight: 52 },
  filterContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
});
