import { useState } from 'react';
import { ScrollView, StyleSheet, Alert, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { Screen } from '@/shared/components/layout/Screen';
import type { UserRole } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';

const roles: Array<{ value: UserRole; label: string }> = [
  { value: 'UNIT_MANAGER', label: 'Yetkili (personel yönetimi)' },
  { value: 'PERSONNEL', label: 'Personel' },
  { value: 'INSTITUTION_ADMIN', label: 'Kurum yöneticisi' },
];

export default function InviteUserScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('UNIT_MANAGER');
  const [canMessageAdmins, setCanMessageAdmins] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleInvite = async () => {
    if (!displayName.trim() || !email.trim() || !password || password.length < 8) {
      Alert.alert('Eksik bilgi', 'Ad, e-posta ve en az 8 karakter şifre zorunludur.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      Alert.alert('Şifre', 'Şifre en az bir harf ve bir rakam içermelidir.');
      return;
    }

    setSaving(true);
    try {
      await getRepositories().auth.createUser({
        institutionId: '',
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        canMessageAdmins: role === 'PERSONNEL' ? canMessageAdmins : false,
      });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Davet edildi', 'Kullanıcı oluşturuldu. Giriş için e-posta ve şifreyi paylaşın.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Davet başarısız.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Yetkili personel; personel ekleme/düzenleme yapabilir. Kurum yöneticisi tüm yetkilere sahiptir.
        </Text>

        <Input label="Ad Soyad" value={displayName} onChangeText={setDisplayName} />
        <Input
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="Geçici şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="En az 8 karakter, harf + rakam"
        />

        <Text style={styles.label}>Rol</Text>
        <View style={styles.roles}>
          {roles.map((item) => (
            <Pressable
              key={item.value}
              style={[styles.roleChip, role === item.value && styles.roleChipActive]}
              onPress={() => setRole(item.value)}
            >
              <Text style={[styles.roleText, role === item.value && styles.roleTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {role === 'PERSONNEL' ? (
          <Pressable
            style={styles.checkRow}
            onPress={() => setCanMessageAdmins((v) => !v)}
          >
            <View style={[styles.check, canMessageAdmins && styles.checkOn]}>
              <Text style={styles.checkMark}>{canMessageAdmins ? '✓' : ''}</Text>
            </View>
            <Text style={styles.checkLabel}>Yöneticilere mesaj gönderebilsin</Text>
          </Pressable>
        ) : null}

        <Button title="Kullanıcıyı Davet Et" onPress={handleInvite} loading={saving} fullWidth />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  hint: { ...typography.bodySmall, color: colors.textSecondary },
  label: { ...typography.label, color: colors.textSecondary },
  roles: { gap: spacing.sm },
  roleChip: {
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.offLight,
  },
  roleChipActive: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roleText: { ...typography.body, color: colors.text },
  roleTextActive: { color: colors.primary, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.textInverse, fontWeight: '700' },
  checkLabel: { ...typography.body, flex: 1 },
});
