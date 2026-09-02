import { Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
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
import { colors, spacing, typography } from '@/shared/theme';
import { addDaysToDateString, todayDateString } from '@/shared/utils/id';

export default function PersonnelHomeScreen() {
  const user = useAuthStore((s) => s.user)!;

  const { data, isLoading } = useQuery({
    queryKey: ['personnel-home', user.personnelId],
    queryFn: async () => {
      if (!user.personnelId) return null;
      const repos = getRepositories();
      const personnel = await repos.personnel.getById(user.personnelId);
      const unit = await repos.units.getCurrentUnitForPersonnel(user.personnelId);
      const today = todayDateString();
      const tomorrow = addDaysToDateString(today, 1);
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
      return { personnel, unit, shiftData, todayShift, tomorrowShift, taskAssignment };
    },
  });

  if (isLoading) return <LoadingState />;
  if (!data?.personnel) {
    return <LoadingState message="Personel bilgisi bulunamadı" />;
  }

  return (
    <Screen scroll>
      <PageHeader
        title={`Merhaba, ${data.personnel.firstName}`}
        subtitle="Bugünkü mesai ve görev özeti"
        module="dashboard"
      />

      <Section title="Bugün">
        <Card module="shifts" variant="tinted">
          {data.shiftData ? (
            <>
              <CardTitle>{data.shiftData.group.name}</CardTitle>
              {data.todayShift ? (
                <>
                  <CardSubtitle>
                    {formatShiftTime(data.todayShift.startTime, data.todayShift.endTime)}
                  </CardSubtitle>
                  <ShiftBadge shiftType={data.todayShift.shiftType} />
                </>
              ) : null}
              <Text style={styles.unit}>{data.unit?.name ?? '—'}</Text>
            </>
          ) : data.todayShift ? (
            <>
              <CardTitle>Mesai</CardTitle>
              <CardSubtitle>
                {formatShiftTime(data.todayShift.startTime, data.todayShift.endTime)}
              </CardSubtitle>
              <ShiftBadge shiftType={data.todayShift.shiftType} />
              <Text style={styles.unit}>{data.unit?.name ?? '—'}</Text>
            </>
          ) : (
            <CardSubtitle>Vardiya ataması yok</CardSubtitle>
          )}
        </Card>
      </Section>

      {data.taskAssignment ? (
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
          {data.tomorrowShift ? (
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
  unit: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm },
});
