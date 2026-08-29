import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { ScreenToolbar } from '@/shared/components/layout/ScreenToolbar';
import { getAssignmentStatusLabel } from '@/shared/utils/labels';
import type { Assignment } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { todayDateString } from '@/shared/utils/id';

export default function AdminAssignmentsScreen() {
  const router = useRouter();
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const today = todayDateString();

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', institutionId, today],
    queryFn: () => getRepositories().assignments.getAll(institutionId, { date: today }),
  });

  if (isLoading) return <LoadingState message="Görevler yükleniyor..." />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScreenToolbar>
          <Text style={styles.subtitle}>Bugünkü görevlendirmeler</Text>
          <Button
            title="+ Yeni Görev"
            onPress={() => router.push('/(admin)/assignments/create')}
            fullWidth
          />
        </ScreenToolbar>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Bugün görev yok"
            message="Yeni görev oluşturun"
            module="assignments"
            actionLabel="Görev Oluştur"
            onAction={() => router.push('/(admin)/assignments/create')}
          />
        }
        renderItem={({ item }) => (
          <AssignmentCard
            assignment={item}
            onPress={() =>
              router.push({
                pathname: '/(admin)/assignments/[id]',
                params: { id: item.id },
              })
            }
          />
        )}
      />
    </View>
  );
}

function AssignmentCard({
  assignment,
  onPress,
}: {
  assignment: Assignment;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} module="assignments" variant="elevated" style={styles.card}>
      <CardTitle>{assignment.title}</CardTitle>
      <CardSubtitle>
        {assignment.startTime}
        {assignment.endTime ? ` – ${assignment.endTime}` : ''}
      </CardSubtitle>
      <View style={styles.badgeRow}>
        <Badge label={getAssignmentStatusLabel(assignment.status)} variant="info" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, paddingBottom: 0 },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  badgeRow: { marginTop: spacing.sm },
});
