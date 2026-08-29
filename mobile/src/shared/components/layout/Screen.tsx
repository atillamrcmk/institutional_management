import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/shared/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  style,
  contentStyle,
}: ScreenProps) {
  const inner = (
    <View style={[padded && styles.padded, contentStyle]}>{children}</View>
  );

  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {inner}
      </ScrollView>
    );
  }

  return <View style={[styles.screen, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
  padded: { padding: spacing.md },
});
