import { useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  createPersonnelOnServer,
  updatePersonnelOnServer,
} from '@/features/personnel/services/personnelApi';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { PersonnelPhotoField } from '@/shared/components/PersonnelPhotoField';
import { persistPersonnelPhoto } from '@/features/personnel/services/personnelPhotoService';
import { colors, spacing } from '@/shared/theme';

export default function CreatePersonnelScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const authMode = useAuthStore((s) => s.authMode);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sicilNo, setSicilNo] = useState('');
  const [title, setTitle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!institutionId || !firstName.trim() || !lastName.trim() || !sicilNo.trim()) {
      Alert.alert('Eksik bilgi', 'Ad, soyad ve sicil no zorunludur.');
      return;
    }
    setSaving(true);
    try {
      let personnelId: string;

      if (authMode === 'server') {
        if (!accessToken) throw new Error('Oturum bulunamadı.');
        const personnel = await createPersonnelOnServer(accessToken, institutionId, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          sicilNo: sicilNo.trim(),
          title: title.trim() || null,
        });
        personnelId = personnel.id;

        if (photoUri) {
          const savedPhotoUri = await persistPersonnelPhoto(personnel.id, photoUri);
          await updatePersonnelOnServer(accessToken, institutionId, personnel.id, {
            photoUri: savedPhotoUri,
          });
        }
      } else {
        const repos = getRepositories();
        const personnel = await repos.personnel.create(institutionId, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          sicilNo: sicilNo.trim(),
          title: title.trim() || undefined,
        });
        personnelId = personnel.id;

        if (photoUri) {
          const savedPhotoUri = await persistPersonnelPhoto(personnel.id, photoUri);
          await repos.personnel.update(personnel.id, { photoUri: savedPhotoUri });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['personnel'] });
      Alert.alert('Başarılı', 'Personel eklendi.', [
        { text: 'Tamam', onPress: () => router.replace(`/(admin)/personnel/${personnelId}`) },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PersonnelPhotoField
        firstName={firstName}
        lastName={lastName}
        photoUri={photoUri}
        onPhotoChange={setPhotoUri}
      />
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
