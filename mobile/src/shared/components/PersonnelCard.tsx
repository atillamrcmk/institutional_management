import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { StatusBadge, ShiftBadge } from './Badge';
import { colors, radius, shadows, spacing, typography } from '@/shared/theme';
import { formatShiftTime } from '@/features/shifts/engine/shiftCalculator';
import type { PersonnelPresence } from '@/shared/types';
import { getPersonnelFullName } from '@/shared/utils/id';

interface PersonnelCardProps {
  item: PersonnelPresence;
  onPress?: () => void;
}

export function PersonnelCard({ item, onPress }: PersonnelCardProps) {
  const name = getPersonnelFullName(item.personnel);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadows.sm, pressed && styles.pressed]}
    >
      <Avatar name={name} size={52} photoUri={item.personnel.photoUri} />
      <View style={styles.content}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {item.unit?.name ?? 'Birim yok'}
          {item.shiftGroup ? ` · ${item.shiftGroup.name}` : ''}
        </Text>
        <Text style={styles.time}>
          {item.status === 'ON_ASSIGNMENT' && item.assignmentTitle
            ? `${item.assignmentTitle}${item.assignmentTime ? ` · ${item.assignmentTime}` : ''}`
            : formatShiftTime(item.shift.startTime, item.shift.endTime)}
        </Text>
        <View style={styles.badges}>
          <StatusBadge status={item.status} />
          <ShiftBadge shiftType={item.shift.shiftType} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.94 },
  content: { flex: 1, gap: 4 },
  name: { ...typography.h3, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  time: { ...typography.bodySmall, color: colors.text, fontWeight: '500' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
