import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { setAppLanguage, SUPPORTED_LANGS } from '../../src/i18n';
import type { SupportedLang } from '../../src/i18n';

// Design System
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { SectionCard, AnimatedSweep } from '../../src/components/ui';

interface OwnedLeague {
  id: string;
  name: string;
  match_source_type: string;
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { user, token, logout, handleAuthError } = useAuth();
  const router = useRouter();
  const [leagueCount, setLeagueCount] = useState(0);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [ownedLeagues, setOwnedLeagues] = useState<OwnedLeague[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const p = await apiCall('/profile', { token });
        setLeagueCount(p.leagues_count);
        
        // Carica tornei iscritti
        const tournaments = await apiCall('/tournaments', { token }).catch(() => []);
        setTournamentCount(Array.isArray(tournaments) ? tournaments.filter((t: any) => t.is_registered).length : 0);
        
        // Carica le leghe possedute dall'utente (owner/admin)
        const homeData = await apiCall('/home', { token });
        const userLeagues = homeData.user_leagues || [];
        
        // Filtra solo le leghe dove l'utente è owner
        const owned: OwnedLeague[] = [];
        for (const league of userLeagues) {
          // Verifica se l'utente è owner di questa lega
          if (league.owner_id === user?.id || league.created_by === user?.id) {
            owned.push({
              id: league.id,
              name: league.name,
              match_source_type: league.match_source_type || 'national',
            });
          }
        }
        setOwnedLeagues(owned);
      } catch (e: unknown) { 
        if (isAuthError(e)) {
          const didLogout = await handleAuthError(e);
          if (didLogout) router.replace('/(auth)/login');
          return;
        }
      }
    })();
  }, [token, handleAuthError, router, user?.id]);

  const handleLangChange = async (lang: SupportedLang) => {
    await setAppLanguage(lang);
  };

  const handleLogout = async () => {
    // Navigate FIRST to unmount tab components, THEN clear state
    // This prevents crash from re-rendering tab screens with null auth
    router.replace('/(auth)/login');
    // Small delay to let navigation complete before clearing state
    setTimeout(async () => {
      await logout();
    }, 200);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#F5F6F8', '#ECEFF3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
          <View style={styles.accentLine} />
        </View>

        {/* User Card — Premium Dark */}
        <View style={styles.userCardOuter}>
          <LinearGradient
            colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userCard}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <AnimatedSweep />
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.username?.[0]?.toUpperCase()}
              </Text>
            </View>
            {user?.role === 'admin' && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color={colors.textInverse} />
              </View>
            )}
          </View>
          
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{leagueCount}</Text>
              <Text style={styles.statLabel}>{t('profile.my_leagues')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{tournamentCount}</Text>
              <Text style={styles.statLabel}>I miei tornei</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{user?.role === 'admin' ? t('profile.role_admin') : ownedLeagues.length > 0 ? t('profile.role_owner') : t('profile.role_player')}</Text>
              <Text style={styles.statLabel}>{t('profile.role')}</Text>
            </View>
          </View>
          </LinearGradient>
        </View>

        {/* Settings Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

          {/* Language Selector - 3 languages */}
          <View style={styles.langSection}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="language" size={18} color={colors.info} />
              </View>
              <Text style={styles.settingLabel}>{t('profile.language_section')}</Text>
            </View>
            <View style={styles.langOptions}>
              {SUPPORTED_LANGS.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  data-testid={`lang-${lang}-btn`}
                  style={[
                    styles.langOption,
                    i18n.language === lang && styles.langOptionActive,
                  ]}
                  onPress={() => handleLangChange(lang)}
                >
                  <Text style={[
                    styles.langOptionText,
                    i18n.language === lang && styles.langOptionTextActive,
                  ]}>
                    {t(`profile.lang_${lang}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* League Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('profile.my_leagues')}</Text>

          <TouchableOpacity testID="create-league-profile-btn" style={styles.settingRow} onPress={() => router.push('/league/create')} accessibilityLabel="Crea una lega" accessibilityRole="button">
            <View style={[styles.settingIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.settingLabel}>{t('profile.create_league')}</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity testID="join-league-profile-btn" style={styles.settingRow} onPress={() => router.push('/league/join')} accessibilityLabel="Entra in una lega" accessibilityRole="button">
            <View style={[styles.settingIcon, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="enter-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.settingLabel}>{t('profile.join_league')}</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {/* Admin Console - per admin globale */}
        {user?.role === 'admin' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('profile.admin_console_title')}</Text>
            <TouchableOpacity
              testID="admin-console-btn"
              style={styles.settingRow}
              onPress={() => router.push('/admin')}
            >
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(31,58,138,0.1)' }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              </View>
              <Text style={styles.settingLabel}>{t('profile.admin_console_btn', { defaultValue: 'Apri Console Admin' })}</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Creator Console - per owner di leghe manuali */}
        {ownedLeagues.some(l => l.match_source_type === 'manual' || l.match_source_type === 'custom') && user?.role !== 'admin' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('profile.creator_console_title')}</Text>
            <TouchableOpacity
              testID="creator-console-btn"
              style={styles.settingRow}
              onPress={() => router.push('/admin')}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="settings" size={18} color={colors.accent} />
              </View>
              <Text style={styles.settingLabel}>{t('profile.creator_console_btn', { defaultValue: 'Gestisci le tue leghe' })}</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Logout - tono secondario, non prominente */}
        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout} accessibilityLabel="Esci dall'account" accessibilityRole="button">
          <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.4)" />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>FantaPronostic v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  scrollContent: { 
    paddingBottom: spacing.xxxl,
  },
  
  // Header
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    ...typography.titleL,
    color: colors.textPrimary,
  },
  accentLine: {
    width: 32,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
    borderRadius: 2,
  },
  
  // User Card — Premium Dark
  userCardOuter: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  userCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: colors.accent,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  avatarText: { 
    fontSize: 32, 
    fontWeight: '800',
    color: colors.textInverse,
  },
  adminBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2C5FA8',
  },
  username: { 
    ...typography.titleL,
    color: '#FFFFFF',
  },
  email: { 
    ...typography.bodyS,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
  },
  
  statsRow: { 
    flexDirection: 'row', 
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  statItem: { 
    flex: 1, 
    alignItems: 'center',
  },
  statValue: { 
    ...typography.statLarge,
    color: colors.accent,
  },
  statLabel: { 
    ...typography.metaSmall,
    color: 'rgba(255,255,255,0.5)',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  statDivider: { 
    width: 1, 
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  
  // Section Card
  sectionCard: { 
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    overflow: 'hidden',
  },
  sectionTitle: { 
    ...typography.sectionLabel,
    color: colors.accent,
    paddingHorizontal: spacing.xl, 
    paddingTop: spacing.lg, 
    paddingBottom: spacing.sm,
  },
  
  settingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.md, 
    gap: spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { 
    flex: 1, 
    ...typography.bodyM,
    color: '#FFFFFF',
  },
  settingDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: spacing.xl + 36 + spacing.md,
  },
  
  langSection: {
    marginTop: spacing.sm,
  },
  langOptions: {
    flexDirection: 'row' as const,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  langOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center' as const,
  },
  langOptionActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  langOptionText: {
    ...typography.bodyM,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600' as const,
  },
  langOptionTextActive: {
    color: colors.textInverse,
  },
  
  // Admin Card
  adminCard: {
    backgroundColor: '#1F4C8F',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
  adminTitle: {
    ...typography.sectionLabel,
    color: 'rgba(255,255,255,0.7)',
  },
  adminSubtitle: {
    ...typography.bodyM,
    color: colors.textInverse,
    marginTop: spacing.sm,
  },
  adminButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.textInverse,
  },
  
  // Creator Card (per owner di leghe)
  creatorCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  creatorTitle: {
    ...typography.sectionLabel,
    color: colors.accent,
  },
  creatorSubtitle: {
    ...typography.bodyS,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  leagueRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  leagueRowName: {
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  leagueRowType: {
    ...typography.metaSmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  
  // Logout - tono secondario
  logoutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: spacing.sm, 
    paddingVertical: spacing.md, 
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  logoutText: { 
    ...typography.bodyS,
    color: colors.textMuted,
  },
  
  // Version
  version: {
    ...typography.metaSmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
