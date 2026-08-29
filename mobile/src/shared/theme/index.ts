export const colors = {
  primary: '#1E40AF',
  primaryDark: '#1E3A8A',
  primaryLight: '#3B82F6',
  primaryMuted: '#DBEAFE',
  accent: '#0D9488',
  accentLight: '#CCFBF1',
  background: '#F1F5F9',
  backgroundAlt: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  success: '#059669',
  successLight: '#D1FAE5',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  off: '#64748B',
  offLight: '#F1F5F9',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export type ModuleKey =
  | 'dashboard'
  | 'personnel'
  | 'units'
  | 'shifts'
  | 'assignments'
  | 'planning'
  | 'presence'
  | 'auth';

export const modules: Record<
  ModuleKey,
  { main: string; light: string; dark: string; label: string }
> = {
  dashboard: { main: '#1E40AF', light: '#DBEAFE', dark: '#1E3A8A', label: 'Ana Sayfa' },
  personnel: { main: '#6D28D9', light: '#EDE9FE', dark: '#5B21B6', label: 'Personel' },
  units: { main: '#0D9488', light: '#CCFBF1', dark: '#0F766E', label: 'Birimler' },
  shifts: { main: '#D97706', light: '#FEF3C7', dark: '#B45309', label: 'Vardiyalar' },
  assignments: { main: '#E11D48', light: '#FFE4E6', dark: '#BE123C', label: 'Görevler' },
  planning: { main: '#7C3AED', light: '#EDE9FE', dark: '#6D28D9', label: 'Planlama' },
  presence: { main: '#059669', light: '#D1FAE5', dark: '#047857', label: 'Kurumda' },
  auth: { main: '#1E40AF', light: '#DBEAFE', dark: '#1E3A8A', label: 'Giriş' },
};

export const avatarPalette = [
  '#1E40AF',
  '#6D28D9',
  '#0D9488',
  '#D97706',
  '#E11D48',
  '#7C3AED',
  '#059669',
  '#0891B2',
];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38, letterSpacing: -0.5 },
  h1: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  label: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  overline: {
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
};

export const touchTarget = 48;

export const headerStyle = {
  backgroundColor: colors.surface,
  borderBottomWidth: 1,
  borderBottomColor: colors.borderLight,
};

export const tabBarStyle = {
  backgroundColor: colors.surface,
  borderTopColor: colors.borderLight,
  borderTopWidth: 1,
  height: 60,
  paddingBottom: 8,
  paddingTop: 8,
};

export { shadows } from './shadows';
