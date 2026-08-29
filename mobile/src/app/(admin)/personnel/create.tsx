import { useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { colors, spacing } from '@/shared/theme';

export default function CreatePersonnelScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sicilNo, setSicilNo] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!institutionId || !firstName.trim() || !lastName.trim() || !sicilNo.trim()) {
      Alert.alert('Eksik bilgi', 'Ad, soyad ve sicil no zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const personnel = await getRepositories().personnel.create(institutionId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sicilNo: sicilNo.trim(),
        title: title.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['personnel'] });
      Alert.alert('Başarılı', 'Personel eklendi.', [
        { text: 'Tamam', onPress: () => router.replace(`/(admin)/personnel/${personnel.id}`) },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Ad *" value={firstName} onChangeText={setFirstName} />
      <Input label="Soyad *" value={lastName} onChangeText={setLastName} />
      <Input label="Sicil No *" value={sicilNo} onChangeText={setSicilNo} />
      <Input label="Ünvan" value={title} onChangeText={setTitle} placeholder="Güvenlik Görevlisi" />
      <Button title="Kaydet" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
});
