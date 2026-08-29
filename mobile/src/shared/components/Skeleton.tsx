import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/shared/theme';

export function Skeleton({ width = '100%', height = 16, style }: {
  width?: number | string;
  height?: number;
  style?: object;
}) {
  return <View style={[styles.skeleton, { width, height }, style]} />;
}

export function PersonnelCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={48} height={48} style={styles.avatar} />
      <View style={styles.content}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={14} style={styles.mt} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    opacity: 0.6,
  },
  card: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { borderRadius: 24 },
  content: { flex: 1 },
  mt: { marginTop: spacing.sm },
});
