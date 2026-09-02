import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { messageQueryKeys } from '@/features/messaging/constants/messageQueryKeys';
import { sendMessage } from '@/features/messaging/services/messageService';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { PersonnelListSection } from '@/shared/components/PersonnelListSection';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { getRepositories } from '@/shared/repositories';
import type { MessageAudienceType, Unit } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';

const audienceOptions: Array<{ value: MessageAudienceType; label: string }> = [
  { value: 'UNIT', label: 'Birim' },
  { value: 'PERSONNEL', label: 'Seçili Personel' },
  { value: 'ALL_PERSONNEL', label: 'Tüm Personel' },
];

export default function ComposeMessageScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState<MessageAudienceType>('UNIT');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [unitFilterId, setUnitFilterId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['message-compose-data', institutionId],
    queryFn: async () => {
      const repos = getRepositories();
      const [units, personnel] = await Promise.all([
        repos.units.getAll(institutionId),
        repos.personnel.getAll(institutionId),
      ]);
      return { units, personnel };
    },
  });

  const { data: unitPersonnel = [], isLoading: unitPersonnelLoading } = useQuery({
    queryKey: ['message-unit-personnel', unitFilterId],
    enabled: audienceType === 'PERSONNEL' && Boolean(unitFilterId),
    queryFn: async () => {
      if (!unitFilterId) return [];
      return getRepositories().units.getActivePersonnelForUnit(unitFilterId);
    },
  });

  const personnelForPicker = useMemo(() => {
    if (audienceType !== 'PERSONNEL') return [];
    if (unitFilterId) return unitPersonnel;
    return data?.personnel.filter((p) => p.status === 'ACTIVE') ?? [];
  }, [audienceType, unitFilterId, unitPersonnel, data?.personnel]);

  const togglePersonnel = (id: string) => {
    setSelectedPersonnel((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Eksik bilgi', 'Konu ve mesaj metni zorunludur.');
      return;
    }
    if (audienceType === 'UNIT' && !selectedUnitId) {
      Alert.alert('Eksik bilgi', 'Lütfen bir birim seçin.');
      return;
    }
    if (audienceType === 'PERSONNEL' && selectedPersonnel.length === 0) {
      Alert.alert('Eksik bilgi', 'En az bir personel seçin.');
      return;
    }

    setSaving(true);
    try {
      await sendMessage(institutionId, user, {
        subject: subject.trim(),
        body: body.trim(),
        audienceType,
        unitId: audienceType === 'UNIT' ? selectedUnitId : null,
        personnelIds: audienceType === 'PERSONNEL' ? selectedPersonnel : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: messageQueryKeys.sent(user.id) });
      Alert.alert('Gönderildi', 'Mesajınız iletildi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Mesaj gönderilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Form hazırlanıyor..." />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Alıcı türü</Text>
        <View style={styles.chips}>
          {audienceOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.chip, audienceType === option.value && styles.chipActive]}
              onPress={() => setAudienceType(option.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  audienceType === option.value && styles.chipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {audienceType === 'UNIT' ? (
          <>
            <Text style={styles.label}>Birim</Text>
            <View style={styles.unitList}>
              {(data?.units ?? []).map((unit: Unit) => (
                <Pressable
                  key={unit.id}
                  style={[styles.unitItem, selectedUnitId === unit.id && styles.unitItemActive]}
                  onPress={() => setSelectedUnitId(unit.id)}
                >
                  <Text
                    style={[
                      styles.unitItemText,
                      selectedUnitId === unit.id && styles.unitItemTextActive,
                    ]}
                  >
                    {unit.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {audienceType === 'PERSONNEL' ? (
          <>
            <Text style={styles.label}>Birime göre filtrele (isteğe bağlı)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <Pressable
                style={[styles.chip, !unitFilterId && styles.chipActive]}
                onPress={() => setUnitFilterId(null)}
              >
                <Text style={[styles.chipText, !unitFilterId && styles.chipTextActive]}>Tümü</Text>
              </Pressable>
              {(data?.units ?? []).map((unit: Unit) => (
                <Pressable
                  key={unit.id}
                  style={[styles.chip, unitFilterId === unit.id && styles.chipActive]}
                  onPress={() => setUnitFilterId(unit.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      unitFilterId === unit.id && styles.chipTextActive,
                    ]}
                  >
                    {unit.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {unitPersonnelLoading ? (
              <LoadingState message="Personel listesi yükleniyor..." />
            ) : (
              <PersonnelListSection
                personnel={personnelForPicker}
                selectedIds={selectedPersonnel}
                onToggleSelect={togglePersonnel}
                selectionMode
                defaultExpanded
                emptyMessage="Seçilebilir personel yok."
              />
            )}
          </>
        ) : null}

        <Input label="Konu" value={subject} onChangeText={setSubject} placeholder="Mesaj konusu" />
        <Input
          label="Mesaj"
          value={body}
          onChangeText={setBody}
          placeholder="Mesajınızı yazın..."
          multiline
          numberOfLines={6}
          style={styles.bodyInput}
        />

        <Button title="Gönder" onPress={handleSend} loading={saving} fullWidth />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.offLight,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  unitList: {
    gap: spacing.sm,
  },
  unitItem: {
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.offLight,
  },
  unitItemActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  unitItemText: {
    ...typography.body,
  },
  unitItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  filterRow: {
    flexGrow: 0,
  },
  bodyInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
