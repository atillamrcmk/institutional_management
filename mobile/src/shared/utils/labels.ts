import type { AbsenceType, AssignmentStatus } from '@/shared/types';

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  LEAVE: 'İzin',
  REPORT: 'Rapor',
  TRAINING: 'Eğitim',
  TEMPORARY_DUTY: 'Geçici Görev',
};

const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PLANNED: 'Planlandı',
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

export function getAbsenceTypeLabel(type: AbsenceType): string {
  return ABSENCE_LABELS[type];
}

export function getAssignmentStatusLabel(status: AssignmentStatus): string {
  return ASSIGNMENT_STATUS_LABELS[status];
}
