import { useState } from 'react';
import { FlatList, StyleSheet, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { invalidateShiftQueries } from '@/features/shifts/utils/invalidateShiftQueries';
import { Input } from '@/shared/components/Input';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { colors, spacing } from '@/shared/theme';
import { getPersonnelFullName } from '@/shared/utils/id';

export default function AddPersonnelToShiftGroupScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['shift-add-personnel', groupId, search],
    queryFn: async () => {
      const repos = getRepositories();
      const group = await repos.shifts.getGroupById(groupId);
      if (!group) return { candidates: [], unitName: '' };

      const unit = await repos.units.getById(group.unitId);
      const inGroup = await repos.shifts.getPersonnelInGroup(groupId);
      const inGroupIds = new Set(inGroup.map((p) => p.id));

      const unitPersonnel = await repos.units.getActivePersonnelForUnit(group.unitId);
      const filtered = unitPersonnel.filter((p) => !inGroupIds.has(p.id));

      const q = search.trim().toLowerCase();
      const candidates = q
        ? filtered.filter(
            (p) =>
              p.firstName.toLowerCase().includes(q) ||
              p.lastName.toLowerCase().includes(q) ||
              p.sicilNo.toLowerCase().includes(q),
          )
        : filtered;

      return { candidates, unitName: unit?.name ?? '' };
    },
    enabled: !!institutionId && !!groupId,
  });

  const handleAssign = async (personnelId: string) => {
    try {
      await getRepositories().shifts.assignPersonnelToGroup(personnelId, groupId);
      await queryClient.invalidateQueries({ queryKey: ['shift-detail', groupId] });
      await queryClient.invalidateQueries({ queryKey: ['unit-detail'] });
      await invalidateShiftQueries(queryClient);
      Alert.alert('Başarılı', 'Personel vardiyaya eklendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Atama başarısız.');
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <View style={styles.container}>
      <Input
        placeholder="Birim personeli ara..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />
      <FlatList
        data={data?.candidates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <CardTitle>Atanacak personel yok</CardTitle>
            <CardSubtitle>
              Önce {data?.unitName ? `"${data.unitName}"` : 'bu'} birime personel ekleyin.
            </CardSubtitle>
            <Button title="Geri" onPress={() => router.back()} variant="outline" />
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <CardTitle>{getPersonnelFullName(item)}</CardTitle>
            <CardSubtitle>{item.sicilNo}</CardSubtitle>
            <Button title="Vardiyaya Ekle" onPress={() => handleAssign(item.id)} />
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { margin: spacing.md },
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  emptyCard: { gap: spacing.sm, padding: spacing.md },
});
