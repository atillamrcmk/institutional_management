import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import type { AssignmentStatus, Personnel } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { getPersonnelFullName } from '@/shared/utils/id';
import { getAssignmentStatusLabel } from '@/shared/utils/labels';

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['assignment-detail', id],
    queryFn: () => getRepositories().assignments.getDetail(id),
  });

  const updateStatus = async (status: AssignmentStatus) => {
    await getRepositories().assignments.updateStatus(id, status);
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
    await refetch();
    Alert.alert('Güncellendi', `Durum: ${getAssignmentStatusLabel(status)}`);
  };

  if (isLoading) return <LoadingState />;
  if (!data) {
    return (
      <View style={styles.center}>
        <Text>Görev bulunamadı</Text>
      </View>
    );
  }

  const { assignment, taskType, personnel } = data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{assignment.title}</Text>
      <Text style={styles.meta}>
        {taskType.name} · {assignment.date} · {assignment.startTime}
        {assignment.endTime ? ` – ${assignment.endTime}` : ''}
      </Text>
      <Text style={styles.status}>{getAssignmentStatusLabel(assignment.status)}</Text>

      {assignment.description ? (
        <Card>
          <CardTitle>Açıklama</CardTitle>
          <CardSubtitle>{assignment.description}</CardSubtitle>
        </Card>
      ) : null}

      <Card>
        <CardTitle>
          Atanan Personel ({personnel.length}/{assignment.requiredPersonnelCount})
        </CardTitle>
        {personnel.length === 0 ? (
          <CardSubtitle>Henüz personel atanmadı</CardSubtitle>
        ) : (
          personnel.map((p: Personnel) => (
            <Text key={p.id} style={styles.personRow}>
              {getPersonnelFullName(p)} · {p.sicilNo}
            </Text>
          ))
        )}
      </Card>

      <View style={styles.actions}>
        {assignment.status === 'PLANNED' ? (
          <Button title="Aktif Yap" onPress={() => updateStatus('ACTIVE')} />
        ) : null}
        {assignment.status === 'ACTIVE' ? (
          <Button title="Tamamlandı" onPress={() => updateStatus('COMPLETED')} variant="secondary" />
        ) : null}
        {assignment.status !== 'CANCELLED' && assignment.status !== 'COMPLETED' ? (
          <Button title="İptal Et" onPress={() => updateStatus('CANCELLED')} variant="outline" />
        ) : null}
        <Button title="Geri" onPress={() => router.back()} variant="ghost" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  status: { ...typography.label, color: colors.primary },
  personRow: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
