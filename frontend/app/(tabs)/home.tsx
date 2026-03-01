import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Animated, Easing, Pressable } from 'react-native';
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

import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { StatusBadge, LastFiveIndicator } from '../../src/components/ui';
import { BrandLogo } from '../../src/components/BrandLogo';

// ── Color constants ──
const DARK = {
  navy: '#14263D',
  navyDeep: '#0E1A2B',
  accent: '#F5A623',
  accentGrad: '#F59E0B',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  textSub: 'rgba(255,255,255,0.75)',
  border: 'rgba(255,255,255,0.08)',
};
const LIGHT = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  headerBg: '#FFFFFF',
  text: '#111827',
  textSec: '#64748B',
  textMuted: '#94A3B8',
  border: '#E5E7EB',
  green: '#16A34A',
};

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

  // Animations
  const fadeScreen = useRef(new Animated.Value(0)).current;
  const slideHero = useRef(new Animated.Value(24)).current;
  const fadeHero = useRef(new Animated.Value(0)).current;
  const slideLive = useRef(new Animated.Value(24)).current;
  const fadeLive = useRef(new Animated.Value(0)).current;
  const slidePerf = useRef(new Animated.Value(24)).current;
  const fadePerf = useRef(new Animated.Value(0)).current;
  const slideTrend = useRef(new Animated.Value(24)).current;
  const fadeTrend = useRef(new Animated.Value(0)).current;
  // CTA press animation
  const ctaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (token) refreshLeagues(token);
  }, [token]);

  const runEntryAnimation = () => {
    // Reset
    fadeScreen.setValue(0);
    slideHero.setValue(24); fadeHero.setValue(0);
    slideLive.setValue(24); fadeLive.setValue(0);
    slidePerf.setValue(24); fadePerf.setValue(0);
    slideTrend.setValue(24); fadeTrend.setValue(0);

    Animated.parallel([
      Animated.timing(fadeScreen, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.stagger(100, [
        Animated.parallel([
          Animated.timing(fadeHero, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slideHero, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(fadeLive, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slideLive, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(fadePerf, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slidePerf, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(fadeTrend, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slideTrend, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  };

  const fetchHome = useCallback(async (overrideLeagueId?: string) => {
    const authToken = token || await AsyncStorage.getItem('access_token');
    if (!authToken) { setLoading(false); return; }
    const leagueParam = overrideLeagueId || activeLeague?.id;
    try {
      const url = leagueParam ? `/home?league_id=${leagueParam}` : '/home';
      const res = await apiCall(url, { token: authToken });
      setData(res);
      if (res.matchday?.countdown_seconds) setCountdown(res.matchday.countdown_seconds);
      runEntryAnimation();
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
      console.error('Home fetch error:', (e as any).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeLeague?.id, handleAuthError, router]);

  useEffect(() => {
    if (activeLeague?.id) {
      setData(null); setCountdown(0); setLoading(true);
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

  const getStatusLabel = (status: string) => t(`status.${status?.toUpperCase()}`, { defaultValue: status });

  const getCtaConfig = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN': return { icon: 'create-outline' as const, label: t('home.insert_predictions') };
      case 'LIVE': return { icon: 'pulse' as const, label: t('home.follow_live') };
      case 'COMPLETED': return { icon: 'checkmark-circle' as const, label: t('home.view_results') };
      default: return null;
    }
  };

  const getMatchdayMessage = () => {
    if (!data?.matchday) return '';
    const status = data.matchday.status?.toUpperCase();
    const totalMatches = Math.min(data.matchday.total_matches || 0, 10);
    if (status === 'OPEN' && countdown > 0) {
      return `${totalMatches} partite \u00B7 Scadenza tra ${formatCountdown(countdown)}`;
    }
    if (status === 'OPEN') {
      return `${data.matchday.my_predictions_count}/${totalMatches} partite`;
    }
    if (status === 'LIVE') {
      const pts = data.live?.total_provisional;
      if (pts != null) return `${t('home.in_progress')} \u00B7 ${formatPoints(pts)} pts`;
      return t('home.in_progress');
    }
    if (status === 'COMPLETED') {
      const hasPredictions = (data.matchday.my_predictions_count || 0) > 0;
      if (hasPredictions) {
        const pts = data.matchday.my_points ?? data.live?.total_provisional;
        if (pts != null) return t('home.you_scored', { points: formatPoints(pts) });
      }
    }
    return '';
  };

  const getAvgLast5 = () => {
    const perf = data?.last_5_performance;
    if (!Array.isArray(perf) || perf.length === 0) return null;
    const sum = perf.reduce((acc: number, p: { points: number }) => acc + p.points, 0);
    return (sum / perf.length).toFixed(1);
  };

  // CTA press handlers
  const onCtaPressIn = () => { Animated.spring(ctaScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); };
  const onCtaPressOut = () => { Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); };

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={DARK.accent} />
      </View>
    );
  }

  const ctaConfig = data?.matchday ? getCtaConfig(data.matchday.status) : null;
  const matchdayMsg = getMatchdayMessage();
  const avg5 = getAvgLast5();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* ═══ GRADIENT BACKGROUND (premium ambient) ═══ */}
      <LinearGradient
        colors={['#F5F6F8', '#ECEFF3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient light overlay */}
      <View style={s.ambientOverlay} />
      {/* ═══ HEADER (light premium) ═══ */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerIcon} onPress={() => setMenuOpen(true)} testID="hamburger-menu-btn">
          <Ionicons name="menu" size={24} color={LIGHT.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <BrandLogo variant="wordmark" size="lg" />
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerIcon} onPress={() => router.push('/menu/notifications')} testID="notification-bell-btn">
            <Ionicons name="notifications-outline" size={22} color={LIGHT.text} />
            {unreadCount > 0 && (
              <View style={s.bellBadge} testID="notification-badge">
                <Text style={s.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIcon} onPress={() => router.push('/league/list')}>
            <Ionicons name="people-outline" size={22} color={LIGHT.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ LEAGUE SWITCHER (white pill on dark) ═══ */}
      {data?.league && (
        <View style={s.leagueWrap}>
          <TouchableOpacity
            style={s.leagueBtn}
            onPress={() => leagues.length > 1 ? setShowLeagueSwitcher(true) : null}
            activeOpacity={leagues.length > 1 ? 0.7 : 1}
          >
            <Ionicons name="trophy-outline" size={15} color={DARK.accent} />
            <Text style={s.leagueText} numberOfLines={1}>{data.league.name}</Text>
            {leagues.length > 1 && <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>
      )}

      {/* League Switcher Dropdown */}
      {showLeagueSwitcher && leagues.length > 0 && (
        <TouchableOpacity style={s.switcherOverlay} activeOpacity={1} onPress={() => setShowLeagueSwitcher(false)}>
          <View style={s.switcherDropdown}>
            <Text style={s.switcherTitle}>{t('home.switch_league', { defaultValue: 'Cambia Lega' })}</Text>
            {leagues.map((lg: League) => (
              <TouchableOpacity
                key={lg.id}
                style={[s.switcherItem, lg.id === activeLeague?.id && s.switcherItemActive]}
                onPress={async () => {
                  setShowLeagueSwitcher(false);
                  setData(null); setCountdown(0); setLoading(true);
                  setActiveLeague(lg);
                  const authToken = token || await AsyncStorage.getItem('access_token');
                  if (authToken) apiCall(`/profile/current-league?league_id=${lg.id}`, { method: 'PATCH', token: authToken }).catch(() => {});
                }}
              >
                <Ionicons name={lg.id === activeLeague?.id ? 'trophy' : 'trophy-outline'} size={18} color={lg.id === activeLeague?.id ? DARK.accent : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.switcherItemText, lg.id === activeLeague?.id && { color: DARK.accent }]}>{lg.name}</Text>
                  <Text style={s.switcherItemSub}>{lg.league_type === 'national' ? 'Lega Nazionale' : `${lg.member_count ?? ''} membri`}</Text>
                </View>
                {lg.id === activeLeague?.id && <Ionicons name="checkmark" size={16} color={DARK.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* ═══ SCROLL CONTENT ═══ */}
      <Animated.ScrollView
        style={{ opacity: fadeScreen }}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHome(); }} tintColor={DARK.accent} colors={[DARK.accent]} />
        }
      >
        {/* ─── 1. HERO MATCHDAY CARD ─── */}
        {data?.league && (
          <Animated.View style={{ opacity: fadeHero, transform: [{ translateY: slideHero }] }}>
            <Pressable
              onPressIn={onCtaPressIn}
              onPressOut={onCtaPressOut}
              onPress={() => {
                if (!data?.matchday) return;
                goToPredictionsHub(router, data.matchday.status, data.matchday.id, data.league?.id);
              }}
              disabled={!data?.matchday}
              testID="matchday-card"
            >
              <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
                <LinearGradient
                  colors={['#10223A', '#0B1625']}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={s.heroCard}
                >
                  {data?.matchday ? (
                    <>
                      <View style={s.heroTop}>
                        <View style={s.heroLabelRow}>
                          <Ionicons name="football" size={13} color={DARK.textMuted} />
                          <Text style={s.heroLabel}>GIORNATA</Text>
                        </View>
                        <StatusBadge status={data.matchday.status} label={getStatusLabel(data.matchday.status)} />
                      </View>

                      <Text style={s.heroTitle}>
                        {data.matchday.label || `Giornata ${data.matchday.number}`}
                      </Text>

                      {matchdayMsg !== '' && (
                        <Text style={s.heroSub}>{matchdayMsg}</Text>
                      )}

                      {/* CTA Button — orange gradient + dark icon circle */}
                      {ctaConfig && (
                        <LinearGradient
                          colors={['#F5A623', '#F59E0B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={s.ctaBtn}
                        >
                          <Text style={s.ctaText}>{ctaConfig.label}</Text>
                          <View style={s.ctaIconCircle}>
                            <Ionicons name={ctaConfig.icon} size={18} color="#FFFFFF" />
                          </View>
                        </LinearGradient>
                      )}
                    </>
                  ) : (
                    <View style={s.emptyHero}>
                      <Ionicons name="football-outline" size={40} color={DARK.textMuted} />
                      <Text style={s.emptyHeroTitle}>{t('home.no_matchday')}</Text>
                      <Text style={s.emptyHeroSub}>Nessuna giornata in programma</Text>
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </Animated.View>
        )}

        {/* ─── 2. CLASSIFICA LIVE ─── */}
        {data?.matchday?.status?.toUpperCase() === 'LIVE' && (
          <Animated.View style={{ opacity: fadeLive, transform: [{ translateY: slideLive }] }}>
            <TouchableOpacity
              style={s.liveCard}
              activeOpacity={0.7}
              data-testid="live-standings-btn"
              onPress={() => {
                router.push({ pathname: '/(tabs)/rankings', params: { tab: 'weekly', matchdayId: data.matchday?.id, leagueId: data.league?.id } } as any);
              }}
            >
              <View style={s.liveLeft}>
                <View style={s.liveBadge}>
                  <View style={s.liveDot} />
                  <Text style={s.liveBadgeText}>LIVE</Text>
                </View>
                <Text style={s.liveTitle}>Classifica</Text>
              </View>
              <View style={s.liveRight}>
                <Text style={s.liveRank}>{data.live?.live_rank ? `${data.live.live_rank}\u00B0` : '-'}</Text>
                <Text style={s.livePoints}>{formatPoints(data.live?.live_points ?? 0)} pts</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.success} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── 3. PERFORMANCE (premium gradient cards) ─── */}
        {data?.user_summary && (
          <Animated.View style={{ opacity: fadePerf, transform: [{ translateY: slidePerf }] }}>
            <Text style={s.sectionLabel}>PERFORMANCE</Text>
            <View style={s.perfRow}>
              {/* Position */}
              <View style={s.perfCardOuter}>
                <LinearGradient
                  colors={['#1E3553', '#13263F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.perfCardGrad}
                >
                  {/* Inset highlight */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.08)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.perfInset}
                  />
                  <View style={s.perfIconWrap}>
                    <Ionicons name="trophy" size={20} color={DARK.accent} />
                  </View>
                  <Text style={s.perfValue}>{data.user_summary.rank ? `${data.user_summary.rank}\u00B0` : '-'}</Text>
                  <Text style={s.perfLabel}>POSIZIONE{'\n'}ATTUALE</Text>
                </LinearGradient>
              </View>
              {/* Total Points */}
              <View style={s.perfCardOuter}>
                <LinearGradient
                  colors={['#1E3553', '#13263F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.perfCardGrad}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.08)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.perfInset}
                  />
                  <View style={s.perfIconWrap}>
                    <Ionicons name="star" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={s.perfValue}>{formatPoints(data.user_summary.total_points)}</Text>
                  <Text style={s.perfLabel}>PUNTI{'\n'}TOTALI</Text>
                </LinearGradient>
              </View>
              {/* Avg Last 5 */}
              <View style={s.perfCardOuter}>
                <LinearGradient
                  colors={['#1E3553', '#13263F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.perfCardGrad}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.08)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.perfInset}
                  />
                  <View style={s.perfIconWrap}>
                    <Ionicons name="football" size={20} color={LIGHT.green} />
                  </View>
                  <Text style={s.perfValue}>{avg5 ?? '-'}</Text>
                  <Text style={s.perfLabel}>MEDIA{'\n'}ULTIME 5</Text>
                </LinearGradient>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ─── 4. TREND ─── */}
        {Array.isArray(data?.last_5_performance) && data.last_5_performance.length > 0 && (
          <Animated.View style={{ opacity: fadeTrend, transform: [{ translateY: slideTrend }] }}>
            <View style={s.trendCard}>
              <Text style={s.sectionLabelInCard}>{t('home.trend')}</Text>
              <LastFiveIndicator data={data.last_5_performance} label={t('home.points_per_matchday')} />
            </View>
          </Animated.View>
        )}
      </Animated.ScrollView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════
// STYLES — Premium Balanced (Light BG + Dark Hero)
// ═══════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  ambientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    opacity: 0.04,
  },

  // ── Header (light) ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: LIGHT.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT.border,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DARK.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // ── League Switcher (white pill with border) ──
  leagueWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: LIGHT.headerBg,
    alignItems: 'center',
  },
  leagueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: LIGHT.card,
    borderWidth: 1,
    borderColor: LIGHT.border,
    maxWidth: 320,
  },
  leagueText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT.text,
  },

  // ── Switcher overlay ──
  switcherOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
    justifyContent: 'flex-start',
    paddingTop: 120,
    paddingHorizontal: 24,
  },
  switcherDropdown: {
    backgroundColor: LIGHT.card,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  switcherTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: LIGHT.textSec,
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
    borderRadius: 12,
  },
  switcherItemActive: { backgroundColor: DARK.accent + '12' },
  switcherItemText: { fontSize: 14, fontWeight: '600', color: LIGHT.text },
  switcherItemSub: { fontSize: 11, color: LIGHT.textSec, marginTop: 2 },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
    gap: 24,
  },

  // ── 1. Hero Card (dark navy gradient) ──
  heroCard: {
    borderRadius: 22,
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#0E1A2B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK.textMuted,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: DARK.text,
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '400',
    color: DARK.textSub,
    marginBottom: 16,
  },

  // CTA Button (orange gradient + dark icon circle)
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingLeft: 24,
    paddingRight: 8,
    borderRadius: 22,
    marginTop: 8,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  ctaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DARK.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty hero
  emptyHero: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyHeroTitle: { fontSize: 18, fontWeight: '700', color: DARK.textSub },
  emptyHeroSub: { fontSize: 13, color: DARK.textMuted, textAlign: 'center' },

  // ── 2. Classifica LIVE ──
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    backgroundColor: LIGHT.card,
    borderLeftWidth: 4,
    borderLeftColor: LIGHT.green,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  liveLeft: { flex: 1, gap: 4 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: LIGHT.green,
    alignSelf: 'flex-start',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  liveTitle: { fontSize: 17, fontWeight: '700', color: LIGHT.text, letterSpacing: -0.3 },
  liveRight: { alignItems: 'flex-end', marginRight: 4 },
  liveRank: { fontSize: 30, fontWeight: '800', color: LIGHT.green, lineHeight: 34 },
  livePoints: { fontSize: 13, fontWeight: '600', color: LIGHT.textSec, marginTop: 2 },

  // ── 3. Performance (dark navy cards on light bg) ──
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: LIGHT.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  perfRow: {
    flexDirection: 'row',
    gap: 8,
  },
  perfCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: DARK.navy,
    borderRadius: 16,
    shadowColor: '#0E1A2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  perfCardWarm: {
    backgroundColor: '#182D48',
  },
  perfIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  perfValue: {
    fontSize: 28,
    fontWeight: '800',
    color: DARK.text,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  perfLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: DARK.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 13,
  },

  // ── 4. Trend (white card on light bg) ──
  trendCard: {
    backgroundColor: LIGHT.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionLabelInCard: {
    fontSize: 13,
    fontWeight: '700',
    color: LIGHT.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
});
