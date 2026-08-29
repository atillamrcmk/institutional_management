import { View, Text, StyleSheet } from 'react-native';
import { colors, modules, spacing, typography, type ModuleKey } from '@/shared/theme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  module?: ModuleKey;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, module = 'dashboard', action }: PageHeaderProps) {
  const accent = modules[module].main;

  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  textBlock: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  accent: { width: 4, borderRadius: 4, alignSelf: 'stretch', minHeight: 40 },
  titles: { flex: 1, gap: 2 },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },
  action: { flexShrink: 0 },
});
