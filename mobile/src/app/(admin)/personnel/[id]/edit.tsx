import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { PersonnelPhotoField } from '@/shared/components/PersonnelPhotoField';
import {
  deletePersonnelPhoto,
  persistPersonnelPhoto,
} from '@/features/personnel/services/personnelPhotoService';
import { colors, spacing } from '@/shared/theme';

export default function EditPersonnelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sicilNo, setSicilNo] = useState('');
  const [title, setTitle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [savedPhotoUri, setSavedPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: personnel, isLoading } = useQuery({
    queryKey: ['personnel-edit', id],
    queryFn: () => getRepositories().personnel.getById(id),
  });

  useEffect(() => {
    if (personnel) {
      setFirstName(personnel.firstName);
      setLastName(personnel.lastName);
      setSicilNo(personnel.sicilNo);
      setTitle(personnel.title ?? '');
      setPhotoUri(personnel.photoUri);
      setSavedPhotoUri(personnel.photoUri);
    }
  }, [personnel]);

  const handleSave = async () => {
    if (saving) return;
    if (!firstName.trim() || !lastName.trim() || !sicilNo.trim()) {
      Alert.alert('Eksik bilgi', 'Ad, soyad ve sicil no zorunludur.');
      return;
    }
    setSaving(true);
    try {
      let nextPhotoUri = photoUri;

      if (!photoUri && savedPhotoUri) {
        await deletePersonnelPhoto(savedPhotoUri);
        nextPhotoUri = null;
      } else if (photoUri && photoUri !== savedPhotoUri) {
        await deletePersonnelPhoto(savedPhotoUri);
        nextPhotoUri = await persistPersonnelPhoto(id, photoUri);
      }

      await getRepositories().personnel.update(id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        sicilNo: sicilNo.trim(),
        title: title.trim() || undefined,
        photoUri: nextPhotoUri,
      });
      await queryClient.invalidateQueries({ queryKey: ['personnel'] });
      await queryClient.invalidateQueries({ queryKey: ['personnel-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['personnel-edit', id] });
      Alert.alert('Başarılı', 'Personel güncellendi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = () => {
    Alert.alert('Personeli Pasifleştir', 'Bu personel listeden kaldırılacak. Devam?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Pasifleştir',
        style: 'destructive',
        onPress: async () => {
          await deletePersonnelPhoto(savedPhotoUri);
          await getRepositories().personnel.delete(id);
          await queryClient.invalidateQueries({ queryKey: ['personnel'] });
          router.replace('/(admin)/(tabs)/personnel');
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;

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
      <Input label="Ünvan" value={title} onChangeText={setTitle} />
      <Button title="Kaydet" onPress={handleSave} loading={saving} />
      <Button title="Personeli Pasifleştir" onPress={handleDeactivate} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
});
