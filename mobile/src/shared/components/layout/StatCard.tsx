import { View, Text, StyleSheet } from 'react-native';
import { colors, modules, radius, shadows, spacing, typography, type ModuleKey } from '@/shared/theme';

interface StatCardProps {
  label: string;
  value: number | string;
  module?: ModuleKey;
  wide?: boolean;
}

export function StatCard({ label, value, module = 'dashboard', wide }: StatCardProps) {
  const tone = modules[module];

  return (
    <View style={[styles.card, wide && styles.wide, shadows.sm]}>
      <View style={[styles.strip, { backgroundColor: tone.main }]} />
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: tone.dark }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  wide: { minWidth: '100%' },
  strip: { width: 4 },
  content: { flex: 1, padding: spacing.md, gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.h1, fontSize: 28 },
});
