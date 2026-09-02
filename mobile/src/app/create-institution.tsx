import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { API_BASE_URL } from '@/shared/api/config';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export default function CreateInstitutionScreen() {
  const router = useRouter();
  const createTenantAndLogin = useAuthStore((s) => s.createTenantAndLogin);

  const [institutionName, setInstitutionName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [orgType, setOrgType] = useState<'INSTITUTION' | 'BUSINESS'>('INSTITUTION');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const autoSlug = useMemo(() => slugify(institutionName), [institutionName]);
  const effectiveSlug = slugTouched ? slug : autoSlug;

  const handleCreate = async () => {
    if (!institutionName.trim() || !effectiveSlug || !displayName.trim() || !email.trim() || !password) {
      Alert.alert('Eksik bilgi', 'Tüm alanları doldurun.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Şifre', 'Şifre en az 6 karakter olmalı.');
      return;
    }

    setCreating(true);
    try {
      await createTenantAndLogin({
        name: institutionName.trim(),
        slug: effectiveSlug,
        orgType,
        owner: {
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        },
      });
      Alert.alert(
        'Kurum oluşturuldu',
        `"${institutionName.trim()}" sunucuda hazır. Personel eklemeye başlayabilirsiniz.`,
        [{ text: 'Devam', onPress: () => router.replace('/') }],
      );
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kurum oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  };

  const unitsTone = modules.units;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, shadows.sm]}>
        <View style={[styles.iconWrap, { backgroundColor: unitsTone.light }]}>
          <Ionicons name="business" size={28} color={unitsTone.main} />
        </View>
        <Text style={styles.title}>Yeni Kurum / İşletme</Text>
        <Text style={styles.subtitle}>
          Sunucuda size özel veritabanı oluşturulur. API: {API_BASE_URL.replace(/^https?:\/\//, '')}
        </Text>
      </View>

      <View style={[styles.card, shadows.sm]}>
        <View style={styles.typeRow}>
          <Pressable
            style={[styles.typeChip, orgType === 'INSTITUTION' && styles.typeChipActive]}
            onPress={() => setOrgType('INSTITUTION')}
          >
            <Text
              style={[styles.typeChipText, orgType === 'INSTITUTION' && styles.typeChipTextActive]}
            >
              Kurum
            </Text>
          </Pressable>
          <Pressable
            style={[styles.typeChip, orgType === 'BUSINESS' && styles.typeChipActive]}
            onPress={() => setOrgType('BUSINESS')}
          >
            <Text style={[styles.typeChipText, orgType === 'BUSINESS' && styles.typeChipTextActive]}>
              İşletme
            </Text>
          </Pressable>
        </View>

        <Input
          label="Kurum / İşletme Adı"
          value={institutionName}
          onChangeText={(value) => {
            setInstitutionName(value);
            if (!slugTouched) setSlug(slugify(value));
          }}
          placeholder="Örn: Merkez Hastanesi"
          autoFocus
        />
        <Input
          label="Kurum kodu (slug)"
          value={effectiveSlug}
          onChangeText={(value) => {
            setSlugTouched(true);
            setSlug(slugify(value));
          }}
          placeholder="merkez_hastanesi"
          autoCapitalize="none"
        />
        <Input
          label="Yönetici adı"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Ad Soyad"
        />
        <Input
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="yonetici@kurum.com"
        />
        <Input
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="En az 6 karakter"
        />

        <View style={styles.infoBox}>
          <Ionicons name="cloud-outline" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            Bu hesap kurum yöneticisidir. Daha sonra personel yetkilisi davet edebilirsiniz.
          </Text>
        </View>

        <Button
          title="Kurumu Oluştur ve Giriş Yap"
          onPress={handleCreate}
          loading={creating}
          fullWidth
          size="lg"
        />
        <Button title="Geri" onPress={() => router.back()} variant="ghost" fullWidth />
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
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.offLight,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: colors.primary },
  typeChipText: { ...typography.label, color: colors.textSecondary },
  typeChipTextActive: { color: colors.textInverse },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
  },
  infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
});
