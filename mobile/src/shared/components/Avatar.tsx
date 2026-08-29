import { View, Text, StyleSheet } from 'react-native';
import { avatarPalette, radius, typography } from '@/shared/theme';

interface AvatarProps {
  name: string;
  size?: number;
}

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Avatar({ name, size = 48 }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const bg = avatarPalette[hashName(name) % avatarPalette.length];

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  text: {
    ...typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
