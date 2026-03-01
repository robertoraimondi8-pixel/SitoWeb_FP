/**
 * FantaPronostic – BRAND COLOR SYSTEM UFFICIALE v5
 * Primary Blue (#1F4C8F) + Deep Blue (#162F5C) + Orange CTA (#F5A623)
 */

export const colors = {
  // 1️⃣ PRIMARY BRAND COLORS
  primary: '#1F4C8F',        // Logo Blue — card principali, elementi premium
  primaryLight: '#2C5FA8',   // Gradient top — parte alta gradienti
  primaryDark: '#162F5C',    // Deep Blue — parte bassa gradienti, hover, profondità
  
  accent: '#F5A623',         // Primary Orange — CTA, bottoni, punteggi
  accentDark: '#E18B00',     // Dark Orange — ombra bottoni, pressed
  accentLight: '#FEF3C7',    // Light accent — badge sfondo
  accentGlow: 'rgba(245, 166, 35, 0.25)',
  
  // 3️⃣ NEUTRAL SYSTEM
  background: '#F5F6F8',     // Warm Background — base app chiara
  backgroundBottom: '#ECEFF3', // Light Gradient Bottom
  card: '#FFFFFF',           // White Pure — testo su blu
  cardHighlight: '#F8FAFC',
  
  // Premium dark surfaces
  surfaceDark: '#162F5C',    // Deep Blue
  surfaceNavy: '#1F4C8F',   // Logo Blue
  surfaceNavyLight: '#2C5FA8', // Lighter blue
  
  // Borders & Separators
  border: '#E5E7EB',
  borderLight: '#F1F5F9',
  borderDark: 'rgba(255,255,255,0.08)',
  separator: '#E5E7EB',
  
  // 2️⃣ SUPPORT COLORS
  success: '#2ECC71',        // +1.0, check verde, LIVE indicator
  successLight: '#DCFCE7',
  error: '#E74C3C',          // Pronostico errato, alert, stato negativo
  errorLight: '#FEE2E2',
  warning: '#F5A623',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  
  // Text
  textPrimary: '#2C3E50',    // Primary Text Dark — testo su fondo chiaro
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',    // White Pure — testo su blu
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.6)',
  
  // Matchday status
  statusOpen: '#1D4ED8',
  statusLive: '#E74C3C',
  statusLocked: '#D97706',
  statusCompleted: '#64748B',
  
  // Status backgrounds (for badges)
  statusOpenBg: '#EFF6FF',
  statusLiveBg: '#FFFFFF',
  statusLockedBg: '#FFFBEB',
  statusCompletedBg: '#F1F5F9',
  
  // Podium / Rankings
  gold: '#F5A623',
  silver: '#94A3B8',
  bronze: '#CD7F32',
  
  // Tab bar
  tabBarBackground: '#162F5C',
  tabBarActive: '#F5A623',
  tabBarInactive: '#94A3B8',
  tabBarBorder: 'rgba(255,255,255,0.06)',
};

// 🎯 GRADIENTI UFFICIALI
export const brandGradients = {
  // Card Gradient Premium: colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
  cardPremium: ['#2C5FA8', '#1F4C8F', '#162F5C'] as const,
  // CTA Gradient: colors={['#F8B13A', '#F5A623', '#E18B00']}
  cta: ['#F8B13A', '#F5A623', '#E18B00'] as const,
  // Background App: colors={['#F5F6F8', '#ECEFF3']}
  background: ['#F5F6F8', '#ECEFF3'] as const,
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

// 📐 RADIUS SYSTEM UFFICIALE
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 18,     // Bottoni
  xl: 22,     // Card principali
  icon: 20,   // Cerchi icone
  badge: 12,  // Badge piccoli
  pill: 9999,
};

// React Native compatible shadows — natural and diffuse
export const shadows = {
  card: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardMd: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  cardLg: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  premium: {
    shadowColor: '#162F5C' as string,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  button: {
    shadowColor: '#F5A623' as string,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  glow: {
    shadowColor: '#F5A623' as string,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  tabBar: {
    shadowColor: '#000' as string,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
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
  brandGradients,
  typography,
  spacing,
  borderRadius,
  shadows,
  getStatusColor,
  getStatusBgColor,
  getPerformanceColor,
};
