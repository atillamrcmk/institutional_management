import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { isServerApiConfigured, API_BASE_URL } from '@/shared/api/config';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const loginWithEmail = useAuthStore((s) => s.loginWithEmail);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleServerLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre girin.');
      return;
    }
    if (!isServerApiConfigured()) {
      Alert.alert('Yapılandırma', 'EXPO_PUBLIC_API_URL tanımlı değil.');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      router.replace('/');
    } catch (e) {
      Alert.alert('Giriş başarısız', e instanceof Error ? e.message : 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, shadows.md]}>
        <View style={[styles.logoWrap, { backgroundColor: modules.auth.light }]}>
          <Ionicons name="log-in-outline" size={32} color={modules.auth.main} />
        </View>
        <Text style={styles.title}>Giriş Yap</Text>
        <Text style={styles.subtitle}>
          {API_BASE_URL.replace(/^https?:\/\//, '')}
        </Text>
      </View>

      <View style={[styles.card, shadows.sm]}>
        <Input
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="yonetici@kurum.com"
          autoComplete="email"
        />
        <Input
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          placeholder="••••••••"
          autoComplete="password"
        />
        <Pressable onPress={() => setShowPassword((v) => !v)}>
          <Text style={styles.togglePassword}>
            {showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
          </Text>
        </Pressable>

        <Button
          title="Giriş Yap"
          onPress={handleServerLogin}
          loading={loading}
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
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  togglePassword: {
    ...typography.label,
    color: colors.primary,
    textAlign: 'right',
  },
});
