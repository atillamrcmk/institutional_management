import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getPlanningAlerts } from '@/features/planning/services/planningService';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/layout/Section';
import { colors, spacing } from '@/shared/theme';
import { formatDisplayDate, todayDateString } from '@/shared/utils/id';
import { View, StyleSheet } from 'react-native';

export default function PlanningScreen() {
  const router = useRouter();
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const today = todayDateString();

  const { data, isLoading } = useQuery({
    queryKey: ['planning-alerts', institutionId, today],
    queryFn: () => getPlanningAlerts(institutionId, today),
  });

  if (isLoading) return <LoadingState message="Planlama analizi..." />;

  return (
    <Screen scroll>
      <PageHeader
        title="Planlama Uyarıları"
        subtitle={`${formatDisplayDate(today)} · Minimum kadro ve görev kontrolleri`}
        module="planning"
      />

      <Section title="Uyarılar">
        {data?.length === 0 ? (
          <EmptyState
            title="Uyarı yok"
            message="Tüm birimler minimum kadro şartını karşılıyor."
            module="planning"
          />
        ) : (
          data?.map((alert) => (
            <Card
              key={alert.id}
              onPress={() => alert.unitId && router.push(`/(admin)/units/${alert.unitId}`)}
              variant={alert.type === 'UNDERSTAFFED' ? 'tinted' : 'elevated'}
              module="planning"
              style={alert.type === 'UNDERSTAFFED' ? styles.warnCard : undefined}
            >
              <CardTitle>{alert.title}</CardTitle>
              <CardSubtitle>{alert.message}</CardSubtitle>
              <View style={styles.badgeRow}>
                <Badge
                  label={alert.type === 'UNDERSTAFFED' ? 'Kadro Eksik' : 'Fazla Atama'}
                  variant={alert.type === 'UNDERSTAFFED' ? 'warning' : 'info'}
                />
              </View>
            </Card>
          ))
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warnCard: { borderColor: colors.warning, borderWidth: 1.5 },
  badgeRow: { marginTop: spacing.sm },
});
