import { Text, StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';
import { calculateShiftForDate, formatShiftTime } from '@/features/shifts/engine/shiftCalculator';
import { getOfficeShiftForDate } from '@/features/units/services/officeSchedule';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { ShiftBadge } from '@/shared/components/Badge';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/layout/Section';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';
import { addDaysToDateString, todayDateString } from '@/shared/utils/id';

export default function PersonnelHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const tenant = useAuthStore((s) => s.tenant);

  const { data, isLoading } = useQuery({
    queryKey: ['personnel-home', user.personnelId, user.id],
    queryFn: async () => {
      const repos = getRepositories();
      const today = todayDateString();
      const tomorrow = addDaysToDateString(today, 1);
      const unread = await repos.messages
        .getUnreadCount('', user.id, user.personnelId)
        .catch(() => 0);

      if (!user.personnelId) {
        return {
          personnel: null,
          unit: null,
          shiftData: null,
          todayShift: null,
          tomorrowShift: null,
          taskAssignment: null,
          unread,
        };
      }

      const personnel = await repos.personnel.getById(user.personnelId);
      const unit = await repos.units.getCurrentUnitForPersonnel(user.personnelId);
      const shiftData = await repos.shifts.getActiveAssignmentForPersonnel(
        user.personnelId,
        today,
      );
      const taskAssignment = await repos.assignments.getActiveForPersonnelOnDate(
        user.personnelId,
        today,
      );
      let todayShift = null;
      let tomorrowShift = null;
      if (shiftData) {
        todayShift = calculateShiftForDate(
          shiftData.patternDays,
          shiftData.group.cycleStartDate,
          today,
        );
        tomorrowShift = calculateShiftForDate(
          shiftData.patternDays,
          shiftData.group.cycleStartDate,
          tomorrow,
        );
      } else if (unit?.workScheduleType === 'OFFICE') {
        todayShift = getOfficeShiftForDate(unit, today);
        tomorrowShift = getOfficeShiftForDate(unit, tomorrow);
      }
      return { personnel, unit, shiftData, todayShift, tomorrowShift, taskAssignment, unread };
    },
  });

  if (isLoading) return <LoadingState />;

  const firstName = data?.personnel?.firstName ?? user.displayName.split(' ')[0];

  return (
    <Screen scroll>
      <PageHeader
        title={`Merhaba, ${firstName}`}
        subtitle={tenant?.name ?? 'Bugünkü mesai ve görev özeti'}
        module="dashboard"
      />

      <View style={[styles.heroCard, shadows.md]}>
        <Text style={styles.heroOverline}>Bugün</Text>
        {data?.shiftData || data?.todayShift ? (
          <>
            <Text style={styles.heroTitle}>
              {data.shiftData?.group.name ?? 'Mesai'}
            </Text>
            {data.todayShift ? (
              <Text style={styles.heroTime}>
                {formatShiftTime(data.todayShift.startTime, data.todayShift.endTime)}
              </Text>
            ) : null}
            <View style={styles.heroMeta}>
              {data.todayShift ? <ShiftBadge shiftType={data.todayShift.shiftType} /> : null}
              <Text style={styles.unit}>{data.unit?.name ?? '—'}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.heroTitle}>Vardiya ataması yok</Text>
        )}
      </View>

      <Section title="Kısayollar">
        <View style={styles.shortcuts}>
          <Pressable
            style={[styles.shortcut, shadows.sm]}
            onPress={() => router.push('/(personnel)/(tabs)/calendar')}
          >
            <Ionicons name="calendar-outline" size={22} color={modules.planning.main} />
            <Text style={styles.shortcutLabel}>Takvim</Text>
          </Pressable>
          <Pressable
            style={[styles.shortcut, shadows.sm]}
            onPress={() => router.push('/(personnel)/(tabs)/shift')}
          >
            <Ionicons name="people-outline" size={22} color={modules.presence.main} />
            <Text style={styles.shortcutLabel}>Kurumda</Text>
          </Pressable>
          <Pressable
            style={[styles.shortcut, shadows.sm]}
            onPress={() => router.push('/(personnel)/(tabs)/messages')}
          >
            <Ionicons name="mail-outline" size={22} color={modules.dashboard.main} />
            <Text style={styles.shortcutLabel}>
              Mesajlar{data?.unread ? ` (${data.unread})` : ''}
            </Text>
          </Pressable>
        </View>
      </Section>

      {data?.taskAssignment ? (
        <Section title="Ek Görev">
          <Card module="assignments" variant="tinted">
            <CardTitle>{data.taskAssignment.title}</CardTitle>
            <CardSubtitle>
              {data.taskAssignment.startTime}
              {data.taskAssignment.endTime ? ` – ${data.taskAssignment.endTime}` : ''}
            </CardSubtitle>
          </Card>
        </Section>
      ) : null}

      <Section title="Yarın">
        <Card module="planning" variant="elevated">
          {data?.tomorrowShift ? (
            <>
              <CardSubtitle>
                {formatShiftTime(data.tomorrowShift.startTime, data.tomorrowShift.endTime)}
              </CardSubtitle>
              <ShiftBadge shiftType={data.tomorrowShift.shiftType} />
            </>
          ) : (
            <CardSubtitle>—</CardSubtitle>
          )}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: modules.shifts.light,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: modules.shifts.light,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroOverline: { ...typography.overline, color: modules.shifts.dark },
  heroTitle: { ...typography.h1, color: colors.text },
  heroTime: { ...typography.h2, color: modules.shifts.dark },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  unit: { ...typography.bodySmall, color: colors.textSecondary },
  shortcuts: { flexDirection: 'row', gap: spacing.sm },
  shortcut: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'flex-start',
  },
  shortcutLabel: { ...typography.label, color: colors.text },
});
