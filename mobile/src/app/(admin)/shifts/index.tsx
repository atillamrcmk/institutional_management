import { ScrollView, StyleSheet, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { getInstitutionShiftOverview, getScheduleActiveSlots } from '@/features/shifts/services/scheduleService';
import { shiftQueryKeys } from '@/features/shifts/constants/shiftQueryKeys';
import { formatSlotLabel } from '@/features/shifts/constants/shiftDefaults';
import { Button } from '@/shared/components/Button';
import { CardTitle, CardSubtitle } from '@/shared/components/Card';
import { ShiftBadge } from '@/shared/components/Badge';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { colors, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, getPersonnelFullName, todayDateString } from '@/shared/utils/id';

export default function ShiftsListScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const today = todayDateString();

  const { data: overview, isLoading } = useQuery({
    queryKey: shiftQueryKeys.overview(institutionId!, today),
    queryFn: () => getInstitutionShiftOverview(institutionId!, today),
    enabled: !!institutionId,
  });

  if (isLoading) return <LoadingState />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDisplayDate(today)}</Text>
        <Text style={styles.hint}>Vardiya kurmak için Birimler ekranını kullanın.</Text>
        <Button
          title="Birimlere Git"
          variant="outline"
          onPress={() => router.push('/(admin)/units')}
          fullWidth
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {overview?.length === 0 ? (
          <EmptyState
            title="Bugün vardiya yok"
            message="Önce birim oluşturun, sonra birim içinden vardiyaları kurun."
            module="shifts"
            actionLabel="Birim Ekle"
            onAction={() => router.push('/(admin)/units/create')}
          />
        ) : (
          overview?.map((item) => (
            <View key={item.unitId} style={styles.unitBlock}>
              <Text style={styles.unitName}>{item.unitName}</Text>
              {getScheduleActiveSlots(item.schedule).map((slot) => (
                <Pressable
                  key={`${slot.group.id}-${slot.shiftType}`}
                  onPress={() => router.push(`/(admin)/shifts/${slot.group.id}`)}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <View style={styles.cardTop}>
                    <View>
                      <CardTitle>{slot.group.name}</CardTitle>
                      <CardSubtitle>
                        {formatSlotLabel(slot.startTime, slot.endTime, slot.shiftType)}
                      </CardSubtitle>
                    </View>
                    <ShiftBadge shiftType={slot.shiftType} />
                  </View>
                  <Text style={styles.personnel}>
                    {slot.personnel.length} personel
                    {slot.personnel.length > 0
                      ? ` · ${slot.personnel
                          .slice(0, 2)
                          .map((p) => getPersonnelFullName(p))
                          .join(', ')}`
                      : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  date: { ...typography.h2, color: colors.text },
  hint: { ...typography.bodySmall, color: colors.textMuted },
  list: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  unitBlock: { gap: spacing.sm },
  unitName: { ...typography.h3, color: colors.primary },
  card: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  cardPressed: { backgroundColor: colors.primaryMuted },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  personnel: { ...typography.bodySmall, color: colors.textSecondary },
});
