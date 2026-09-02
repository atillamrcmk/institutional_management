import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Avatar } from '@/shared/components/Avatar';
import { Button } from '@/shared/components/Button';
import { pickPersonnelPhoto } from '@/features/personnel/services/personnelPhotoService';
import { colors, spacing, typography } from '@/shared/theme';
import { getPersonnelFullName } from '@/shared/utils/id';

interface PersonnelPhotoFieldProps {
  firstName: string;
  lastName: string;
  photoUri: string | null;
  onPhotoChange: (uri: string | null) => void;
}

export function PersonnelPhotoField({
  firstName,
  lastName,
  photoUri,
  onPhotoChange,
}: PersonnelPhotoFieldProps) {
  const displayName = getPersonnelFullName({
    firstName: firstName || 'P',
    lastName: lastName || 'ersonel',
  } as { firstName: string; lastName: string });

  const handlePick = async () => {
    const uri = await pickPersonnelPhoto();
    if (uri) onPhotoChange(uri);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Fotoğraf</Text>
      <View style={styles.row}>
        <Pressable onPress={handlePick}>
          <Avatar name={displayName} size={88} photoUri={photoUri} />
        </Pressable>
        <View style={styles.actions}>
          <Button title="Fotoğraf Seç" onPress={handlePick} variant="outline" />
          {photoUri ? (
            <Button title="Kaldır" onPress={() => onPhotoChange(null)} variant="ghost" />
          ) : null}
        </View>
      </View>
      <Text style={styles.hint}>Galeriden seçebilir veya kamera ile çekebilirsiniz.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flex: 1, gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
