import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { ShiftBadge } from '@/shared/components/Badge';
import { formatSlotLabel } from '@/features/shifts/constants/shiftDefaults';
import type { ShiftSlotAssignment, UnitDaySchedule } from '@/features/shifts/services/scheduleService';
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

      {schedule.collisions.length > 0 ? (
        <View style={styles.warningBox}>
          {schedule.collisions.map((msg) => (
            <Text key={msg} style={styles.warningText}>
              ⚠ {msg}
            </Text>
          ))}
        </View>
      ) : null}

      <ShiftSlotSection
        label="Gündüz"
        slots={schedule.daySlots}
        emptyText="Gündüz vardiyası yok"
        compact={compact}
        onGroupPress={(id) => router.push(`/(admin)/shifts/${id}`)}
      />
      <ShiftSlotSection
        label="Gece"
        slots={schedule.nightSlots}
        emptyText="Gece vardiyası yok"
        compact={compact}
        onGroupPress={(id) => router.push(`/(admin)/shifts/${id}`)}
      />
      {schedule.fullSlots.length > 0 ? (
        <ShiftSlotSection
          label="24 Saat"
          slots={schedule.fullSlots}
          emptyText=""
          compact={compact}
          onGroupPress={(id) => router.push(`/(admin)/shifts/${id}`)}
        />
      ) : null}

      {!compact && schedule.offGroups.length > 0 ? (
        <View style={styles.offSection}>
          <Text style={styles.offTitle}>İzin günü</Text>
          {schedule.offGroups.map(({ group, personnel }) => (
            <Pressable key={group.id} onPress={() => router.push(`/(admin)/shifts/${group.id}`)}>
              <Text style={styles.offLine}>
                {group.name}
                {personnel.length > 0 ? ` (${personnel.length} personel)` : ''}
              </Text>
            </Pressable>
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

function ShiftSlotSection({
  label,
  slots,
  emptyText,
  compact,
  onGroupPress,
}: {
  label: string;
  slots: ShiftSlotAssignment[];
  emptyText: string;
  compact?: boolean;
  onGroupPress: (groupId: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <View style={[styles.slot, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <Text style={[styles.slotLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={styles.empty}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <>
      {slots.map((slot) => (
        <ShiftSlotRow
          key={slot.group.id}
          label={label}
          slot={slot}
          compact={compact}
          onGroupPress={onGroupPress}
        />
      ))}
    </>
  );
}

function ShiftSlotRow({
  label,
  slot,
  compact,
  onGroupPress,
}: {
  label: string;
  slot: ShiftSlotAssignment;
  compact?: boolean;
  onGroupPress: (groupId: string) => void;
}) {
  const tone =
    slot.shiftType === 'NIGHT'
      ? colors.primaryDark
      : slot.shiftType === 'FULL'
        ? colors.warning
        : modules.shifts.main;
  const bg =
    slot.shiftType === 'NIGHT'
      ? colors.primaryMuted
      : slot.shiftType === 'FULL'
        ? colors.warningLight
        : modules.shifts.light;

  return (
    <View style={[styles.slot, { backgroundColor: bg, borderColor: tone }]}>
      <View style={styles.slotHeader}>
        <Text style={[styles.slotLabel, { color: tone }]}>{label}</Text>
        <Text style={styles.slotTime}>
          {formatSlotLabel(slot.startTime, slot.endTime, slot.shiftType)}
        </Text>
      </View>
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
  warningBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.xs,
  },
  warningText: { ...typography.caption, color: colors.warning },
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
