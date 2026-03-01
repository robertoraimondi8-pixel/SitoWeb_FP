/**
 * FantaPronostic — Theme Colors for ThemeContext
 * Aligned with Brand Color System v5
 */
export const Colors = {
  dark: {
    primary: '#1F4C8F',
    primaryLight: '#2C5FA8',
    primaryDark: '#162F5C',
    accent: '#F5A623',
    accentGlow: 'rgba(245, 166, 35, 0.5)',
    accentMuted: '#E18B00',
    accentLight: 'rgba(245, 166, 35, 0.15)',
    background: '#162F5C',
    card: '#1F4C8F',
    text: '#FFFFFF',
    textSecondary: '#94A3B8',
    border: 'rgba(255,255,255,0.1)',
    success: '#2ECC71',
    successLight: 'rgba(46,204,113,0.15)',
    error: '#E74C3C',
    errorLight: 'rgba(231,76,60,0.15)',
    warning: '#F5A623',
    info: '#2563EB',
    infoLight: 'rgba(37,99,235,0.15)',
  },
  light: {
    primary: '#1F4C8F',
    primaryLight: '#2C5FA8',
    primaryDark: '#162F5C',
    accent: '#F5A623',
    accentGlow: 'rgba(245, 166, 35, 0.2)',
    accentMuted: '#E18B00',
    accentLight: '#FEF3C7',
    background: '#F5F6F8',
    card: '#FFFFFF',
    text: '#2C3E50',
    textSecondary: '#64748B',
    border: '#E5E7EB',
    success: '#2ECC71',
    successLight: '#DCFCE7',
    error: '#E74C3C',
    errorLight: '#FEE2E2',
    warning: '#F5A623',
    info: '#2563EB',
    infoLight: '#DBEAFE',
  },
};

export type ThemeColors = typeof Colors.dark;
