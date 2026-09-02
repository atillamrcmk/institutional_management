import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getPublicDutyOverview } from '@/features/personnel/services/personnelPortalService';
import { Card, CardSubtitle, CardTitle } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { colors, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, todayDateString } from '@/shared/utils/id';

export default function PersonnelDutyScreen() {
  const institutionId = useAuthStore((state) => state.institutionId);
  const today = todayDateString();

  const { data, isLoading } = useQuery({
    queryKey: ['personnel-duty-overview', institutionId, today],
    queryFn: () => getPublicDutyOverview(institutionId!, today),
    enabled: !!institutionId,
  });

  if (isLoading) return <LoadingState message="Görev listesi yükleniyor..." />;

  return (
    <Screen scroll>
      <PageHeader
        title="Kurumda Kim Görevde?"
        subtitle={`${formatDisplayDate(today)} · Sadece isimler görünür`}
        module="presence"
      />

      {!data?.length ? (
        <EmptyState title="Bugün görevde kimse yok" module="presence" />
      ) : (
        <View style={styles.list}>
          {data.map((slot) => (
            <Card key={`${slot.unitName}-${slot.title}-${slot.timeLabel}`} module="presence">
              <CardTitle>
                {slot.unitName} · {slot.title}
              </CardTitle>
              <CardSubtitle>{slot.timeLabel}</CardSubtitle>
              <Text style={styles.names}>
                {slot.personnelNames.length > 0
                  ? slot.personnelNames.join(', ')
                  : 'Personel atanmadı'}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.note}>
        Personel detaylarına erişiminiz yoktur. Yönetici paneli bilgileri burada gösterilmez.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginBottom: spacing.md },
  names: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    fontStyle: 'italic',
  },
});
