import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';
import { seedDemoData } from '@/shared/database/seed/seedDemoData';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const resetAfterSeed = useAuthStore((s) => s.resetAfterSeed);
  const [seeding, setSeeding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['welcome-status'],
    queryFn: async () => {
      const repos = getRepositories();
      const institution = await repos.institution.getFirst();
      if (!institution) {
        return { hasInstitution: false, userCount: 0, institutionName: null };
      }
      const users = await repos.auth.getDemoUsers(institution.id);
      return {
        hasInstitution: true,
        userCount: users.length,
        institutionName: institution.name,
      };
    },
  });

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await resetAfterSeed();
      await seedDemoData();
      await queryClient.invalidateQueries({ queryKey: ['welcome-status'] });
      await queryClient.invalidateQueries({ queryKey: ['demo-users'] });
      Alert.alert('Başarılı', 'Demo verileri oluşturuldu. Kurum Müdürü ile giriş yapın (PIN: 1234).', [
        { text: 'Giriş Yap', onPress: () => router.push('/login') },
      ]);
    } catch (e) {
      console.error('Demo seed failed:', e);
      Alert.alert('Hata', e instanceof Error ? e.message : 'Demo verileri oluşturulamadı.');
    } finally {
      setSeeding(false);
    }
  };

  if (isLoading || seeding) {
    return <LoadingState message={seeding ? 'Demo verileri oluşturuluyor...' : 'Yükleniyor...'} />;
  }

  const hasInstitution = data?.hasInstitution ?? false;
  const authTone = modules.auth;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, shadows.md]}>
        <View style={[styles.logoWrap, { backgroundColor: authTone.light }]}>
          <Ionicons name="shield-checkmark" size={40} color={authTone.main} />
        </View>
        <Text style={styles.title}>Personel Planla</Text>
        <Text style={styles.subtitle}>Kurum personel planlama ve vardiya yönetimi</Text>
      </View>

      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>
          {hasInstitution ? 'Hoş geldiniz' : 'Başlayın'}
        </Text>
        <Text style={styles.cardText}>
          {hasInstitution
            ? `"${data?.institutionName}" kurumu kayıtlı. Giriş yapabilir veya yeni bir kurum oluşturabilirsiniz.`
            : 'İlk kurulum için yeni bir kurum oluşturun veya demo verileriyle deneyin.'}
        </Text>

        <Button
          title="Yeni Kurum Oluştur"
          onPress={() => router.push('/create-institution')}
          fullWidth
          size="lg"
        />

        {hasInstitution ? (
          <Button
            title="Giriş Yap"
            onPress={() => router.push('/login')}
            variant="outline"
            fullWidth
            size="lg"
          />
        ) : null}

        <Button
          title={hasInstitution ? 'Demo Verileri Yükle' : 'Demo Verileriyle Dene'}
          onPress={handleSeed}
          variant="ghost"
          fullWidth
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
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
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.display, color: colors.text, textAlign: 'center', fontSize: 28 },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardTitle: { ...typography.h2, color: colors.text },
  cardText: { ...typography.bodySmall, color: colors.textSecondary },
});
