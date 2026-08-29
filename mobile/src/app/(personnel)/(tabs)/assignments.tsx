import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import type { Assignment } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { getAssignmentStatusLabel } from '@/shared/utils/labels';
import { todayDateString } from '@/shared/utils/id';

export default function PersonnelAssignmentsScreen() {
  const user = useAuthStore((s) => s.user)!;

  const { data, isLoading } = useQuery({
    queryKey: ['my-assignments', user.personnelId],
    queryFn: async () => {
      if (!user.personnelId) return [];
      return getRepositories().assignments.getByPersonnel(user.personnelId, todayDateString());
    },
    enabled: !!user.personnelId,
  });

  if (!user.personnelId) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Personel hesabı gerekli</Text>
      </View>
    );
  }

  if (isLoading) return <LoadingState message="Görevler yükleniyor..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="Görev yok" message="Size atanmış görev bulunmuyor." />}
        renderItem={({ item }) => <AssignmentRow assignment={item} />}
      />
    </View>
  );
}

function AssignmentRow({ assignment }: { assignment: Assignment }) {
  return (
    <Card style={styles.card}>
      <CardTitle>{assignment.title}</CardTitle>
      <CardSubtitle>
        {assignment.date} · {assignment.startTime}
        {assignment.endTime ? ` – ${assignment.endTime}` : ''}
      </CardSubtitle>
      <Text style={styles.status}>{getAssignmentStatusLabel(assignment.status)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { ...typography.body, color: colors.textSecondary },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  status: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
});
