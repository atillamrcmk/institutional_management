import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { isServerApiConfigured, API_BASE_URL } from '@/shared/api/config';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/layout/Section';
import { ModuleCard } from '@/shared/components/layout/ModuleCard';
import { colors, spacing, typography } from '@/shared/theme';

const menuItems = [
  { title: 'Mesajlar', subtitle: 'Personel ve birimlere duyuru gönder', route: '/(admin)/messages', module: 'dashboard' as const },
  { title: 'Kullanıcı Davet Et', subtitle: 'Yetkili veya personel hesabı oluştur', route: '/(admin)/users/invite', module: 'auth' as const },
  { title: 'Birimler', subtitle: 'Birim, vardiya ve personel kurulumu', route: '/(admin)/units', module: 'units' as const },
  { title: 'Bugünkü Vardiyalar', subtitle: 'Kim görevde?', route: '/(admin)/shifts', module: 'shifts' as const },
  { title: 'Şu An Kurumda', subtitle: 'Anlık personel durumu', route: '/(admin)/presence', module: 'presence' as const },
];

export default function MoreScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const tenant = useAuthStore((s) => s.tenant);
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <Screen scroll>
      <PageHeader title="Daha Fazla" subtitle="Yönetim ve ayarlar" module="dashboard" />

      {isServerApiConfigured() ? (
        <Section title="Oturum">
          <Text style={styles.meta}>{user?.displayName}</Text>
          <Text style={styles.metaSecondary}>
            {tenant?.name ?? 'Kurum'} · {API_BASE_URL.replace(/^https?:\/\//, '')}
          </Text>
        </Section>
      ) : null}

      <Section title="Yönetim">
        {menuItems.map((item) => (
          <ModuleCard
            key={item.route}
            title={item.title}
            subtitle={item.subtitle}
            module={item.module}
            onPress={() => router.push(item.route as never)}
          />
        ))}
      </Section>

      <Section title="Sistem">
        <Button title="Çıkış Yap" onPress={handleLogout} variant="danger" fullWidth />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  metaSecondary: { ...typography.bodySmall, color: colors.textSecondary },
});
