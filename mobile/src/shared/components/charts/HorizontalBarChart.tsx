import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/shared/theme';

export interface BarItem {
  label: string;
  value: number;
  color: string;
}

interface HorizontalBarChartProps {
  items: BarItem[];
  maxValue?: number;
  emptyLabel?: string;
}

export function HorizontalBarChart({
  items,
  maxValue,
  emptyLabel = 'Veri yok',
}: HorizontalBarChartProps) {
  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  const peak = Math.max(maxValue ?? 0, ...items.map((item) => item.value), 1);

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const widthPct = Math.max(4, Math.round((item.value / peak) * 100));
        return (
          <View key={item.label} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${widthPct}%`, backgroundColor: item.color }]}
              />
            </View>
            <Text style={styles.value}>{item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 88,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  value: {
    ...typography.label,
    color: colors.text,
    width: 28,
    textAlign: 'right',
  },
  empty: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic' },
});
