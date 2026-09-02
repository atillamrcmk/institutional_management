import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme';

interface TrendBarsProps {
  points: Array<{ label: string; onDuty: number }>;
}

export function TrendBars({ points }: TrendBarsProps) {
  const max = Math.max(...points.map((p) => p.onDuty), 1);

  return (
    <View style={styles.row}>
      {points.map((point) => {
        const height = Math.max(8, Math.round((point.onDuty / max) * 72));
        return (
          <View key={point.label} style={styles.col}>
            <Text style={styles.value}>{point.onDuty}</Text>
            <View style={styles.track}>
              <View style={[styles.bar, { height }]} />
            </View>
            <Text style={styles.label}>{point.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 110,
  },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  track: {
    width: '70%',
    height: 72,
    justifyContent: 'flex-end',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  value: { ...typography.caption, color: colors.text, fontWeight: '700' },
  label: { ...typography.caption, color: colors.textMuted },
});
