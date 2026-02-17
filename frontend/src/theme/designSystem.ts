/**
 * FantaPronostic Premium Light Design System
 * Based on official logo colors: Blue (#1F3A8A) + Orange (#F59E0B)
 */

export const colors = {
  // Primary palette
  primary: '#1F3A8A',
  primaryLight: '#2563EB',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  
  // Backgrounds
  background: '#F8FAFC',
  card: '#FFFFFF',
  cardHighlight: '#EFF6FF',
  
  // Borders & Separators
  border: '#E5E7EB',
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
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  
  // Matchday status
  statusOpen: '#2563EB',
  statusLive: '#16A34A',
  statusLocked: '#F59E0B',
  statusCompleted: '#64748B',
};

export const typography = {
  // Titles
  titleXL: {
    fontSize: 26,
    fontWeight: '800' as const,
    lineHeight: 32,
  },
  titleL: {
    fontSize: 20,
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
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
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
    fontWeight: '500' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 50,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  button: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  getPerformanceColor,
};
