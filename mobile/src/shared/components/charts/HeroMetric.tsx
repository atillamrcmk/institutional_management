import { View, Text, StyleSheet } from 'react-native';
import { colors, modules, radius, shadows, spacing, typography, type ModuleKey } from '@/shared/theme';

interface HeroMetricProps {
  label: string;
  value: number | string;
  hint?: string;
  module?: ModuleKey;
}

/** Büyük özet metrik — dashboard hero */
export function HeroMetric({ label, value, hint, module = 'dashboard' }: HeroMetricProps) {
  const tone = modules[module];
  return (
    <View style={[styles.card, shadows.md]}>
      <View style={[styles.glow, { backgroundColor: tone.light }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: tone.dark }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  glow: {
    position: 'absolute',
    right: -24,
    top: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.9,
  },
  label: { ...typography.overline, color: colors.textMuted },
  value: { ...typography.display, fontSize: 40, lineHeight: 44 },
  hint: { ...typography.bodySmall, color: colors.textSecondary },
});
