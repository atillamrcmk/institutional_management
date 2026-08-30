import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'off';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <View style={[styles.badge, variantStyles[variant].container]}>
      <Text style={[styles.text, variantStyles[variant].text]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: 'ON_DUTY' | 'ON_ASSIGNMENT' | 'ABSENT' | 'OFF' }) {
  const map = {
    ON_DUTY: { label: 'Görevde', variant: 'success' as const },
    ON_ASSIGNMENT: { label: 'Ek Görev', variant: 'info' as const },
    ABSENT: { label: 'İzinli', variant: 'warning' as const },
    OFF: { label: 'İzin Günü', variant: 'off' as const },
  };
  const { label, variant } = map[status];
  return <Badge label={label} variant={variant} />;
}

export function ShiftBadge({ shiftType }: { shiftType: 'DAY' | 'NIGHT' | 'FULL' | 'OFF' }) {
  const labels = { DAY: 'Gündüz', NIGHT: 'Gece', FULL: '24 Saat', OFF: 'İzin' };
  const variants = {
    DAY: 'info' as const,
    NIGHT: 'default' as const,
    FULL: 'warning' as const,
    OFF: 'off' as const,
  };
  return <Badge label={labels[shiftType]} variant={variants[shiftType]} />;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: { ...typography.caption, fontWeight: '600' },
});

const variantStyles: Record<BadgeVariant, { container: object; text: object }> = {
  default: {
    container: { backgroundColor: colors.offLight, borderColor: colors.border },
    text: { color: colors.text },
  },
  success: {
    container: { backgroundColor: colors.successLight, borderColor: '#A7F3D0' },
    text: { color: colors.success },
  },
  warning: {
    container: { backgroundColor: colors.warningLight, borderColor: '#FDE68A' },
    text: { color: colors.warning },
  },
  danger: {
    container: { backgroundColor: colors.dangerLight, borderColor: '#FECACA' },
    text: { color: colors.danger },
  },
  info: {
    container: { backgroundColor: colors.infoLight, borderColor: '#BFDBFE' },
    text: { color: colors.info },
  },
  off: {
    container: { backgroundColor: colors.offLight, borderColor: colors.border },
    text: { color: colors.off },
  },
};
