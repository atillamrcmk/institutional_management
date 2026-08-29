import { View, StyleSheet } from 'react-native';
import { spacing } from '@/shared/theme';

interface StatsGridProps {
  children: React.ReactNode;
}

export function StatsGrid({ children }: StatsGridProps) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
