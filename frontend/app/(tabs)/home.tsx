import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { HomeData, League, RankingsPreviewEntry, getErrorMessage } from '../../src/types/api';
import { goToPredictionsHub } from '../../src/utils/navigation';

// Design System
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { SectionCard, StatusBadge, PrimaryButton, LastFiveIndicator } from '../../src/components/ui';
import { BrandLogo } from '../../src/components/BrandLogo';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { token, user, handleAuthError } = useAuth();
  const { leagues, activeLeague, setActiveLeague, refreshLeagues } = useLeague();
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showLeagueSwitcher, setShowLeagueSwitcher] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (token) refreshLeagues(token);
  }, [token]);

  const fetchHome = useCallback(async (overrideLeagueId?: string) => {
    const authToken = token || await AsyncStorage.getItem('access_token');
    if (!authToken) { setLoading(false); return; }
    const leagueParam = overrideLeagueId || activeLeague?.id;
    try {
      const url = leagueParam ? `/home?league_id=${leagueParam}` : '/home';
      const res = await apiCall(url, { token: authToken });
      setData(res);
      if (res.matchday?.countdown_seconds) setCountdown(res.matchday.countdown_seconds);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e: unknown) {
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error('Home fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeLeague?.id, handleAuthError, router, fadeAnim]);

  // Re-fetch when activeLeague changes (e.g. from context)
  useEffect(() => {
    if (activeLeague?.id) {
      setData(null);
      setCountdown(0);
      setLoading(true);
      fetchHome(activeLeague.id);
    }
  }, [activeLeague?.id]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const formatPoints = (n: number | undefined | null) => {
    const num = typeof n === 'number' ? n : Number(n || 0);
    return num.toFixed(1);
  };

  const getStatusLabel = (status: string) => {
    return t(`status.${status?.toUpperCase()}`, { defaultValue: status });
  };

  const getCtaConfig = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
        return { icon: 'create-outline' as const, label: t('home.insert_predictions') };
      case 'LIVE':
        return { icon: 'pulse' as const, label: t('home.follow_live') };
      case 'COMPLETED':
        return { icon: 'checkmark-circle' as const, label: t('home.view_results') };
      default:
        return null;
    }
  };

  // Dynamic micro-message
  const getMatchdayMessage = () => {
    if (!data?.matchday) return '';
    const status = data.matchday.status?.toUpperCase();
    if (status === 'OPEN' && countdown > 0) {
      return `${t('home.closes_in')} ${formatCountdown(countdown)}`;
    }
    if (status === 'LIVE') {
      const pts = data.live?.total_provisional;
      if (pts != null) return `${t('home.in_progress')} · ${formatPoints(pts)} pts`;
      return t('home.in_progress');
    }
    if (status === 'COMPLETED') {
      const hasPredictions = (data.matchday.my_predictions_count || 0) > 0;
      if (hasPredictions) {
        const pts = data.matchday.my_points ?? data.live?.total_provisional;
        if (pts != null) return t('home.you_scored', { points: formatPoints(pts) });
      }
      return '';
    }
    if (status === 'OPEN') {
      return `${data.matchday.my_predictions_count}/${Math.min(data.matchday.total_matches || 0, 10)} ${t('predictions.matches_label', { defaultValue: 'partite' })}`;
    }
    return '';
  };

  // Average of last 5
  const getAvgLast5 = () => {
    const perf = data?.last_5_performance;
    if (!Array.isArray(perf) || perf.length === 0) return null;
    const sum = perf.reduce((acc: number, p: { points: number }) => acc + p.points, 0);
    return (sum / perf.length).toFixed(1);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const ctaConfig = data?.matchday ? getCtaConfig(data.matchday.status) : null;
  const matchdayMsg = getMatchdayMessage();
  const avg5 = getAvgLast5();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{t('home.greeting', { name: user?.username })}</Text>
          <View style={styles.logoSpacing}>
            <BrandLogo variant="wordmark" size="lg" />
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/league/list')}
        >
          <Ionicons name="people-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* LEAGUE SWITCHER */}
      {data?.league && (
        <View style={styles.leagueSwitcherWrap}>
          <TouchableOpacity
            style={styles.leagueSwitcherBtn}
            onPress={() => leagues.length > 1 ? setShowLeagueSwitcher(true) : null}
            activeOpacity={leagues.length > 1 ? 0.7 : 1}
          >
            <Ionicons name="trophy-outline" size={16} color={colors.accent} />
            <Text style={styles.leagueSwitcherText} numberOfLines={1}>{data.league.name}</Text>
            {leagues.length > 1 && (
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* LEAGUE SWITCHER DROPDOWN */}
      {showLeagueSwitcher && leagues.length > 0 && (
        <TouchableOpacity
          style={styles.switcherOverlay}
          activeOpacity={1}
          onPress={() => setShowLeagueSwitcher(false)}
        >
          <View style={styles.switcherDropdown}>
            <Text style={styles.switcherTitle}>{t('home.switch_league', { defaultValue: 'Cambia Lega' })}</Text>
            {leagues.map((lg: League) => (
              <TouchableOpacity
                key={lg.id}
                style={[styles.switcherItem, lg.id === activeLeague?.id && styles.switcherItemActive]}
                onPress={async () => {
                  setShowLeagueSwitcher(false);
                  // Reset state immediately to prevent stale data flash
                  setData(null);
                  setCountdown(0);
                  setLoading(true);
                  // Update global context (triggers re-fetch via useEffect)
                  setActiveLeague(lg);
                  // Persist on server
                  const authToken = token || await AsyncStorage.getItem('access_token');
                  if (authToken) {
                    apiCall(`/profile/current-league?league_id=${lg.id}`, { method: 'PATCH', token: authToken }).catch(() => {});
                  }
                }}
              >
                <Ionicons
                  name={lg.id === activeLeague?.id ? 'trophy' : 'trophy-outline'}
                  size={18}
                  color={lg.id === activeLeague?.id ? colors.accent : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switcherItemText, lg.id === activeLeague?.id && { color: colors.accent }]}>
                    {lg.name}
                  </Text>
                  <Text style={styles.switcherItemSub}>
                    {lg.league_type === 'national' ? 'Lega Nazionale' : `${lg.member_count ?? ''} membri`}
                  </Text>
                </View>
                {lg.id === activeLeague?.id && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchHome(); }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* ─── 1. MATCHDAY CARD ─── */}
        {data?.league && (
          <View style={styles.matchdayCard} data-testid="matchday-card">
            {data?.matchday ? (
              <>
                <View style={styles.matchdayHeader}>
                  <Text style={styles.sectionLabel}>{t('home.matchday_label')}</Text>
                  <StatusBadge status={data.matchday.status} label={getStatusLabel(data.matchday.status)} />
                </View>

                <Text style={styles.matchdayTitle}>
                  {data.matchday.label || `Giornata ${data.matchday.number}`}
                </Text>

                {/* Dynamic micro-message */}
                {matchdayMsg !== '' && (
                  <Text style={[
                    styles.matchdayMessage,
                    data.matchday.status?.toUpperCase() === 'COMPLETED' && styles.matchdayMessageHighlight,
                  ]}>
                    {matchdayMsg}
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.matchdayHeader}>
                <Text style={styles.sectionLabel}>{t('home.no_matchday')}</Text>
              </View>
            )}

            <PrimaryButton
              testID="matchday-cta-btn"
              title={ctaConfig?.label ?? t('home.insert_predictions')}
              icon={(ctaConfig?.icon ?? 'create-outline') as React.ComponentProps<typeof Ionicons>['name']}
              onPress={() => {
                if (!data?.matchday) return;
                goToPredictionsHub(router, data.matchday.status, data.matchday.id, data.league?.id);
              }}
              disabled={!data?.matchday}
              style={styles.ctaButton}
            />
          </View>
        )}

        {/* ─── 2. PERFORMANCE CARD ─── */}
        {data?.user_summary && (
          <View style={styles.perfCard} data-testid="performance-card">
            <Text style={styles.sectionLabel}>{t('home.performance')}</Text>

            {/* Position – hero element */}
            <View style={styles.perfPositionRow}>
              <Text style={styles.perfPositionValue}>
                {data.user_summary.rank ? `${data.user_summary.rank}°` : '-'}
              </Text>
              <Text style={styles.perfPositionLabel}>{t('home.current_position')}</Text>
            </View>

            <View style={styles.perfDivider} />

            {/* Stats row */}
            <View style={styles.perfStatsRow}>
              <View style={styles.perfStatItem}>
                <Text style={styles.perfStatValue}>{formatPoints(data.user_summary.total_points)}</Text>
                <Text style={styles.perfStatLabel}>{t('home.total_points')}</Text>
              </View>
              <View style={styles.perfStatSep} />
              <View style={styles.perfStatItem}>
                <Text style={styles.perfStatValue}>
                  {formatPoints(
                    (data.matchday?.my_predictions_count || 0) > 0
                      ? (data.matchday?.my_points ?? data.live?.total_provisional ?? 0)
                      : 0
                  )}
                </Text>
                <Text style={styles.perfStatLabel}>{t('home.matchday_points')}</Text>
              </View>
              <View style={styles.perfStatSep} />
              <View style={styles.perfStatItem}>
                <Text style={styles.perfStatValue}>{avg5 ?? '-'}</Text>
                <Text style={styles.perfStatLabel}>{t('home.avg_last_5')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── 3. LAST 5 TREND (BAR CHART) ─── */}
        {Array.isArray(data?.last_5_performance) && data.last_5_performance.length > 0 && (
          <SectionCard title={t('home.trend')}>
            <LastFiveIndicator
              data={data.last_5_performance}
              label={t('home.points_per_matchday')}
            />
          </SectionCard>
        )}

        {/* ─── 4. RANKINGS PREVIEW ─── */}
        {data?.rankings_preview && (
          <View style={styles.rankingsCard} data-testid="rankings-card">
            <View style={styles.rankingsHeader}>
              <Text style={styles.sectionLabel}>{t('home.rankings_section')}</Text>
              <TouchableOpacity
                style={styles.rankingsMore}
                onPress={() => router.push('/(tabs)/rankings')}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.leagueName}>{data.rankings_preview.league_name}</Text>

            {data.rankings_preview.top?.map((entry: RankingsPreviewEntry, i: number) => {
              const isCurrentUser = entry.user_id === user?.id;
              return (
                <View
                  key={entry.user_id || i}
                  style={[styles.rankRow, isCurrentUser && styles.rankRowHighlight]}
                >
                  {isCurrentUser && <View style={styles.rankRowAccent} />}
                  <Text style={[styles.rankPosition, i < 3 && styles.rankPositionTop3]}>
                    {entry.rank}
                  </Text>
                  <Text style={[styles.rankName, isCurrentUser && styles.rankNameBold]}>
                    {entry.username}
                  </Text>
                  <Text style={styles.rankPoints}>{formatPoints(entry.total_points)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flex: 1 },
  greeting: {
    ...typography.bodyS,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  logoSpacing: { marginTop: 0, marginBottom: 0 },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ── League Switcher ──
  leagueSwitcherWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  leagueSwitcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    backgroundColor: colors.accent + '10',
    maxWidth: 280,
  },
  leagueSwitcherText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  switcherOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
    justifyContent: 'flex-start',
    paddingTop: 130,
    paddingHorizontal: spacing.xl,
  },
  switcherDropdown: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  switcherTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switcherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  switcherItemActive: {
    backgroundColor: colors.accent + '15',
  },
  switcherItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switcherItemSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ── Scroll ──
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl + 32,
    gap: spacing.xl, // consistent gap between cards
  },

  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
  },

  // ── 1. Matchday Card ──
  matchdayCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
  matchdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  matchdayTitle: {
    ...typography.titleL,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  matchdayMessage: {
    ...typography.bodyS,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  matchdayMessageHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  ctaButton: {
    marginTop: spacing.sm,
  },

  // ── 2. Performance Card ──
  perfCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
  perfPositionRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  perfPositionValue: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 46,
  },
  perfPositionLabel: {
    ...typography.meta,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  perfDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  perfStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  perfStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  perfStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  perfStatLabel: {
    ...typography.metaSmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  perfStatSep: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },

  // ── 4. Rankings ──
  rankingsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
  rankingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rankingsMore: { padding: spacing.xs },
  leagueName: {
    ...typography.titleM,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  rankRowHighlight: {
    backgroundColor: colors.cardHighlight,
    marginLeft: -spacing.sm,
    marginRight: -spacing.sm,
    paddingLeft: spacing.lg,
  },
  rankRowAccent: {
    position: 'absolute',
    left: 0,
    top: spacing.xs,
    bottom: spacing.xs,
    width: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  rankPosition: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rankPositionTop3: {
    color: colors.primary,
  },
  rankName: {
    flex: 1,
    ...typography.bodyM,
    color: colors.textPrimary,
  },
  rankNameBold: { fontWeight: '700' },
  rankPoints: {
    ...typography.statMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
