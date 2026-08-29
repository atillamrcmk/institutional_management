import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, modules, radius, shadows, spacing, typography, type ModuleKey } from '@/shared/theme';

const MODULE_ICONS: Record<ModuleKey, keyof typeof Ionicons.glyphMap> = {
  dashboard: 'grid-outline',
  personnel: 'people-outline',
  units: 'business-outline',
  shifts: 'time-outline',
  assignments: 'clipboard-outline',
  planning: 'analytics-outline',
  presence: 'location-outline',
  auth: 'shield-checkmark-outline',
};

interface ModuleCardProps {
  title: string;
  subtitle: string;
  module: ModuleKey;
  onPress: () => void;
}

export function ModuleCard({ title, subtitle, module, onPress }: ModuleCardProps) {
  const tone = modules[module];
  const icon = MODULE_ICONS[module];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadows.sm, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tone.light }]}>
        <Ionicons name={icon} size={22} color={tone.main} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 2 },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },
});
