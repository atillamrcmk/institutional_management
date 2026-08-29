import { View, StyleSheet } from 'react-native';
import { spacing } from '@/shared/theme';

interface ScreenToolbarProps {
  children: React.ReactNode;
}

export function ScreenToolbar({ children }: ScreenToolbarProps) {
  return <View style={styles.toolbar}>{children}</View>;
}

const styles = StyleSheet.create({
  toolbar: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
