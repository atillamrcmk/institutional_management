import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';
import { seedDemoData } from '@/shared/database/seed/seedDemoData';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/ErrorState';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';
import type { User } from '@/shared/types';

export default function LoginScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const login = useAuthStore((s) => s.login);
  const resetAfterSeed = useAuthStore((s) => s.resetAfterSeed);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['demo-users'],
    queryFn: async () => {
      const repos = getRepositories();
      const institution = await repos.institution.getFirst();
      if (!institution) return { users: [], institutionName: null };
      const list = await repos.auth.getDemoUsers(institution.id);
      return { users: list, institutionName: institution.name };
    },
  });

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await resetAfterSeed();
      await seedDemoData();
      await queryClient.invalidateQueries({ queryKey: ['welcome-status'] });
      await refetch();
      Alert.alert('Başarılı', 'Demo verileri oluşturuldu. Kurum Müdürü ile giriş yapın (PIN: 1234).');
    } catch (e) {
      console.error('Demo seed failed:', e);
      Alert.alert('Hata', e instanceof Error ? e.message : 'Demo verileri oluşturulamadı.');
    } finally {
      setSeeding(false);
    }
  };

  const handleLogin = async () => {
    if (!selectedUser) return;
    setLoading(true);
    const success = await login(selectedUser.id, pin || undefined);
    setLoading(false);
    if (!success) {
      Alert.alert('Giriş başarısız', 'PIN hatalı veya kullanıcı bulunamadı.');
      return;
    }
    router.replace('/');
  };

  if (isLoading || seeding) {
    return <LoadingState message={seeding ? 'Demo verileri oluşturuluyor...' : 'Kullanıcılar yükleniyor...'} />;
  }

  const userList = users?.users ?? [];
  const hasUsers = userList.length > 0;

  if (!hasUsers) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Kayıtlı kullanıcı yok</Text>
        <Text style={styles.emptyText}>Önce bir kurum oluşturun veya demo verileri yükleyin.</Text>
        <Button title="Yeni Kurum Oluştur" onPress={() => router.replace('/create-institution')} fullWidth />
        <Button title="Demo Verileri Oluştur" onPress={handleSeed} loading={seeding} variant="outline" fullWidth />
        <Button title="Geri" onPress={() => router.replace('/welcome')} variant="ghost" fullWidth />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, shadows.md]}>
        <View style={[styles.logoWrap, { backgroundColor: modules.auth.light }]}>
          <Ionicons name="log-in-outline" size={32} color={modules.auth.main} />
        </View>
        <Text style={styles.title}>Giriş Yap</Text>
        {users?.institutionName ? (
          <Text style={styles.subtitle}>{users.institutionName}</Text>
        ) : null}
      </View>

      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.sectionLabel}>Kullanıcı seçin</Text>
        {userList.map((user) => {
          const selected = selectedUser?.id === user.id;
          return (
            <Pressable
              key={user.id}
              onPress={() => setSelectedUser(user)}
              style={[styles.userCard, selected && styles.userCardSelected]}
            >
              <View style={[styles.userIcon, { backgroundColor: roleColor(user.role).light }]}>
                <Ionicons name={roleIcon(user.role)} size={20} color={roleColor(user.role).main} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.displayName}</Text>
                <Text style={styles.userRole}>{roleLabel(user.role)}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </Pressable>
          );
        })}

        {selectedUser?.pin ? (
          <Input
            label="PIN"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="1234"
          />
        ) : null}

        <Button
          title="Giriş Yap"
          onPress={handleLogin}
          loading={loading}
          disabled={!selectedUser}
          fullWidth
          size="lg"
        />

        <Button
          title="Yeni Kurum Oluştur"
          onPress={() => router.push('/create-institution')}
          variant="outline"
          fullWidth
        />
        <Button title="Geri" onPress={() => router.replace('/welcome')} variant="ghost" fullWidth />
      </View>
    </ScrollView>
  );
}

function roleLabel(role: User['role']): string {
  const labels = {
    INSTITUTION_ADMIN: 'Kurum Müdürü',
    UNIT_MANAGER: 'Birim Yöneticisi',
    PERSONNEL: 'Personel',
  };
  return labels[role];
}

function roleIcon(role: User['role']): keyof typeof Ionicons.glyphMap {
  const icons = {
    INSTITUTION_ADMIN: 'shield-outline',
    UNIT_MANAGER: 'briefcase-outline',
    PERSONNEL: 'person-outline',
  } as const;
  return icons[role];
}

function roleColor(role: User['role']) {
  const map = {
    INSTITUTION_ADMIN: modules.auth,
    UNIT_MANAGER: modules.units,
    PERSONNEL: modules.personnel,
  };
  return map[role];
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  hero: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionLabel: { ...typography.overline, color: colors.textMuted },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  userCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  userName: { ...typography.h3, color: colors.text },
  userRole: { ...typography.bodySmall, color: colors.textSecondary },
});
