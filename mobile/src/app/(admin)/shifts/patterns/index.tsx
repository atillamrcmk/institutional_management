import { useState } from 'react';
import { FlatList, StyleSheet, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import type { ShiftPattern } from '@/shared/types';
import { colors, spacing } from '@/shared/theme';
import { formatDisplayDate } from '@/shared/utils/id';

export default function ShiftPatternsScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();

  const { data, isLoading } = useQuery({
    queryKey: ['shift-patterns', institutionId],
    queryFn: () => getRepositories().shifts.getPatterns(institutionId!),
    enabled: !!institutionId,
  });

  if (isLoading) return <LoadingState />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="+ Yeni Döngü" onPress={() => router.push('/(admin)/shifts/patterns/create')} />
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState title="Vardiya döngüsü yok" message="Yeni bir döngü tanımlayın." />
        }
        renderItem={({ item }: { item: ShiftPattern }) => (
          <Pressable onPress={() => router.push(`/(admin)/shifts/patterns/${item.id}`)}>
            <Card style={styles.card}>
              <CardTitle>{item.name}</CardTitle>
              <CardSubtitle>Referans: {formatDisplayDate(item.referenceDate)}</CardSubtitle>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md },
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
});
