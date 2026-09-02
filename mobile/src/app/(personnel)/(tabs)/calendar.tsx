import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getPersonnelCalendarDays } from '@/features/personnel/services/personnelPortalService';
import { formatShiftTime, getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import { ShiftBadge } from '@/shared/components/Badge';
import { Card, CardSubtitle, CardTitle } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { colors, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, todayDateString } from '@/shared/utils/id';

export default function PersonnelCalendarScreen() {
  const personnelId = useAuthStore((state) => state.user?.personnelId);

  const { data, isLoading } = useQuery({
    queryKey: ['personnel-calendar', personnelId],
    queryFn: () => getPersonnelCalendarDays(personnelId!, todayDateString(), 14),
    enabled: !!personnelId,
  });

  if (!personnelId) {
    return (
      <Screen>
        <Text style={styles.empty}>Hesabınız bir personel kaydına bağlı değil.</Text>
      </Screen>
    );
  }

  if (isLoading) return <LoadingState message="Takvim yükleniyor..." />;

  return (
    <Screen scroll>
      <PageHeader
        title="Vardiya Takvimim"
        subtitle="Önümüzdeki 14 gün"
        module="planning"
      />
      <View style={styles.list}>
        {data?.map((day) => (
          <Card key={day.date} variant="elevated" style={styles.card}>
            <View style={styles.row}>
              <View style={styles.info}>
                <CardTitle>{formatDisplayDate(day.date)}</CardTitle>
                <CardSubtitle>
                  {day.unitName ? `${day.unitName} · ` : ''}
                  {day.label}
                </CardSubtitle>
                {day.startTime ? (
                  <Text style={styles.time}>
                    {formatShiftTime(day.startTime, day.endTime)}
                  </Text>
                ) : (
                  <Text style={styles.time}>{getShiftTypeLabel(day.shiftType)}</Text>
                )}
              </View>
              <ShiftBadge shiftType={day.shiftType} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  info: { flex: 1, gap: 2 },
  time: { ...typography.bodySmall, color: colors.text },
  empty: { ...typography.body, color: colors.textMuted, padding: spacing.lg },
});
