import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/shared/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const FILLED_MAP: Partial<Record<IconName, IconName>> = {
  'home-outline': 'home',
  'analytics-outline': 'analytics',
  'clipboard-outline': 'clipboard',
  'people-outline': 'people',
  'menu-outline': 'menu',
  'time-outline': 'time',
  'calendar-outline': 'calendar',
  'person-outline': 'person',
};

interface TabBarIconProps {
  name: IconName;
  color: string;
  focused: boolean;
}

export function TabBarIcon({ name, color, focused }: TabBarIconProps) {
  const iconName = focused && FILLED_MAP[name] ? FILLED_MAP[name]! : name;
  return <Ionicons name={iconName} size={22} color={color} />;
}

export function tabBarScreenOptions() {
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.borderLight,
      borderTopWidth: 1,
      height: 60,
      paddingBottom: 8,
      paddingTop: 8,
    },
    headerStyle: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontWeight: '600' as const },
  };
}
