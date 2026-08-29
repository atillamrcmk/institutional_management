import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}

export function Chip({ label, selected, onPress, color = colors.primary }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { ...typography.label, color: colors.textSecondary },
  textSelected: { color: colors.textInverse },
});
