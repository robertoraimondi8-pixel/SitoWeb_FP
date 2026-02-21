import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

// Design System
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { SectionCard, PrimaryButton } from '../../src/components/ui';

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
  const [ownedLeagues, setOwnedLeagues] = useState<OwnedLeague[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const p = await apiCall('/profile', { token });
        setLeagueCount(p.leagues_count);
        
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
      } catch (e: any) { 
        if (isAuthError(e)) {
          const didLogout = await handleAuthError(e);
          if (didLogout) router.replace('/(auth)/login');
          return;
        }
        console.error(e); 
      }
    })();
  }, [token, handleAuthError, router, user?.id]);

  const switchLang = () => {
    const newLang = i18n.language === 'it' ? 'en' : 'it';
    i18n.changeLanguage(newLang);
    apiCall('/profile', { method: 'PUT', token, body: { language: newLang } }).catch(() => {});
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profilo</Text>
          <View style={styles.accentLine} />
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
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
              <Text style={styles.statLabel}>{t('my_leagues')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.role === 'admin' ? 'Admin' : 'Player'}</Text>
              <Text style={styles.statLabel}>Ruolo</Text>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings')}</Text>

          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: isDark ? colors.accentLight : colors.infoLight }]}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? colors.accent : colors.info} />
            </View>
            <Text style={styles.settingLabel}>{isDark ? t('dark_mode') : t('light_mode')}</Text>
            <Switch 
              testID="theme-toggle" 
              value={isDark} 
              onValueChange={toggleTheme} 
              trackColor={{ false: colors.border, true: colors.accent }} 
              thumbColor={colors.textInverse} 
            />
          </View>

          <View style={styles.settingDivider} />

          <TouchableOpacity testID="lang-toggle-btn" style={styles.settingRow} onPress={switchLang}>
            <View style={[styles.settingIcon, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="language" size={18} color={colors.info} />
            </View>
            <Text style={styles.settingLabel}>{t('language')}</Text>
            <View style={styles.langChip}>
              <Text style={styles.langChipText}>{i18n.language.toUpperCase()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* League Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>LEGHE</Text>

          <TouchableOpacity testID="create-league-profile-btn" style={styles.settingRow} onPress={() => router.push('/league/create')}>
            <View style={[styles.settingIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.settingLabel}>{t('create_league')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity testID="join-league-profile-btn" style={styles.settingRow} onPress={() => router.push('/league/join')}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="enter-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.settingLabel}>{t('join_league')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Admin Console - per admin globale */}
        {user?.role === 'admin' && (
          <View style={styles.adminCard}>
            <Text style={styles.adminTitle}>ADMIN CONSOLE</Text>
            <Text style={styles.adminSubtitle}>Gestisci stagioni, giornate e partite</Text>
            
            <PrimaryButton
              title="Apri Console"
              icon="shield-checkmark"
              variant="secondary"
              onPress={() => router.push('/admin')}
              style={styles.adminButton}
            />
          </View>
        )}

        {/* Creator Console - per owner di leghe manuali */}
        {ownedLeagues.some(l => l.match_source_type === 'manual' || l.match_source_type === 'custom') && user?.role !== 'admin' && (
          <View style={styles.creatorCard}>
            <Text style={styles.creatorTitle}>GESTISCI LE MIE LEGHE</Text>
            <Text style={styles.creatorSubtitle}>Crea giornate e partite per le tue leghe</Text>
            <PrimaryButton
              title="Apri Console Admin"
              icon="settings"
              variant="secondary"
              onPress={() => router.push('/admin')}
              style={styles.adminButton}
            />
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
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
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
  
  // User Card
  userCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.card,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  username: { 
    ...typography.titleL,
    color: colors.textPrimary,
  },
  email: { 
    ...typography.bodyS,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  
  statsRow: { 
    flexDirection: 'row', 
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  statDivider: { 
    width: 1, 
    backgroundColor: colors.border,
  },
  
  // Section Card
  sectionCard: { 
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    ...shadows.card,
    overflow: 'hidden',
  },
  sectionTitle: { 
    ...typography.sectionLabel,
    color: colors.textSecondary,
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
    color: colors.textPrimary,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.xl + 36 + spacing.md,
  },
  
  langChip: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.xs, 
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
  },
  langChipText: { 
    ...typography.meta,
    color: colors.textInverse,
    fontWeight: '700',
  },
  
  // Admin Card
  adminCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    ...shadows.card,
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
    ...shadows.card,
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
  
  // Logout
  logoutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: spacing.sm, 
    paddingVertical: spacing.lg, 
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg, 
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  logoutText: { 
    ...typography.bodyM,
    color: colors.error,
    fontWeight: '600',
  },
  
  // Version
  version: {
    ...typography.metaSmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
