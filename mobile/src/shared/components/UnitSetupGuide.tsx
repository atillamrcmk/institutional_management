import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { UnitSetupStatus } from '@/features/shifts/services/unitSetupService';
import { colors, modules, radius, spacing, typography } from '@/shared/theme';

interface Step {
  number: number;
  title: string;
  description: string;
  done: boolean;
  optional?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface UnitSetupGuideProps {
  status: UnitSetupStatus;
  onCreateShifts: () => void;
  onAddPersonnel: () => void;
  onAssignShifts: () => void;
}

export function UnitSetupGuide({
  status,
  onCreateShifts,
  onAddPersonnel,
  onAssignShifts,
}: UnitSetupGuideProps) {
  const isOffice = status.workScheduleType === 'OFFICE';

  if (status.isComplete) {
    return (
      <View style={styles.completeBox}>
        <Text style={styles.completeTitle}>Kurulum tamamlandı</Text>
        <Text style={styles.completeText}>
          {isOffice
            ? `Mesai birimi · ${status.personnelCount} personel`
            : `${status.shiftCount} vardiya · ${status.personnelCount} personel`}
        </Text>
      </View>
    );
  }

  const steps: Step[] = [
    {
      number: 1,
      title: 'Birim oluşturuldu',
      description: isOffice ? 'Mesai birimi (vardiya gerekmez)' : 'Vardiyalı birim',
      done: true,
    },
    {
      number: 2,
      title: 'Personel ekle',
      description: status.hasPersonnel
        ? `${status.personnelCount} personel birimde`
        : 'Birime personel atayın',
      done: status.hasPersonnel,
      actionLabel: status.hasPersonnel ? undefined : 'Personel Ekle',
      onAction: status.hasPersonnel ? undefined : onAddPersonnel,
    },
  ];

  if (!isOffice) {
    steps.push({
      number: 3,
      title: 'Vardiyaları oluştur',
      description: status.hasShifts
        ? `${status.shiftCount} vardiya tanımlı`
        : 'İsteğe bağlı — vardiyalı personel için',
      done: status.hasShifts,
      optional: !status.hasShifts,
      actionLabel: status.hasShifts ? undefined : 'Vardiya Kur',
      onAction: status.hasShifts ? undefined : onCreateShifts,
    });

    if (status.hasShifts) {
      steps.push({
        number: 4,
        title: 'Personeli vardiyalara ata',
        description: status.allShiftsHavePersonnel
          ? 'Tüm vardiyalarda personel var'
          : `${status.shiftsWithPersonnel}/${status.shiftCount} vardiyada personel var`,
        done: status.allShiftsHavePersonnel,
        actionLabel: status.hasPersonnel ? 'Ata' : undefined,
        onAction: status.hasPersonnel ? onAssignShifts : undefined,
      });
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Kurulum Adımları</Text>
      {steps.map((step) => (
        <View key={step.number} style={styles.stepRow}>
          <View style={[styles.badge, step.done && styles.badgeDone]}>
            <Text style={[styles.badgeText, step.done && styles.badgeTextDone]}>
              {step.done ? '✓' : step.number}
            </Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={[styles.stepTitle, step.done && styles.stepTitleDone]}>
              {step.title}
              {step.optional ? ' (opsiyonel)' : ''}
            </Text>
            <Text style={styles.stepDesc}>{step.description}</Text>
            {step.actionLabel && step.onAction ? (
              <Pressable onPress={step.onAction} style={styles.actionBtn}>
                <Text style={styles.actionText}>{step.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: modules.units.light,
    borderWidth: 1,
    borderColor: modules.units.main,
    gap: spacing.md,
  },
  header: { ...typography.h3, color: colors.text },
  stepRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: colors.success, borderColor: colors.success },
  badgeText: { ...typography.caption, fontWeight: '700', color: colors.textMuted },
  badgeTextDone: { color: colors.surface },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  stepTitleDone: { color: colors.textSecondary },
  stepDesc: { ...typography.bodySmall, color: colors.textMuted },
  actionBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: modules.units.main,
  },
  actionText: { ...typography.caption, color: colors.surface, fontWeight: '700' },
  completeBox: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.successLight ?? '#ECFDF5',
    borderWidth: 1,
    borderColor: colors.success,
    gap: spacing.xs,
  },
  completeTitle: { ...typography.h3, color: colors.success },
  completeText: { ...typography.bodySmall, color: colors.textSecondary },
});
