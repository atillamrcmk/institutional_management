import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Button } from '@/shared/components/Button';
import { colors, spacing, typography } from '@/shared/theme';

export default function PersonnelProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.displayName}</Text>
      <Text style={styles.role}>{user?.role}</Text>
      <Button title="Çıkış Yap" onPress={handleLogout} variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  name: { ...typography.h2, color: colors.text },
  role: { ...typography.body, color: colors.textSecondary },
});
