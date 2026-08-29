import { useState } from 'react';
import { FlatList, StyleSheet, Pressable, Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Input } from '@/shared/components/Input';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import type { Personnel } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { getPersonnelFullName } from '@/shared/utils/id';

export default function AddPersonnelToUnitScreen() {
  const { id: unitId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['unit-add-personnel', institutionId, unitId, search],
    queryFn: async () => {
      const repos = getRepositories();
      const assigned = await repos.units.getActivePersonnelForUnit(unitId);
      const assignedIds = new Set(assigned.map((p) => p.id));
      const all = search.trim()
        ? await repos.personnel.search(institutionId!, search)
        : await repos.personnel.getAll(institutionId!);
      return { assigned, available: all.filter((p) => !assignedIds.has(p.id)) };
    },
    enabled: !!institutionId && !!unitId,
  });

  const handleAssign = async (personnelId: string) => {
    try {
      await getRepositories().units.assignPersonnel(unitId, personnelId);
      await queryClient.invalidateQueries({ queryKey: ['unit-detail', unitId] });
      await queryClient.invalidateQueries({ queryKey: ['unit-add-personnel'] });
      Alert.alert('Başarılı', 'Personel birime eklendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Atama başarısız.');
    }
  };

  if (isLoading || !data) return <LoadingState />;

  return (
    <View style={styles.container}>
      <Input placeholder="Personel ara..." value={search} onChangeText={setSearch} style={styles.search} />
      <Text style={styles.section}>Eklenebilir Personel ({data.available.length})</Text>
      <FlatList
        data={data.available}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Tüm personel zaten bu birimde</Text>}
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
      <Button title="Geri" onPress={() => router.back()} variant="ghost" style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { margin: spacing.md, marginBottom: 0 },
  section: { ...typography.label, color: colors.textSecondary, margin: spacing.md, marginBottom: 0 },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  info: { flex: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  back: { margin: spacing.md },
});
