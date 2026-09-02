import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { isServerApiConfigured, API_BASE_URL } from '@/shared/api/config';
import { Button } from '@/shared/components/Button';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const serverMode = isServerApiConfigured();
  const authTone = modules.auth;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, shadows.md]}>
        <View style={[styles.logoWrap, { backgroundColor: authTone.light }]}>
          <Ionicons name="shield-checkmark" size={40} color={authTone.main} />
        </View>
        <Text style={styles.title}>Personel Planla</Text>
        <Text style={styles.subtitle}>Kurum personel planlama ve vardiya yönetimi</Text>
        {serverMode ? (
          <Text style={styles.apiHint}>{API_BASE_URL.replace(/^https?:\/\//, '')}</Text>
        ) : null}
      </View>

      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.cardTitle}>Başlayın</Text>
        <Text style={styles.cardText}>
          {serverMode
            ? 'Kurumunuzu sunucuda oluşturun veya mevcut hesabınızla giriş yapın. Tüm veriler güvenli şekilde sunucu veritabanında saklanır.'
            : 'API adresi tanımlı değil. Yerel demo veya EXPO_PUBLIC_API_URL ile sunucu bağlantısı kullanın.'}
        </Text>

        <Button
          title="Giriş Yap"
          onPress={() => router.push('/login')}
          fullWidth
          size="lg"
        />

        <Button
          title="Yeni Kurum / İşletme Oluştur"
          onPress={() => router.push('/create-institution')}
          variant="outline"
          fullWidth
          size="lg"
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
  apiHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
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
