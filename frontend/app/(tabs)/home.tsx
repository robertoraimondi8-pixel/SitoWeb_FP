import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { HomeData, League } from '../../src/types/api';
import { goToPredictionsHub } from '../../src/utils/navigation';
import { SideMenu } from '../../src/components/SideMenu';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim1 = useState(new Animated.Value(30))[0];
  const slideAnim2 = useState(new Animated.Value(30))[0];
  const slideAnim3 = useState(new Animated.Value(30))[0];
  const fadeCard1 = useState(new Animated.Value(0))[0];
  const fadeCard2 = useState(new Animated.Value(0))[0];
  const fadeCard3 = useState(new Animated.Value(0))[0];

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
      // Stagger reveal animation
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.stagger(120, [
          Animated.parallel([
            Animated.timing(fadeCard1, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(slideAnim1, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(fadeCard2, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(slideAnim2, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(fadeCard3, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(slideAnim3, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
      ]).start();
      // Fetch unread notification count
      try {
        const nc = await apiCall<{ count: number }>('/notifications/unread-count', { token: authToken });
        setUnreadCount(nc.count);
      } catch {}
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
      {/* HEADER - Premium minimal */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.hamburgerBtn}
          onPress={() => setMenuOpen(true)}
          testID="hamburger-menu-btn"
        >
          <Ionicons name="menu" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <BrandLogo variant="wordmark" size="lg" />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/menu/notifications')}
            testID="notification-bell-btn"
          >
            <Ionicons name="notifications-outline" size={21} color={colors.primary} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge} testID="notification-badge">
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/league/list')}
          >
            <Ionicons name="people-outline" size={21} color={colors.primary} />
          </TouchableOpacity>
        </View>
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
        {/* ─── 1. MATCHDAY HERO CARD (Gradient Dark Blue) ─── */}
        {data?.league && (
          <Animated.View style={{ opacity: fadeCard1, transform: [{ translateY: slideAnim1 }] }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!data?.matchday) return;
              goToPredictionsHub(router, data.matchday.status, data.matchday.id, data.league?.id);
            }}
            disabled={!data?.matchday}
            testID="matchday-card"
          >
          <LinearGradient
            colors={['#1E3A7D', '#0F2352']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {data?.matchday ? (
              <>
                <View style={styles.heroHeader}>
                  <View style={styles.heroLabelRow}>
                    <Ionicons name="football" size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.heroLabel}>{t('home.matchday_label')}</Text>
                  </View>
                  <StatusBadge status={data.matchday.status} label={getStatusLabel(data.matchday.status)} />
                </View>

                <Text style={styles.heroTitle}>
                  {data.matchday.label || `Giornata ${data.matchday.number}`}
                </Text>

                {/* Match count + progress for OPEN */}
                {data.matchday.status?.toUpperCase() === 'OPEN' && (
                  <View style={styles.heroProgressWrap}>
                    <Text style={styles.heroSubInfo}>
                      {data.matchday.my_predictions_count}/{Math.min(data.matchday.total_matches || 0, 10)} pronostici inseriti
                    </Text>
                    <View style={styles.heroProgressBar}>
                      <View style={[styles.heroProgressFill, { 
                        width: `${Math.min(100, ((data.matchday.my_predictions_count || 0) / Math.max(1, Math.min(data.matchday.total_matches || 10, 10))) * 100)}%`
                      }]} />
                    </View>
                  </View>
                )}

                {/* COUNTDOWN TIMER */}
                {data.matchday.status?.toUpperCase() === 'OPEN' && countdown > 0 && (
                  <View style={styles.heroCountdown} data-testid="countdown-timer">
                    <Ionicons name="time-outline" size={20} color={colors.accent} />
                    <Text style={styles.heroCountdownText}>{formatCountdown(countdown)}</Text>
                  </View>
                )}

                {/* Dynamic micro-message */}
                {data.matchday.status?.toUpperCase() !== 'OPEN' && matchdayMsg !== '' && (
                  <Text style={styles.heroMessage}>{matchdayMsg}</Text>
                )}

                {/* CTA row */}
                <View style={styles.heroCta}>
                  <Text style={styles.heroCtaText}>{ctaConfig?.label ?? t('home.insert_predictions')}</Text>
                  <View style={styles.heroCtaArrow}>
                    <Ionicons name={(ctaConfig?.icon ?? 'create-outline') as any} size={18} color={colors.primary} />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyMatchdayState}>
                <Ionicons name="football-outline" size={40} color="rgba(255,255,255,0.4)" />
                <Text style={styles.emptyMatchdayTitle}>{t('home.no_matchday')}</Text>
                <Text style={styles.emptyMatchdaySubtitle}>Nessuna giornata in programma per ora</Text>
              </View>
            )}
          </LinearGradient>
          </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── CLASSIFICA LIVE (Premium) ─── */}
        {data?.matchday?.status?.toUpperCase() === 'LIVE' && (
          <Animated.View style={{ opacity: fadeCard1, transform: [{ translateY: slideAnim1 }] }}>
          <TouchableOpacity
            style={styles.liveBox}
            data-testid="live-standings-btn"
            activeOpacity={0.7}
            onPress={() => {
              router.push({
                pathname: '/(tabs)/rankings',
                params: { tab: 'weekly', matchdayId: data.matchday?.id, leagueId: data.league?.id }
              } as any);
            }}
          >
            <View style={styles.liveBoxLeft}>
              <View style={styles.liveBoxBadge}>
                <View style={styles.liveBoxDot} />
                <Text style={styles.liveBoxBadgeText}>LIVE</Text>
              </View>
              <Text style={styles.liveBoxTitle}>Classifica</Text>
            </View>
            <View style={styles.liveBoxRight}>
              <Text style={styles.liveBoxRankBig}>
                {data.live?.live_rank ? `${data.live.live_rank}°` : '-'}
              </Text>
              <Text style={styles.liveBoxPoints}>{formatPoints(data.live?.live_points ?? 0)} pts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.success} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── 2. PERFORMANCE CARD (Premium Grid) ─── */}
        {data?.user_summary && (
          <Animated.View style={{ opacity: fadeCard2, transform: [{ translateY: slideAnim2 }] }}>
          <View style={styles.perfCard} data-testid="performance-card">
            <Text style={styles.sectionLabel}>{t('home.performance')}</Text>

            {/* Stat grid: 2x2 */}
            <View style={styles.perfGrid}>
              <View style={[styles.perfGridItem, styles.perfGridItemHighlight]}>
                <View style={[styles.perfGridIcon, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name="trophy" size={18} color={colors.accent} />
                </View>
                <Text style={styles.perfGridValue}>
                  {data.user_summary.rank ? `${data.user_summary.rank}°` : '-'}
                </Text>
                <Text style={styles.perfGridLabel}>{t('home.current_position')}</Text>
              </View>

              <View style={styles.perfGridItem}>
                <View style={[styles.perfGridIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="star" size={18} color={colors.primary} />
                </View>
                <Text style={styles.perfGridValue}>{formatPoints(data.user_summary.total_points)}</Text>
                <Text style={styles.perfGridLabel}>{t('home.total_points')}</Text>
              </View>

              <View style={styles.perfGridItem}>
                <View style={[styles.perfGridIcon, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="football" size={18} color={colors.success} />
                </View>
                <Text style={styles.perfGridValue}>
                  {formatPoints(
                    (data.matchday?.my_predictions_count || 0) > 0
                      ? (data.matchday?.my_points ?? data.live?.total_provisional ?? 0)
                      : 0
                  )}
                </Text>
                <Text style={styles.perfGridLabel}>{t('home.matchday_points')}</Text>
              </View>

              <View style={styles.perfGridItem}>
                <View style={[styles.perfGridIcon, { backgroundColor: colors.info + '15' }]}>
                  <Ionicons name="trending-up" size={18} color={colors.info} />
                </View>
                <Text style={styles.perfGridValue}>{avg5 ?? '-'}</Text>
                <Text style={styles.perfGridLabel}>{t('home.avg_last_5')}</Text>
              </View>
            </View>
          </View>
          </Animated.View>
        )}

        {/* ─── 3. LAST 5 TREND (BAR CHART) ─── */}
        {Array.isArray(data?.last_5_performance) && data.last_5_performance.length > 0 && (
          <Animated.View style={{ opacity: fadeCard3, transform: [{ translateY: slideAnim3 }] }}>
          <SectionCard title={t('home.trend')}>
            <LastFiveIndicator
              data={data.last_5_performance}
              label={t('home.points_per_matchday')}
            />
          </SectionCard>
          </Animated.View>
        )}

      </Animated.ScrollView>

      {/* Side Menu */}
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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

  // ── Header ── Premium minimal
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
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
    boxShadow: '0 8px 12px rgba(0, 0, 0, 0.15)',
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

  // ── 1. Hero Matchday Card (Dark Blue Gradient) ──
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    elevation: 8,
    boxShadow: '0 8px 24px rgba(31, 58, 138, 0.25)',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  heroProgressWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroSubInfo: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  heroProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  heroCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  heroCountdownText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  heroMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
  },
  heroCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroCtaArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMatchdayState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyMatchdayTitle: {
    ...typography.titleM,
    color: colors.textSecondary,
  },
  emptyMatchdaySubtitle: {
    ...typography.bodyS,
    color: colors.textMuted,
    textAlign: 'center',
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

  // ── LIVE Box ──
  liveBox: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 2,
    borderColor: colors.success,
  },
  liveBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  liveBoxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.success,
  },
  liveBoxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveBoxBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveBoxTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.success,
    letterSpacing: -0.5,
  },
  liveBoxRank: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },
});
