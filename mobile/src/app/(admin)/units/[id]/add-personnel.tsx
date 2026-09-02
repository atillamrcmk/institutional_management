import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Input } from '@/shared/components/Input';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { colors, spacing, typography } from '@/shared/theme';
import { getPersonnelFullName } from '@/shared/utils/id';

export default function AddPersonnelToUnitScreen() {
  const { id: unitId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: available, isLoading } = useQuery({
    queryKey: ['unit-add-personnel', institutionId, unitId, debouncedSearch],
    queryFn: () =>
      getRepositories().units.getUnassignedPersonnel(
        institutionId!,
        debouncedSearch.trim() || undefined,
      ),
    enabled: !!institutionId && !!unitId,
    placeholderData: keepPreviousData,
  });

  const handleAssign = async (personnelId: string) => {
    try {
      await getRepositories().units.assignPersonnel(unitId, personnelId);
      await queryClient.invalidateQueries({ queryKey: ['unit-detail', unitId] });
      await queryClient.invalidateQueries({ queryKey: ['unit-add-personnel'] });
      await queryClient.invalidateQueries({ queryKey: ['presence'] });
      Alert.alert('Başarılı', 'Personel birime eklendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Atama başarısız.');
    }
  };

  const showInitialLoading = isLoading && !available;

  return (
    <View style={styles.container}>
      <Input placeholder="Personel ara..." value={search} onChangeText={setSearch} style={styles.search} />
      <Text style={styles.hint}>
        Sadece herhangi bir birime atanmamış personel listelenir.
      </Text>
      <Text style={styles.section}>Eklenebilir Personel ({available?.length ?? 0})</Text>

      {showInitialLoading ? (
        <LoadingState message="Personel listesi yükleniyor..." />
      ) : (
        <FlatList
          data={available}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              Birime eklenebilecek boşta personel yok. Başka bir birimde görevli olanları önce o
              birimden çıkarmanız gerekir.
            </Text>
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <CardTitle>{getPersonnelFullName(item)}</CardTitle>
                  <CardSubtitle>{item.sicilNo}</CardSubtitle>
                </View>
                <Button title="Ekle" onPress={() => handleAssign(item.id)} />
              </View>
            </Card>
          )}
        />
      )}

      <Button title="Geri" onPress={() => router.back()} variant="ghost" style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { margin: spacing.md, marginBottom: 0 },
  hint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  section: { ...typography.label, color: colors.textSecondary, margin: spacing.md, marginBottom: 0 },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  info: { flex: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  back: { margin: spacing.md },
});
