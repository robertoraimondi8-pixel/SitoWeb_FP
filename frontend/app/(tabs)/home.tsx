import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Animated, Easing, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { HomeData, League } from '../../src/types/api';
import { goToPredictionsHub } from '../../src/utils/navigation';
import { SideMenu } from '../../src/components/SideMenu';
import { TournamentView } from '../../src/components/TournamentView';
import { useCompetition } from '../../src/contexts/CompetitionContext';

import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { StatusBadge, LastFiveIndicator, AnimatedSweep } from '../../src/components/ui';
import { BrandLogo } from '../../src/components/BrandLogo';

// ── Color constants ──
const DARK = {
  navy: '#1F4C8F',
  navyDeep: '#162F5C',
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
  text: '#2C3E50',
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
  const params = useLocalSearchParams<{ tournament_id?: string; tournament_name?: string; matchup_id?: string }>();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showLeagueSwitcher, setShowLeagueSwitcher] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myTournaments, setMyTournaments] = useState<any[]>([]);

  // Competition mode from shared context (used by all tabs)
  const { mode: competitionMode, tournamentId: activeTournamentId, tournamentName: activeTournamentName, setLeagueMode, setTournamentMode, setCurrentRoundInfo, setLeagueMatchdayInfo } = useCompetition();

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

  // Handle incoming tournament params from navigation (e.g. from menu)
  useEffect(() => {
    if (params.tournament_id) {
      setTournamentMode(params.tournament_id, params.tournament_name || '');
    }
  }, [params.tournament_id]);

  const runEntryAnimation = () => {
    // Reset
    fadeScreen.setValue(0);
    slideHero.setValue(6); fadeHero.setValue(0);
    slideLive.setValue(6); fadeLive.setValue(0);
    slidePerf.setValue(6); fadePerf.setValue(0);
    slideTrend.setValue(6); fadeTrend.setValue(0);

    Animated.parallel([
      Animated.timing(fadeScreen, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.stagger(80, [
        Animated.parallel([
          Animated.timing(fadeHero, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(slideHero, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(fadeLive, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(slideLive, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(fadePerf, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(slidePerf, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(fadeTrend, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(slideTrend, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
      // Cache league matchday info for Pronostici tab dynamic routing
      if (res.matchday?.id && res.league?.id) {
        setLeagueMatchdayInfo({ matchdayId: res.matchday.id, status: res.matchday.status, leagueId: res.league.id });
      }
      runEntryAnimation();
      try {
        const nc = await apiCall<{ count: number }>('/notifications/unread-count', { token: authToken });
        setUnreadCount(nc.count);
      } catch {}
      try {
        const tournaments = await apiCall<any[]>('/tournaments', { token: authToken });
        const arr = Array.isArray(tournaments) ? tournaments : [];
        setMyTournaments(arr.filter((t: any) => t.is_registered && t.my_status === 'active'));
      } catch {}
    } catch (e: unknown) {
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      // Error handled silently in production
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
    return Math.round(num).toString();
  };

  const getStatusLabel = (status: string) => t(`status.${status?.toUpperCase()}`, { defaultValue: status });

  const getCtaConfig = (status: string) => {
    const hasPredictions = (data?.matchday?.my_predictions_count || 0) > 0;
    switch (status?.toUpperCase()) {
      case 'OPEN': return { icon: 'create-outline' as const, label: hasPredictions ? t('home.edit_predictions') : t('home.insert_predictions') };
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
      return `${totalMatches} ${t('matches')} \u00B7 ${t('home.deadline_in')} ${formatCountdown(countdown)}`;
    }
    if (status === 'OPEN') {
      return t('home.matches_count', { count: data.matchday.my_predictions_count, total: totalMatches });
    }
    if (status === 'LIVE') {
      const pts = data.live?.total_provisional;
      if (pts !== null && pts !== undefined) return `${t('home.in_progress')} \u00B7 ${formatPoints(pts)} pts`;
      return t('home.in_progress');
    }
    if (status === 'COMPLETED') {
      const hasPredictions = (data.matchday.my_predictions_count || 0) > 0;
      if (hasPredictions) {
        const pts = data.matchday.my_points ?? data.live?.total_provisional;
        if (pts !== null && pts !== undefined) return t('home.you_scored', { points: formatPoints(pts) });
      }
    }
    return '';
  };

  const getAvgLast5 = () => {
    const perf = data?.last_5_performance;
    if (!Array.isArray(perf) || perf.length === 0) return null;
    const sum = perf.reduce((acc: number, p: { points: number }) => acc + p.points, 0);
    return Math.round(sum / perf.length).toString();
  };

  // CTA press handlers
  const onCtaPressIn = () => { Animated.spring(ctaScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); };
  const onCtaPressOut = () => { Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); };

  if (loading && competitionMode === 'league') {
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
        <TouchableOpacity style={s.headerIcon} onPress={() => setMenuOpen(true)} testID="hamburger-menu-btn" accessibilityLabel="Apri menu" accessibilityRole="button">
          <Ionicons name="menu" size={24} color={LIGHT.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <BrandLogo variant="wordmark" size="lg" />
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerIcon} onPress={() => router.push('/menu/notifications')} testID="notification-bell-btn" accessibilityLabel="Notifiche" accessibilityRole="button">
            <Ionicons name="notifications-outline" size={22} color={LIGHT.text} />
            {unreadCount > 0 && (
              <View style={s.bellBadge} testID="notification-badge">
                <Text style={s.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIcon} onPress={() => router.push('/palmares')} data-testid="palmares-btn" accessibilityLabel="Palmares" accessibilityRole="button">
            <Ionicons name="medal-outline" size={22} color={LIGHT.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ COMPETITION SWITCHER (white pill) ═══ */}
      {(data?.league || competitionMode === 'tournament') && (
        <View style={s.leagueWrap}>
          <TouchableOpacity
            style={s.leagueBtn}
            onPress={() => (leagues.length > 1 || myTournaments.length > 0) ? setShowLeagueSwitcher(true) : null}
            activeOpacity={(leagues.length > 1 || myTournaments.length > 0) ? 0.7 : 1}
            data-testid="competition-switcher-btn"
          >
            <Ionicons name={competitionMode === 'tournament' ? 'flash' : 'trophy-outline'} size={15} color={competitionMode === 'tournament' ? '#22c55e' : DARK.accent} />
            <Text style={s.leagueText} numberOfLines={1}>{competitionMode === 'tournament' ? activeTournamentName : data?.league?.name}</Text>
            {(leagues.length > 1 || myTournaments.length > 0) && <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Competition Switcher Dropdown */}
      {showLeagueSwitcher && (
        <TouchableOpacity style={s.switcherOverlay} activeOpacity={1} onPress={() => setShowLeagueSwitcher(false)}>
          <ScrollView style={s.switcherDropdown} contentContainerStyle={s.switcherDropdownContent} bounces={false} showsVerticalScrollIndicator={true}>
            {/* LEGHE section */}
            <Text style={s.switcherSectionLabel}>LEGHE</Text>
            {leagues.map((lg: League) => {
              const isActive = competitionMode === 'league' && lg.id === activeLeague?.id;
              return (
                <TouchableOpacity
                  key={lg.id}
                  style={[s.switcherItem, isActive && s.switcherItemActive]}
                  onPress={async () => {
                    setShowLeagueSwitcher(false);
                    setLeagueMode();
                    setData(null); setCountdown(0); setLoading(true);
                    setActiveLeague(lg);
                    fetchHome(lg.id);
                    const authToken = token || await AsyncStorage.getItem('access_token');
                    if (authToken) apiCall(`/profile/current-league?league_id=${lg.id}`, { method: 'PATCH', token: authToken }).catch(() => {});
                  }}
                >
                  <Ionicons name={isActive ? 'trophy' : 'trophy-outline'} size={18} color={isActive ? DARK.accent : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.switcherItemText, isActive && { color: DARK.accent }]}>{lg.name}</Text>
                    <Text style={s.switcherItemSub}>{lg.league_type === 'national' ? t('home.national_league') : `${lg.member_count ?? ''} ${t('members')}`}</Text>
                  </View>
                  {isActive && <Ionicons name="checkmark" size={16} color={DARK.accent} />}
                </TouchableOpacity>
              );
            })}

            {/* TORNEI section */}
            {myTournaments.length > 0 && (
              <>
                <View style={s.switcherDivider} />
                <Text style={[s.switcherSectionLabel, { color: '#22c55e' }]}>TORNEI</Text>
                {myTournaments.map((t: any) => {
                  const isActive = competitionMode === 'tournament' && activeTournamentId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[s.switcherItem, isActive && s.switcherItemActive]}
                      onPress={() => {
                        setShowLeagueSwitcher(false);
                        setTournamentMode(t.id, t.name);
                      }}
                      data-testid={`switch-tournament-${t.id}`}
                    >
                      <View style={s.switcherTourneyIcon}>
                        <Ionicons name="flash" size={14} color="#22c55e" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.switcherItemText, isActive && { color: '#22c55e' }]}>{t.name}</Text>
                      </View>
                      {isActive ? <Ionicons name="checkmark" size={16} color="#22c55e" /> : <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </TouchableOpacity>
      )}
      {/* ═══ CONTENT AREA: Tournament or League ═══ */}
      {competitionMode === 'tournament' && activeTournamentId ? (
        <View style={{ flex: 1 }}>
          <TournamentView tournamentId={activeTournamentId} initialMatchupId={params.matchup_id} />
        </View>
      ) : (
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
                  colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.heroCard}
                >
                  {/* Diagonal light curve overlay */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.08)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Layer A — Diagonal white sweep */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']}
                    start={{ x: 0.1, y: 0.0 }}
                    end={{ x: 0.9, y: 1.0 }}
                    style={s.whiteSweep}
                  />
                  {/* Layer B — Inset highlight top */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.10)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.topGlow}
                  />
                  <AnimatedSweep />
                  {data?.matchday ? (
                    <>
                      {/* Top row: matchday label + status badge */}
                      <View style={s.heroTop}>
                        <View style={s.heroLabelRow}>
                          <Ionicons name="football" size={13} color={DARK.textMuted} />
                          <Text style={s.heroLabel}>{(data.matchday.label || `${t('home.matchday_label')} ${data.matchday.number}`).toUpperCase()}</Text>
                        </View>
                        <StatusBadge status={data.matchday.status} label={getStatusLabel(data.matchday.status)} />
                      </View>

                      {/* PRIMARY METRIC: points for LIVE/COMPLETED */}
                      {(data.matchday.status?.toUpperCase() === 'LIVE' || data.matchday.status?.toUpperCase() === 'COMPLETED') ? (
                        <View style={s.heroPrimaryWrap}>
                          <Text style={s.heroPrimaryMetric} data-testid="league-primary-points">
                            {(() => {
                              const pts = data.matchday.status?.toUpperCase() === 'LIVE'
                                ? (data.live?.total_provisional ?? 0)
                                : (data.matchday.my_points ?? data.live?.total_provisional ?? 0);
                              const val = Math.round(Number(pts));
                              return val > 0 ? `+${val}` : `${val}`;
                            })()}
                          </Text>
                          <Text style={s.heroPrimaryLabel}>{t('home.matchday_points_label')}</Text>
                          <Text style={s.heroContextMsg} data-testid="league-context-msg">
                            {(() => {
                              const isLive = data.matchday.status?.toUpperCase() === 'LIVE';
                              const pts = isLive
                                ? (data.live?.total_provisional ?? 0)
                                : (data.matchday.my_points ?? data.live?.total_provisional ?? 0);
                              const val = Math.round(Number(pts));
                              const totalMatches = Math.min(data.matchday.total_matches || 0, 10);
                              if (isLive) return t('home.making_points', { points: val, matches: totalMatches });
                              if (val > 0) return t('home.scored_on_matches', { points: val, matches: totalMatches });
                              return t('home.no_points_matchday');
                            })()}
                          </Text>
                        </View>
                      ) : (
                        <>
                          {/* Countdown timer — PRIMARY info for leagues */}
                          {countdown > 0 && (
                            <Text style={s.heroCountdownPrimary}>{t('home.deadline_in')} {formatCountdown(countdown)}</Text>
                          )}
                          {/* Matchday title — SECONDARY */}
                          <Text style={s.heroTitleSecondary}>
                            {data.matchday.label || `${t('home.matchday_label')} ${data.matchday.number}`}
                          </Text>
                          {/* Prediction progress bar */}
                          <View style={s.predProgressRow}>
                            <View style={s.predProgressBarBg}>
                              <View style={[s.predProgressBarFill, { width: `${(data.matchday.my_predictions_count / Math.max(data.matchday.matches_loaded || data.matchday.total_matches || 10, 1)) * 100}%` }]} />
                            </View>
                            <Text style={s.predProgressText}>{data.matchday.my_predictions_count}/{data.matchday.matches_loaded || data.matchday.total_matches || 10} {t('predictions.title').toLowerCase()}</Text>
                          </View>
                        </>
                      )}

                      {/* CTA Button — unified with tournament style */}
                      {ctaConfig && (
                        <View data-testid="league-hero-cta">
                          <LinearGradient
                            colors={data.matchday.status?.toUpperCase() === 'LIVE' ? ['#10B981', '#059669'] : ['#F7A21B', '#E88E00']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={s.ctaGrad}
                          >
                            <Text style={s.ctaGradText}>{ctaConfig.label}</Text>
                            <View style={s.ctaGradIcon}>
                              <Ionicons name={ctaConfig.icon} size={18} color="#fff" />
                            </View>
                          </LinearGradient>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={s.emptyHero}>
                      <Ionicons name="football-outline" size={40} color={DARK.textMuted} />
                      <Text style={s.emptyHeroTitle}>{t('home.no_matchday')}</Text>
                      <Text style={s.emptyHeroSub}>{t('home.no_matchday_scheduled')}</Text>
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
              activeOpacity={0.7}
              data-testid="live-standings-btn"
              onPress={() => {
                router.push({ pathname: '/(tabs)/rankings', params: { tab: 'weekly', matchdayId: data.matchday?.id, leagueId: data.league?.id } } as any);
              }}
            >
              <LinearGradient
                colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.liveCard}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']}
                  start={{ x: 0.1, y: 0.0 }}
                  end={{ x: 0.9, y: 1.0 }}
                  style={s.whiteSweep}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.10)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.topGlow}
                />
                <View style={s.liveLeft}>
                  <View style={s.liveBadge}>
                    <View style={s.liveDot} />
                    <Text style={s.liveBadgeText}>LIVE</Text>
                  </View>
                  <Text style={s.liveTitle}>{t('home.live_rankings')}</Text>
                </View>
                <View style={s.liveRight}>
                  <Text style={s.liveRank}>{data.live?.live_rank ? `${data.live.live_rank}\u00B0` : '-'}</Text>
                  <Text style={s.livePoints}>{formatPoints(data.live?.live_points ?? 0)} pts</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" style={{ marginLeft: 8 }} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── 3. MINI CLASSIFICA ─── */}
        {data?.rankings_preview?.top?.length > 0 && (
          <Animated.View style={{ opacity: fadePerf, transform: [{ translateY: slidePerf }] }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/rankings')}
              data-testid="mini-rankings-block"
            >
              <LinearGradient
                colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.miniRankCard}
              >
                <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
                <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
                <Text style={s.miniRankTitle}>{t('home.rankings_section')}</Text>
                {data.rankings_preview.top.slice(0, 3).map((entry: any, i: number) => {
                  const isMe = entry.user_id === data.rankings_preview?.current_user_id;
                  return (
                    <View key={i} style={s.miniRankRow}>
                      <Text style={[s.miniRankPos, i === 0 && { color: '#F7A21B' }]}>{entry.rank + '°'}</Text>
                      <Text style={[s.miniRankName, isMe && { color: '#F7A21B', fontWeight: '700' }]} numberOfLines={1}>{entry.username}</Text>
                      <Text style={s.miniRankPts}>{entry.total_points} pts</Text>
                    </View>
                  );
                })}
                <View style={s.miniRankCtaRow}>
                  <Text style={s.miniRankCta}>{t('home.view_all_rankings')}</Text>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ─── 4. PERFORMANCE (premium gradient cards) ─── */}
        {data?.user_summary && (
          <Animated.View style={{ opacity: fadePerf, transform: [{ translateY: slidePerf }] }}>
            <Text style={s.sectionLabel}>PERFORMANCE</Text>
            <View style={s.perfRow}>
              {/* Position */}
              <View style={s.perfCardOuter}>
                <LinearGradient
                  colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.perfCardGrad}
                >
                  {/* Inset highlight */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.07)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.perfInset}
                  />
                  {/* Layer A — Diagonal white sweep */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']}
                    start={{ x: 0.1, y: 0.0 }}
                    end={{ x: 0.9, y: 1.0 }}
                    style={s.whiteSweep}
                  />
                  {/* Layer B — Inset highlight top */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.10)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.topGlow}
                  />
                  <View style={s.perfIconWrap}>
                    <Ionicons name="trophy" size={20} color={DARK.accent} />
                  </View>
                  <Text style={s.perfValue}>{data.user_summary.rank ? `${data.user_summary.rank}\u00B0` : '-'}</Text>
                  <Text style={s.perfLabel}>{t('home.position_current_label')}</Text>
                </LinearGradient>
              </View>
              {/* Total Points */}
              <View style={s.perfCardOuter}>
                <LinearGradient
                  colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.perfCardGrad}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.07)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.perfInset}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']}
                    start={{ x: 0.1, y: 0.0 }}
                    end={{ x: 0.9, y: 1.0 }}
                    style={s.whiteSweep}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.10)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.topGlow}
                  />
                  <View style={s.perfIconWrap}>
                    <Ionicons name="star" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={s.perfValue}>{formatPoints(data.user_summary.total_points)}</Text>
                  <Text style={s.perfLabel}>{t('home.total_points_label')}</Text>
                </LinearGradient>
              </View>
              {/* Avg Last 5 */}
              <View style={s.perfCardOuter}>
                <LinearGradient
                  colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.perfCardGrad}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.07)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.perfInset}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']}
                    start={{ x: 0.1, y: 0.0 }}
                    end={{ x: 0.9, y: 1.0 }}
                    style={s.whiteSweep}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.10)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.topGlow}
                  />
                  <View style={s.perfIconWrap}>
                    <Ionicons name="football" size={20} color={LIGHT.green} />
                  </View>
                  <Text style={s.perfValue}>{avg5 ?? '-'}</Text>
                  <Text style={s.perfLabel}>{t('home.avg_last_5_label')}</Text>
                </LinearGradient>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ─── 5. ULTIME 5 (simplified pills) ─── */}
        {Array.isArray(data?.last_5_performance) && data.last_5_performance.length > 0 && (
          <Animated.View style={{ opacity: fadeTrend, transform: [{ translateY: slideTrend }] }}>
            <LinearGradient
              colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.last5Card}
            >
              <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
              <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
              <Text style={s.last5Title}>{t('home.last_5_matchdays')}</Text>
              <View style={s.last5Row}>
                {data.last_5_performance.map((item: any, i: number) => (
                  <View key={i} style={s.last5PillWrap}>
                    <View style={[s.last5Pill, item.points > 0 && s.last5PillActive]}>
                      <Text style={[s.last5PillPts, item.points > 0 && s.last5PillPtsActive]}>{Math.round(item.points)}</Text>
                    </View>
                    <Text style={s.last5PillMd}>{item.matchday_number}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ─── 5. PRONOSTICO VINCITORE CAMPIONATO (hidden - future feature) ─── */}

      </Animated.ScrollView>
      )}

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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#F3F4F6',
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
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  switcherDropdownContent: {
    paddingVertical: 8,
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
  switcherSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: DARK.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  switcherDivider: {
    height: 1,
    backgroundColor: LIGHT.border,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  switcherTourneyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e15',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    borderWidth: 1.5,
    borderColor: DARK.accent,
    shadowColor: '#162F5C',
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
  heroCountdownPrimary: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 32,
    marginBottom: 6,
  },
  heroTitleSecondary: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 14,
  },
  heroSub: {
    fontSize: 15,
    fontWeight: '400',
    color: DARK.textSub,
    marginBottom: 16,
  },

  // Primary metric (points for league, score for tournament)
  heroPrimaryWrap: {
    alignItems: 'center',
    marginVertical: 16,
  },
  heroPrimaryMetric: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    lineHeight: 58,
  },
  heroPrimaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK.textSub,
    letterSpacing: 2,
    marginTop: 4,
  },
  heroContextMsg: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    marginBottom: 2,
  },

  // CTA Button (premium with highlight + top line)
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 22,
  },
  ctaGradText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  ctaGradIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty hero
  emptyHero: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyHeroTitle: { fontSize: 18, fontWeight: '700', color: DARK.textSub },
  emptyHeroSub: { fontSize: 13, color: DARK.textMuted, textAlign: 'center' },

  // Prediction progress (unified with tournament)
  predProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  predProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  predProgressBarFill: {
    height: '100%',
    backgroundColor: DARK.accent,
    borderRadius: 3,
  },
  predProgressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },

  // ── 2. Classifica LIVE (premium with orange border) ──
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#1F4C8F',
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 6,
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
  liveTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  liveRight: { alignItems: 'flex-end', marginRight: 4 },
  liveRank: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', lineHeight: 34 },
  livePoints: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  // ── 3. Performance (gradient cards + inset + sospensione) ──
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  perfRow: {
    flexDirection: 'row',
    gap: 12,
  },
  perfCardOuter: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: DARK.accent,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 10,
  },
  perfCardGrad: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  perfInset: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  whiteSweep: {
    position: 'absolute',
    top: -20,
    left: -40,
    width: '140%',
    height: '60%',
    transform: [{ rotate: '-12deg' }],
    borderRadius: 22,
    opacity: 0.9,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  perfIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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

  // ── 4. Trend (white card, radius 22) ──
  trendCardGrad: {
    padding: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sectionLabelInCard: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // ── Mini Ranking Block ──
  miniRankCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
  },
  miniRankTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  miniRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  miniRankPos: {
    width: 32,
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
  },
  miniRankName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  miniRankPts: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  miniRankCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
  },
  miniRankCta: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },

  // ── Last 5 Pills ──
  last5Card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
  },
  last5Title: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  last5Row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  last5PillWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  last5Pill: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  last5PillActive: {
    backgroundColor: 'rgba(247, 162, 27, 0.15)',
  },
  last5PillPts: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
  },
  last5PillPtsActive: {
    color: '#F7A21B',
  },
  last5PillMd: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },

  // ── 5. Champion Pick Banner ──
  championBanner: {
    marginTop: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  championBannerGrad: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  championBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  championBannerLeft: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  championBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  championBannerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },

});
