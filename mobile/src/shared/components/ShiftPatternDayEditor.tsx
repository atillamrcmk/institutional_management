import {
  PRESET_CYCLE_3_DAY,
  PRESET_CYCLE_4_DAY,
  PRESET_CYCLE_24H_MIXED,
  PRESET_CYCLE_MERKEZ,
  defaultTimesForShiftType,
} from '@/features/shifts/constants/shiftDefaults';
import type { ShiftType } from '@/shared/types';
import { getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import { Input } from './Input';
import { Button } from './Button';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography } from '@/shared/theme';

export interface PatternDayInput {
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
}

interface ShiftPatternDayEditorProps {
  days: PatternDayInput[];
  onChange: (days: PatternDayInput[]) => void;
}

const SHIFT_TYPES: ShiftType[] = ['DAY', 'NIGHT', 'FULL', 'OFF'];

export function ShiftPatternDayEditor({ days, onChange }: ShiftPatternDayEditorProps) {
  const updateDay = (index: number, patch: Partial<PatternDayInput>) => {
    onChange(days.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  };

  const updateShiftType = (index: number, shiftType: ShiftType) => {
    const times = defaultTimesForShiftType(shiftType);
    updateDay(index, { shiftType, ...times });
  };

  const removeDay = (index: number) => {
    onChange(days.filter((_, i) => i !== index));
  };

  const addDay = (type: ShiftType) => {
    onChange([...days, { shiftType: type, ...defaultTimesForShiftType(type) }]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Varsayılan: Gündüz 08:00–20:00, Gece 20:00–08:00, 24 Saat 08:00–08:00 (ertesi gün)
      </Text>
      <View style={styles.quickRow}>
        <Button title="3G Döngü" variant="outline" onPress={() => onChange([...PRESET_CYCLE_3_DAY])} />
        <Button title="4G Döngü" variant="outline" onPress={() => onChange([...PRESET_CYCLE_4_DAY])} />
        <Button
          title="Merkez (2G+2G+4İ)"
          variant="outline"
          onPress={() => onChange([...PRESET_CYCLE_MERKEZ])}
        />
        <Button
          title="24S (1+2İ+1+3İ)"
          variant="outline"
          onPress={() => onChange([...PRESET_CYCLE_24H_MIXED])}
        />
        {SHIFT_TYPES.map((type) => (
          <Pressable key={type} onPress={() => addDay(type)} style={styles.addChip}>
            <Text style={styles.addChipText}>+ {getShiftTypeLabel(type)}</Text>
          </Pressable>
        ))}
      </View>

      {days.map((day, index) => (
        <View key={index} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>
              Gün {index + 1}: {getShiftTypeLabel(day.shiftType)}
            </Text>
            <Pressable onPress={() => removeDay(index)}>
              <Text style={styles.remove}>Sil</Text>
            </Pressable>
          </View>
          <View style={styles.typeRow}>
            {SHIFT_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => updateShiftType(index, type)}
                style={[styles.typeChip, day.shiftType === type && styles.typeChipActive]}
              >
                <Text
                  style={[styles.typeChipText, day.shiftType === type && styles.typeChipTextActive]}
                >
                  {getShiftTypeLabel(type)}
                </Text>
              </Pressable>
            ))}
          </View>
          {day.shiftType !== 'OFF' ? (
            <View style={styles.timeRow}>
              <View style={styles.half}>
                <Input
                  label="Başlangıç"
                  value={day.startTime}
                  onChangeText={(v) => updateDay(index, { startTime: v })}
                  placeholder="08:00"
                />
              </View>
              <View style={styles.half}>
                <Input
                  label="Bitiş"
                  value={day.endTime}
                  onChangeText={(v) => updateDay(index, { endTime: v })}
                  placeholder="20:00"
                />
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  addChipText: { ...typography.bodySmall, color: colors.primary },
  dayCard: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitle: { ...typography.label, color: colors.text },
  remove: { ...typography.bodySmall, color: colors.danger },
  typeRow: { flexDirection: 'row', gap: spacing.xs },
  typeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  typeChipText: { ...typography.caption, color: colors.textSecondary },
  typeChipTextActive: { color: colors.primary, fontWeight: '700' },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
