export interface ColorTheme {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceElevated: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderSubtle: string;
  card: string;
  cardShadow: string;
  danger: string;
  success: string;
  badgeBg: string;
  badgeText: string;
  iconColor: string;
  splashBackground: string;
}

export const darkTheme: ColorTheme = {
  isDark: true,
  background: '#0B0D13',
  surface: '#141824',
  surfaceSubtle: '#1C2233',
  surfaceElevated: '#242C42',
  primary: '#6366F1', // Indigo
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  accent: '#EC4899', // Pink / Coral accent
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  border: '#1E293B',
  borderSubtle: '#334155',
  card: '#141824',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
  danger: '#EF4444',
  success: '#10B981',
  badgeBg: 'rgba(99, 102, 241, 0.15)',
  badgeText: '#A5B4FC',
  iconColor: '#E2E8F0',
  splashBackground: '#0B0D13',
};

export const lightTheme: ColorTheme = {
  isDark: false,
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  surfaceElevated: '#E2E8F0',
  primary: '#4F46E5', // Indigo
  primaryLight: '#6366F1',
  primaryDark: '#4338CA',
  accent: '#DB2777',
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#94A3B8',
  border: '#E2E8F0',
  borderSubtle: '#CBD5E1',
  card: '#FFFFFF',
  cardShadow: 'rgba(15, 23, 42, 0.08)',
  danger: '#DC2626',
  success: '#059669',
  badgeBg: 'rgba(79, 70, 229, 0.1)',
  badgeText: '#4F46E5',
  iconColor: '#334155',
  splashBackground: '#0F172A',
};
