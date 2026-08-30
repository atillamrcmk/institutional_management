import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { seedDemoData } from '@/shared/database/seed/seedDemoData';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Section } from '@/shared/components/layout/Section';
import { ModuleCard } from '@/shared/components/layout/ModuleCard';

const menuItems = [
  { title: 'Birimler', subtitle: 'Birim, vardiya ve personel kurulumu', route: '/(admin)/units', module: 'units' as const },
  { title: 'Bugünkü Vardiyalar', subtitle: 'Kim görevde?', route: '/(admin)/shifts', module: 'shifts' as const },
  { title: 'Şu An Kurumda', subtitle: 'Anlık personel durumu', route: '/(admin)/presence', module: 'presence' as const },
];

export default function MoreScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const resetAfterSeed = useAuthStore((s) => s.resetAfterSeed);
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await resetAfterSeed();
      await seedDemoData();
      await queryClient.clear();
      Alert.alert('Başarılı', 'Demo verileri yeniden oluşturuldu. Lütfen tekrar giriş yapın.', [
        { text: 'Tamam', onPress: () => router.replace('/welcome') },
      ]);
    } catch (e) {
      console.error('Demo seed failed:', e);
      Alert.alert('Hata', e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setSeeding(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <Screen scroll>
      <PageHeader title="Daha Fazla" subtitle="Yönetim ve ayarlar" module="dashboard" />

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
        <Button
          title="Demo Verileri Yeniden Oluştur"
          onPress={handleSeed}
          loading={seeding}
          variant="outline"
          fullWidth
        />
        <Button title="Çıkış Yap" onPress={handleLogout} variant="danger" fullWidth />
      </Section>
    </Screen>
  );
}
