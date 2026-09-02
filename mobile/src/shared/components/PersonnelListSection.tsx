import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Avatar } from '@/shared/components/Avatar';
import { Input } from '@/shared/components/Input';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import type { Personnel } from '@/shared/types';
import { colors, modules, radius, spacing, typography } from '@/shared/theme';
import { filterPersonnelBySearch, formatPersonnelPreview } from '@/shared/utils/personnelSearch';
import { getPersonnelFullName } from '@/shared/utils/id';

type ModuleKey = keyof typeof modules;

export interface PersonnelListSectionProps {
  personnel: Personnel[];
  title?: string;
  emptyMessage?: string;
  defaultExpanded?: boolean;
  previewCount?: number;
  searchable?: boolean;
  maxListHeight?: number;
  module?: ModuleKey;
  onPressPersonnel?: (personnel: Personnel) => void;
  renderTrailing?: (personnel: Personnel) => ReactNode;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
  headerAction?: ReactNode;
}

export function PersonnelListSection({
  personnel,
  title,
  emptyMessage = 'Personel bulunamadı',
  defaultExpanded = false,
  previewCount = 3,
  searchable = true,
  maxListHeight = 360,
  module = 'personnel',
  onPressPersonnel,
  renderTrailing,
  selectedIds,
  onToggleSelect,
  selectionMode = false,
  headerAction,
}: PersonnelListSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => filterPersonnelBySearch(personnel, search),
    [personnel, search],
  );

  const moduleColors = modules[module];
  const sectionTitle = title ?? `Personel (${personnel.length})`;
  const selectedCount = selectedIds?.length ?? 0;

  if (personnel.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  const toggleLabel = expanded
    ? 'Gizle'
    : selectionMode
      ? 'Personel seç'
      : 'Tümünü görüntüle';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.headerPressable, pressed && styles.headerPressed]}
        >
          <View style={styles.headerText}>
            <Text style={styles.title}>{sectionTitle}</Text>
            {!expanded ? (
              <Text style={styles.preview} numberOfLines={2}>
                {formatPersonnelPreview(personnel, previewCount)}
              </Text>
            ) : selectionMode && selectedCount > 0 ? (
              <Text style={styles.preview}>{selectedCount} personel seçildi</Text>
            ) : null}
          </View>
          <View style={[styles.toggleBadge, { backgroundColor: moduleColors.light }]}>
            <Text style={[styles.toggleText, { color: moduleColors.main }]}>
              {toggleLabel} {expanded ? '▴' : '▾'}
            </Text>
          </View>
        </Pressable>
        {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
      </View>

      {expanded ? (
        <View style={styles.expandedBody}>
          {searchable ? (
            <Input
              placeholder="Personel ara..."
              value={search}
              onChangeText={setSearch}
            />
          ) : null}

          {filtered.length === 0 ? (
            <Text style={styles.empty}>Arama sonucu bulunamadı</Text>
          ) : (
            <ScrollView
              style={{ maxHeight: maxListHeight }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {filtered.map((person) => {
                const isSelected = selectedIds?.includes(person.id) ?? false;
                const row = (
                  <View style={styles.row}>
                    <Avatar name={getPersonnelFullName(person)} size={40} photoUri={person.photoUri} />
                    <View style={styles.info}>
                      <CardTitle>{getPersonnelFullName(person)}</CardTitle>
                      <CardSubtitle>
                        {person.sicilNo}
                        {person.title ? ` · ${person.title}` : ''}
                      </CardSubtitle>
                    </View>
                    {selectionMode ? (
                      <View style={[styles.check, isSelected && styles.checkActive]}>
                        <Text style={[styles.checkText, isSelected && styles.checkTextActive]}>
                          {isSelected ? '✓' : ''}
                        </Text>
                      </View>
                    ) : null}
                    {renderTrailing ? (
                      <View style={styles.trailing}>{renderTrailing(person)}</View>
                    ) : null}
                  </View>
                );

                if (selectionMode && onToggleSelect) {
                  return (
                    <Pressable key={person.id} onPress={() => onToggleSelect(person.id)}>
                      <Card
                        style={
                          isSelected
                            ? { ...styles.itemCard, ...styles.itemCardSelected }
                            : styles.itemCard
                        }
                        module={module}
                      >
                        {row}
                      </Card>
                    </Pressable>
                  );
                }

                if (onPressPersonnel) {
                  return (
                    <Pressable key={person.id} onPress={() => onPressPersonnel(person)}>
                      <Card style={styles.itemCard} module={module}>
                        {row}
                      </Card>
                    </Pressable>
                  );
                }

                return (
                  <Card key={person.id} style={styles.itemCard} module={module}>
                    {row}
                  </Card>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  headerRow: { gap: spacing.sm },
  headerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerPressed: { opacity: 0.94 },
  headerText: { flex: 1, gap: 2 },
  headerAction: { alignSelf: 'flex-start' },
  title: { ...typography.h3, color: colors.text },
  preview: { ...typography.bodySmall, color: colors.textMuted },
  toggleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  toggleText: { ...typography.caption, fontWeight: '700' },
  expandedBody: { gap: spacing.sm },
  itemCard: { marginBottom: spacing.xs },
  itemCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1 },
  trailing: { marginLeft: spacing.xs },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { ...typography.caption, color: colors.surface, fontWeight: '700' },
  checkTextActive: { color: colors.surface },
  empty: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic' },
});
