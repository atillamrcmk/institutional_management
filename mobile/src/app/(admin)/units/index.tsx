import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { getUnitWorkScheduleLabel } from '@/features/units/services/officeSchedule';
import type { Unit } from '@/shared/types';
import { colors, spacing } from '@/shared/theme';

export default function UnitsListScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();

  const { data: units, isLoading } = useQuery({
    queryKey: ['units-all', institutionId],
    queryFn: () => getRepositories().units.getAll(institutionId!),
    enabled: !!institutionId,
  });

  if (isLoading) return <LoadingState />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button
          title="+ Yeni Birim"
          onPress={() => router.push('/(admin)/units/create')}
          fullWidth
        />
      </View>
      <FlatList
        data={units}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Birim bulunamadı"
            message="Yeni birim ekleyin."
            module="units"
            actionLabel="Birim Ekle"
            onAction={() => router.push('/(admin)/units/create')}
          />
        }
        renderItem={({ item }: { item: Unit }) => {
          const parent = units?.find((u) => u.id === item.parentId);
          return (
            <Card
              onPress={() => router.push(`/(admin)/units/${item.id}`)}
              module="units"
              variant="elevated"
              style={styles.card}
            >
              <CardTitle>{item.name}</CardTitle>
              <CardSubtitle>
                {getUnitWorkScheduleLabel(item)}
                {parent ? ` · Üst: ${parent.name}` : ''} · Min kadro: {item.minimumStaff}
              </CardSubtitle>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md },
  list: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
});
