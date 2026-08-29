import { Pressable, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, modules, radius, shadows, spacing, typography, type ModuleKey } from '@/shared/theme';

type CardVariant = 'default' | 'elevated' | 'tinted' | 'outline';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: CardVariant;
  module?: ModuleKey;
}

export function Card({ children, onPress, style, variant = 'elevated', module }: CardProps) {
  const tintedBg = module ? modules[module].light : colors.primaryMuted;

  const cardStyle = [
    styles.card,
    variant === 'elevated' && shadows.sm,
    variant === 'outline' && styles.outline,
    variant === 'tinted' && { backgroundColor: tintedBg, borderColor: module ? modules[module].light : colors.primaryMuted },
    variant === 'default' && styles.default,
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function CardSubtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  default: { borderColor: colors.border },
  outline: { backgroundColor: 'transparent', borderColor: colors.border },
  pressed: { opacity: 0.94 },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
});
