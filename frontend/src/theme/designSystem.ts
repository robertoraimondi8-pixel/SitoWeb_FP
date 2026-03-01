/**
 * FantaPronostic Premium Sport Light Design System v2
 * Based on official logo colors: Blue (#1F3A8A) + Orange (#F59E0B)
 * Surface gray background + white cards for depth
 */

export const colors = {
  // Primary palette
  primary: '#1F3A8A',
  primaryLight: '#3B82F6',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  accentGlow: 'rgba(245, 158, 11, 0.25)',
  
  // Backgrounds - PREMIUM LIGHT (gray surface + white cards)
  background: '#F2F4F7',
  card: '#FFFFFF',
  cardHighlight: '#F8FAFC',
  
  // Borders & Separators
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  separator: '#E2E8F0',
  
  // Status colors
  success: '#16A34A',
  successLight: '#DCFCE7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  
  // Text
  textPrimary: '#111827',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  
  // Matchday status
  statusOpen: '#1D4ED8',
  statusLive: '#DC2626',
  statusLocked: '#D97706',
  statusCompleted: '#64748B',
  
  // Status backgrounds (for badges)
  statusOpenBg: '#EFF6FF',
  statusLiveBg: '#FEF2F2',
  statusLockedBg: '#FFFBEB',
  statusCompletedBg: '#F1F5F9',
  
  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#F59E0B',
  tabBarInactive: '#94A3B8',
  tabBarBorder: '#E2E8F0',
};

export const typography = {
  // Titles
  titleXL: {
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 34,
  },
  titleL: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
  titleM: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  
  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  
  // Numbers & Stats
  statLarge: {
    fontSize: 24,
    fontWeight: '800' as const,
  },
  statMedium: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  
  // Body text
  bodyL: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyM: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  bodyS: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  
  // Meta/Small
  meta: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  metaSmall: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
  pill: 9999,
};

// React Native compatible shadows (no boxShadow)
export const shadows = {
  card: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMd: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardLg: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  button: {
    shadowColor: '#F59E0B' as string,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  glow: {
    shadowColor: '#F59E0B' as string,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tabBar: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Helper to get status color
export const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'OPEN': return colors.statusOpen;
    case 'LIVE': return colors.statusLive;
    case 'LOCKED': return colors.statusLocked;
    case 'COMPLETED': return colors.statusCompleted;
    default: return colors.textSecondary;
  }
};

// Helper for status background
export const getStatusBgColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'OPEN': return colors.statusOpenBg;
    case 'LIVE': return colors.statusLiveBg;
    case 'LOCKED': return colors.statusLockedBg;
    case 'COMPLETED': return colors.statusCompletedBg;
    default: return colors.cardHighlight;
  }
};

// Helper for performance color (Last 5)
export const getPerformanceColor = (points: number) => {
  if (points >= 6) return colors.success;
  if (points > 0) return colors.warning;
  return colors.error;
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  getStatusColor,
  getStatusBgColor,
  getPerformanceColor,
};
