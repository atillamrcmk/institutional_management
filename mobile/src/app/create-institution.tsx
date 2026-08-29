import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { createEmptyInstitution } from '@/shared/database/seed/createEmptyInstitution';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';

export default function CreateInstitutionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const resetAfterSeed = useAuthStore((s) => s.resetAfterSeed);
  const [institutionName, setInstitutionName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!institutionName.trim()) {
      Alert.alert('Eksik bilgi', 'Kurum adı girin.');
      return;
    }

    setCreating(true);
    try {
      await resetAfterSeed();
      await createEmptyInstitution(institutionName.trim());
      await queryClient.invalidateQueries({ queryKey: ['welcome-status'] });
      await queryClient.invalidateQueries({ queryKey: ['demo-users'] });
      Alert.alert(
        'Kurum oluşturuldu',
        'Kurum Müdürü ile giriş yapın (PIN: 1234). Ardından birim, personel ve vardiyaları uygulama içinden ekleyebilirsiniz.',
        [{ text: 'Giriş Yap', onPress: () => router.replace('/login') }],
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
        <Text style={styles.title}>Yeni Kurum Oluştur</Text>
        <Text style={styles.subtitle}>
          Kurumunuzu oluşturun. Varsayılan yönetici hesabı otomatik eklenecek.
        </Text>
      </View>

      <View style={[styles.card, shadows.sm]}>
        <Input
          label="Kurum Adı"
          value={institutionName}
          onChangeText={setInstitutionName}
          placeholder="Örn: Merkez Hastanesi"
          autoFocus
        />

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            Kurum Müdürü hesabı oluşturulur. Giriş PIN: <Text style={styles.pin}>1234</Text>
          </Text>
        </View>

        <Button
          title="Kurumu Oluştur"
          onPress={handleCreate}
          loading={creating}
          fullWidth
          size="lg"
        />
        <Button
          title="Geri"
          onPress={() => router.back()}
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
  },
  infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  pin: { fontWeight: '700', color: colors.text },
});
