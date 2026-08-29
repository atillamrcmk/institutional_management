import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, modules, radius, spacing, typography, type ModuleKey } from '@/shared/theme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  module?: ModuleKey;
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  module = 'dashboard',
}: EmptyStateProps) {
  const tone = modules[module];

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: tone.light }]}>
        <Ionicons name="folder-open-outline" size={32} color={tone.main} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="outline" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  message: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  button: { marginTop: spacing.md },
});
