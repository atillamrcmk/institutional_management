import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { ShiftBadge } from '@/shared/components/Badge';
import { formatSlotLabel } from '@/features/shifts/constants/shiftDefaults';
import type { UnitDaySchedule } from '@/features/shifts/services/scheduleService';
import { colors, modules, radius, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, getPersonnelFullName } from '@/shared/utils/id';

interface UnitShiftScheduleProps {
  schedule: UnitDaySchedule;
  compact?: boolean;
  onPressDate?: () => void;
}

export function UnitShiftScheduleCard({ schedule, compact, onPressDate }: UnitShiftScheduleProps) {
  const router = useRouter();
  const shiftsTone = modules.shifts;

  const content = (
    <View style={styles.wrapper}>
      <Pressable onPress={onPressDate} disabled={!onPressDate}>
        <Text style={styles.date}>{formatDisplayDate(schedule.date)}</Text>
      </Pressable>

      <ShiftSlotRow
        label="Gündüz"
        slot={schedule.daySlot}
        emptyText="Gündüz vardiyası yok"
        compact={compact}
        onGroupPress={(id) => router.push(`/(admin)/shifts/${id}`)}
      />
      <ShiftSlotRow
        label="Gece"
        slot={schedule.nightSlot}
        emptyText="Gece vardiyası yok"
        compact={compact}
        onGroupPress={(id) => router.push(`/(admin)/shifts/${id}`)}
      />

      {!compact && schedule.offGroups.length > 0 ? (
        <View style={styles.offSection}>
          <Text style={styles.offTitle}>İzin günü</Text>
          {schedule.offGroups.map(({ group, personnel }) => (
            <Text key={group.id} style={styles.offLine}>
              {group.name}
              {personnel.length > 0 ? ` (${personnel.length} personel)` : ''}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (compact) {
    return <View style={[styles.compactCard, { borderColor: shiftsTone.light }]}>{content}</View>;
  }

  return (
    <Card module="shifts" variant="elevated">
      {content}
    </Card>
  );
}

function ShiftSlotRow({
  label,
  slot,
  emptyText,
  compact,
  onGroupPress,
}: {
  label: string;
  slot: UnitDaySchedule['daySlot'];
  emptyText: string;
  compact?: boolean;
  onGroupPress: (groupId: string) => void;
}) {
  const tone = slot?.shiftType === 'NIGHT' ? colors.primaryDark : modules.shifts.main;
  const bg = slot?.shiftType === 'NIGHT' ? colors.primaryMuted : modules.shifts.light;

  return (
    <View style={[styles.slot, { backgroundColor: bg, borderColor: tone }]}>
      <View style={styles.slotHeader}>
        <Text style={[styles.slotLabel, { color: tone }]}>{label}</Text>
        {slot ? (
          <Text style={styles.slotTime}>{formatSlotLabel(slot.startTime, slot.endTime)}</Text>
        ) : null}
      </View>
      {slot ? (
        <>
          <Pressable onPress={() => onGroupPress(slot.group.id)} style={styles.groupRow}>
            <ShiftBadge shiftType={slot.shiftType} />
            <CardTitle>{slot.group.name}</CardTitle>
          </Pressable>
          {!compact ? (
            slot.personnel.length === 0 ? (
              <CardSubtitle>Personel atanmadı</CardSubtitle>
            ) : (
              <View style={styles.personnelList}>
                {slot.personnel.map((p) => (
                  <Text key={p.id} style={styles.personName}>
                    · {getPersonnelFullName(p)}
                  </Text>
                ))}
              </View>
            )
          ) : (
            <CardSubtitle>{slot.personnel.length} personel</CardSubtitle>
          )}
        </>
      ) : (
        <Text style={styles.empty}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  compactCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  date: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  slot: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slotLabel: { ...typography.overline },
  slotTime: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  personnelList: { gap: 2, marginTop: spacing.xs },
  personName: { ...typography.bodySmall, color: colors.text },
  empty: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic' },
  offSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 2,
  },
  offTitle: { ...typography.caption, color: colors.textMuted },
  offLine: { ...typography.bodySmall, color: colors.textSecondary },
});
