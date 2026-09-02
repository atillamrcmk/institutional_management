import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme';

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DistributionBarProps {
  segments: Segment[];
  title?: string;
}

export function DistributionBar({ segments, title }: DistributionBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.bar}>
        {total === 0 ? (
          <View style={[styles.segment, { flex: 1, backgroundColor: colors.backgroundAlt }]} />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <View
                key={s.key}
                style={[
                  styles.segment,
                  { flex: s.value, backgroundColor: s.color },
                ]}
              />
            ))
        )}
      </View>
      <View style={styles.legend}>
        {segments.map((s) => {
          const pct = total === 0 ? 0 : Math.round((s.value / total) * 100);
          return (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>
                {s.label} · {s.value} ({pct}%)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.label, color: colors.textSecondary },
  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.backgroundAlt,
  },
  segment: { minWidth: 0 },
  legend: { gap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.caption, color: colors.textSecondary },
});
