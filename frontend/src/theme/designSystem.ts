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
  
  // Backgrounds - PREMIUM LIGHT
  background: '#F8FAFC',
  card: '#FFFFFF',
  cardHighlight: '#EFF6FF',
  
  // Borders & Separators
  border: '#E6ECF5',
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
  statusLive: '#DC2626',
  statusLocked: '#F59E0B',
  statusCompleted: '#94A3B8', // Lighter grey for COMPLETED badge
  
  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#F59E0B',
  tabBarInactive: '#94A3B8',
  tabBarBorder: '#E6ECF5',
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
    letterSpacing: 1.4, // Increased tracking
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

// PREMIUM iOS-style shadows
export const shadows = {
  card: {
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.04)',
    elevation: 3,
  },
  cardHover: {
    boxShadow: '0 6px 14px rgba(0, 0, 0, 0.08)',
    elevation: 5,
  },
  button: {
    boxShadow: '0 3px 6px rgba(245, 158, 11, 0.25)',
    elevation: 4,
  },
  tabBar: {
    boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.03)',
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
