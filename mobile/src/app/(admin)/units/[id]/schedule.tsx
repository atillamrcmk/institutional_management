import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getUnitScheduleForDate, getUnitScheduleRange } from '@/features/shifts/services/scheduleService';
import { UnitShiftScheduleCard } from '@/shared/components/UnitShiftSchedule';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { colors, spacing, typography } from '@/shared/theme';
import { addDaysToDateString, formatDisplayDate, todayDateString } from '@/shared/utils/id';

export default function UnitScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayDateString());

  const { data: todaySchedule, isLoading } = useQuery({
    queryKey: ['unit-schedule', id, selectedDate],
    queryFn: () => getUnitScheduleForDate(id, selectedDate),
  });

  const { data: weekSchedule } = useQuery({
    queryKey: ['unit-schedule-week', id, selectedDate],
    queryFn: () => getUnitScheduleRange(id, selectedDate, 7),
  });

  if (isLoading || !todaySchedule) {
    return <LoadingState message="Vardiya planı yükleniyor..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{todaySchedule.unitName}</Text>
      <Text style={styles.subtitle}>Gündüz ve gece vardiya planı otomatik hesaplanır</Text>

      <View style={styles.dateNav}>
        <Button
          title="← Önceki"
          variant="outline"
          onPress={() => setSelectedDate((d) => addDaysToDateString(d, -1))}
        />
        <Text style={styles.dateLabel}>{formatDisplayDate(selectedDate)}</Text>
        <Button
          title="Sonraki →"
          variant="outline"
          onPress={() => setSelectedDate((d) => addDaysToDateString(d, 1))}
        />
      </View>

      <View style={styles.quickDates}>
        <Pressable onPress={() => setSelectedDate(todayDateString())} style={styles.quickChip}>
          <Text style={styles.quickChipText}>Bugün</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedDate(addDaysToDateString(todayDateString(), 1))}
          style={styles.quickChip}
        >
          <Text style={styles.quickChipText}>Yarın</Text>
        </Pressable>
      </View>

      <UnitShiftScheduleCard schedule={todaySchedule} />

      <Text style={styles.section}>Önümüzdeki 7 Gün</Text>
      {weekSchedule?.map((day) => (
        <Pressable key={day.date} onPress={() => setSelectedDate(day.date)}>
          <UnitShiftScheduleCard schedule={day} compact />
        </Pressable>
      ))}

      <Button
        title="Vardiya Grupları"
        variant="outline"
        onPress={() => router.push(`/(admin)/units/${id}`)}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dateLabel: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  quickDates: { flexDirection: 'row', gap: spacing.sm },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  quickChipText: { ...typography.label, color: colors.primary },
  section: { ...typography.h3, color: colors.text, marginTop: spacing.sm },
});
