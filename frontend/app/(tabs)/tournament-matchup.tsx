/**
 * Tournament Matchup Live — FantaPronostic
 * Stessa schermata della giornata della lega, ma con contesto torneo
 * e pronostici affiancati (Utente A | Utente B).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Animated, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';
import { AnimatedSweep } from '../../src/components/ui';
import { MatchDetailSheet } from '../../src/components/MatchDetailSheet';
import { SideMenu } from '../../src/components/SideMenu';
import { BrandLogo } from '../../src/components/BrandLogo';

const LIGHT = { text: '#1A2233' };

const POLLING_INTERVAL = 30000;

interface MatchDetail {
  match: {
    id: string; home_team: string; away_team: string;
    home_score: number | null; away_score: number | null;
    status: string; start_time?: string;
    home_logo?: string | null; away_logo?: string | null;
    competition?: string; elapsed?: number | null;
    external_fixture_id?: number | null;
  };
  user_a_prediction: string | null;
  user_a_market: string | null;
  user_a_points: number;
  user_b_prediction: string | null;
  user_b_market: string | null;
  user_b_points: number;
}

interface LiveData {
  matchup: {
    id: string;
    user_a_id: string; user_b_id: string;
    user_a_username: string; user_b_username: string;
    result: string; status: string;
  };
  round: { label: string; status: string };
  user_a_total: number;
  user_b_total: number;
  matches: MatchDetail[];
}

const formatMarket = (market: string | null) => {
  if (!market) return '';
  switch (market) {
    case '1X2': return '1X2';
    case 'GOAL_NOGOL': return 'GNG';
    case 'OVER_UNDER_25': return 'O/U';
    case 'EXACT_SCORE': return 'ES';
    default: return market;
  }
};

export default function TournamentMatchupScreen() {
  const { tournamentId, matchupId } = useLocalSearchParams<{ tournamentId: string; matchupId: string }>();
  const { token, user } = useAuth();
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [countdown, setCountdown] = useState(30);
  const [detailFixtureId, setDetailFixtureId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchLive = useCallback(async (showRefresh = false) => {
    if (!token || !tournamentId || !matchupId) return;
    if (showRefresh) setRefreshing(true);
    try {
      const res = await apiCall<LiveData>(`/tournaments/${tournamentId}/matchup/${matchupId}/live`, { token });
      setData(res);
      setLastUpdate(new Date());
      setCountdown(30);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tournamentId, matchupId]);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => fetchLive(), POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLive]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading || !data) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Caricamento Sfida...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { matchup: mu, user_a_total, user_b_total, matches } = data;
  const isLive = matches.some(m => m.match.status === 'live');
  const isMe = (uid: string) => uid === user?.id;
  const aWinning = user_a_total > user_b_total;
  const bWinning = user_b_total > user_a_total;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Header — identico alla home lega */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerIcon} onPress={() => setMenuOpen(true)} testID="hamburger-menu-btn">
          <Ionicons name="menu" size={24} color={LIGHT.text} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Torneo – Sfida 1 vs 1</Text>
          <View style={s.headerMeta}>
            {isLive && (
              <View style={s.liveBadgeHeader}>
                <View style={s.liveDot} /><Text style={s.liveBadgeText}>LIVE</Text>
              </View>
            )}
            <Text style={s.roundLabel}>{data.round.label}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.headerIcon} onPress={() => router.back()} data-testid="matchup-back-btn">
          <Ionicons name="arrow-back" size={22} color={LIGHT.text} />
        </TouchableOpacity>
      </View>

      {/* Matchup Score Card — replaces Points Summary */}
      <View style={s.pointsOuter}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.matchupCard}>
            <AnimatedSweep />
            <View style={s.matchupRow}>
              {/* Player A */}
              <View style={s.matchupPlayer}>
                <View style={[s.matchupAvatar, isMe(mu.user_a_id) && { borderColor: colors.accent, borderWidth: 2 }]}>
                  <Text style={s.matchupAvatarText}>{mu.user_a_username.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[s.matchupName, isMe(mu.user_a_id) && { color: colors.accent }]} numberOfLines={1}>
                  {isMe(mu.user_a_id) ? 'Tu' : mu.user_a_username}
                </Text>
              </View>

              {/* Score */}
              <View style={s.matchupScoreCol}>
                <View style={s.matchupScoreRow}>
                  <Text style={[s.matchupScore, aWinning && { color: '#fff' }]}>{user_a_total.toFixed(1)}</Text>
                  <Text style={s.matchupSep}>-</Text>
                  <Text style={[s.matchupScore, bWinning && { color: '#fff' }]}>{user_b_total.toFixed(1)}</Text>
                </View>
                {mu.status === 'completed' ? (
                  <Text style={s.matchupResult}>
                    {mu.result === 'draw' ? 'Pareggio' : mu.result === 'user_a_win' ? `${mu.user_a_username} vince` : `${mu.user_b_username} vince`}
                  </Text>
                ) : (
                  <Text style={s.matchupResult}>
                    {isLive ? 'In corso' : 'Punti provvisori'}
                  </Text>
                )}
              </View>

              {/* Player B */}
              <View style={s.matchupPlayer}>
                <View style={[s.matchupAvatar, isMe(mu.user_b_id) && { borderColor: colors.accent, borderWidth: 2 }]}>
                  <Text style={s.matchupAvatarText}>{mu.user_b_username.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[s.matchupName, isMe(mu.user_b_id) && { color: colors.accent }]} numberOfLines={1}>
                  {isMe(mu.user_b_id) ? 'Tu' : mu.user_b_username}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Matches List — same cards as live screen */}
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLive(true)} tintColor={colors.accent} />}
      >
        {matches.map((md, idx) => {
          const m = md.match;
          const matchIsLive = m.status === 'live';
          const matchFinished = m.status === 'finished';
          const showPreds = matchFinished || matchIsLive;

          return (
            <TouchableOpacity
              key={m.id || idx}
              style={[s.matchCard, matchIsLive && s.matchCardLive]}
              activeOpacity={m.external_fixture_id ? 0.7 : 1}
              onPress={() => m.external_fixture_id && setDetailFixtureId(m.external_fixture_id)}
              data-testid={`matchup-match-${idx}`}
            >
              <AnimatedSweep />
              {/* Match Header */}
              <View style={s.matchHeader}>
                <View style={s.matchNumBadge}>
                  <Text style={s.matchNum}>{idx + 1}</Text>
                </View>
                <Text style={s.competition}>{m.competition || ''}</Text>
                {matchIsLive && m.elapsed != null && (
                  <View style={s.elapsedBadge}><Text style={s.elapsedText}>{m.elapsed}'</Text></View>
                )}
                {m.status === 'scheduled' && m.start_time && (
                  <Text style={s.kickoffTime}>
                    {new Date(m.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
                <View style={[s.statusBadge, { backgroundColor: matchIsLive ? colors.success : matchFinished ? 'rgba(255,255,255,0.4)' : colors.info }]}>
                  {matchIsLive && <View style={s.liveDotSmall} />}
                  <Text style={s.statusText}>
                    {matchIsLive ? 'LIVE' : matchFinished ? 'FT' : 'SCH'}
                  </Text>
                </View>
                {m.external_fixture_id && (
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 'auto' }} />
                )}
              </View>

              {/* Teams & Score */}
              <View style={s.teamsRow}>
                <View style={s.teamCol}>
                  <View style={s.teamNameRow}>
                    {m.home_logo && <Image source={{ uri: m.home_logo }} style={s.teamLogo} />}
                    <Text style={s.teamName} numberOfLines={1} ellipsizeMode="tail">{m.home_team}</Text>
                  </View>
                </View>
                <View style={s.scoreCol}>
                  {m.home_score !== null ? (
                    <Text style={[s.score, matchIsLive && { color: colors.success }]}>
                      {m.home_score} - {m.away_score}
                    </Text>
                  ) : (
                    <Text style={s.vs}>vs</Text>
                  )}
                </View>
                <View style={s.teamCol}>
                  <View style={[s.teamNameRow, { justifyContent: 'flex-end' }]}>
                    <Text style={[s.teamName, { textAlign: 'right' }]} numberOfLines={1} ellipsizeMode="tail">{m.away_team}</Text>
                    {m.away_logo && <Image source={{ uri: m.away_logo }} style={s.teamLogo} />}
                  </View>
                </View>
              </View>

              {/* PRONOSTICI AFFIANCATI — la novità del torneo */}
              <View style={s.predCompare}>
                {/* User A prediction */}
                <View style={[s.predSide, md.user_a_points > 0 && s.predSideCorrect]}>
                  <Text style={s.predPlayer} numberOfLines={1}>
                    {isMe(mu.user_a_id) ? 'Tu' : mu.user_a_username.slice(0, 10)}
                  </Text>
                  {showPreds && md.user_a_prediction ? (
                    <View style={s.predValueRow}>
                      <View style={s.marketBadge}>
                        <Text style={s.marketText}>{formatMarket(md.user_a_market)}</Text>
                      </View>
                      <Text style={s.predValue}>{md.user_a_prediction}</Text>
                    </View>
                  ) : showPreds ? (
                    <Text style={s.noPred}>—</Text>
                  ) : (
                    <Text style={s.predHidden}>?</Text>
                  )}
                  {showPreds && (
                    <View style={s.predPtsRow}>
                      <Ionicons
                        name={md.user_a_points > 0 ? 'checkmark-circle' : 'close-circle'}
                        size={14}
                        color={md.user_a_points > 0 ? colors.success : colors.error}
                      />
                      <Text style={[s.predPts, { color: md.user_a_points > 0 ? colors.success : colors.error }]}>
                        {md.user_a_points > 0 ? `+${md.user_a_points.toFixed(1)}` : '0'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* VS divider */}
                <View style={s.predVsCol}>
                  <Text style={s.predVsText}>VS</Text>
                </View>

                {/* User B prediction */}
                <View style={[s.predSide, md.user_b_points > 0 && s.predSideCorrect]}>
                  <Text style={s.predPlayer} numberOfLines={1}>
                    {isMe(mu.user_b_id) ? 'Tu' : mu.user_b_username.slice(0, 10)}
                  </Text>
                  {showPreds && md.user_b_prediction ? (
                    <View style={s.predValueRow}>
                      <View style={s.marketBadge}>
                        <Text style={s.marketText}>{formatMarket(md.user_b_market)}</Text>
                      </View>
                      <Text style={s.predValue}>{md.user_b_prediction}</Text>
                    </View>
                  ) : showPreds ? (
                    <Text style={s.noPred}>—</Text>
                  ) : (
                    <Text style={s.predHidden}>?</Text>
                  )}
                  {showPreds && (
                    <View style={s.predPtsRow}>
                      <Ionicons
                        name={md.user_b_points > 0 ? 'checkmark-circle' : 'close-circle'}
                        size={14}
                        color={md.user_b_points > 0 ? colors.success : colors.error}
                      />
                      <Text style={[s.predPts, { color: md.user_b_points > 0 ? colors.success : colors.error }]}>
                        {md.user_b_points > 0 ? `+${md.user_b_points.toFixed(1)}` : '0'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Footer */}
        <View style={s.summaryFooter}>
          <Text style={s.summaryText}>
            {matches.length} partite &bull; {matches.filter(m => m.match.status === 'finished').length} completate
          </Text>
          <Text style={s.serverTime}>
            Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
          </Text>
        </View>
      </ScrollView>

      {/* Match Detail Sheet */}
      <MatchDetailSheet
        fixtureId={detailFixtureId}
        token={token || ''}
        visible={!!detailFixtureId}
        onClose={() => setDetailFixtureId(null)}
      />

      {/* Side Menu */}
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // Same base styles as live screen
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { ...typography.bodyS, color: colors.textSecondary },

  // Header — identico alla home lega
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, gap: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  roundLabel: { ...typography.metaSmall, color: colors.accent, fontWeight: '700' },
  liveBadgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.success },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  lastUpdateText: { ...typography.metaSmall, color: colors.textSecondary },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.sm, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  countdownText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  // Matchup Score Card (replaces Points Summary)
  pointsOuter: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm,
    borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent,
    shadowColor: '#162F5C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10,
  },
  matchupCard: { padding: spacing.lg, borderRadius: borderRadius.xl, overflow: 'hidden' },
  matchupRow: { flexDirection: 'row', alignItems: 'center' },
  matchupPlayer: { flex: 1, alignItems: 'center', gap: 6 },
  matchupAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  matchupAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  matchupName: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  matchupScoreCol: { alignItems: 'center', paddingHorizontal: 12 },
  matchupScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  matchupScore: { fontSize: 28, fontWeight: '900', color: 'rgba(255,255,255,0.6)' },
  matchupSep: { fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.3)' },
  matchupResult: { fontSize: 10, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', marginTop: 4 },

  // Match cards (same as live screen)
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  matchCard: {
    backgroundColor: '#1F4C8F', borderRadius: borderRadius.xl, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.accent,
    overflow: 'hidden', shadowColor: '#162F5C', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 6,
  },
  matchCardLive: { borderColor: colors.success, borderWidth: 2 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  matchNumBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  matchNum: { ...typography.metaSmall, color: '#FFFFFF', fontWeight: '800' },
  competition: { ...typography.metaSmall, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', flex: 1 },
  elapsedBadge: { backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  elapsedText: { fontSize: 12, fontWeight: '700', color: colors.error },
  kickoffTime: { ...typography.meta, color: 'rgba(255,255,255,0.5)' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveDotSmall: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Teams
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  teamCol: { flex: 1, flexShrink: 1 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamLogo: { width: 22, height: 22, borderRadius: 11, flexShrink: 0 },
  teamName: { ...typography.bodyM, color: '#FFFFFF', fontWeight: '600', flex: 1, flexShrink: 1 },
  scoreCol: { width: 80, alignItems: 'center', flexShrink: 0 },
  score: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  vs: { ...typography.meta, color: 'rgba(255,255,255,0.4)' },

  // PRONOSTICI AFFIANCATI — il cuore della sfida
  predCompare: {
    flexDirection: 'row', alignItems: 'stretch',
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 0,
  },
  predSide: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  predSideCorrect: {
    backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  predPlayer: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  predValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marketBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(59,130,246,0.2)' },
  marketText: { fontSize: 9, fontWeight: '700', color: '#60A5FA' },
  predValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  noPred: { fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' },
  predHidden: { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.2)' },
  predPtsRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  predPts: { fontSize: 12, fontWeight: '700' },
  predVsCol: { width: 30, alignItems: 'center', justifyContent: 'center' },
  predVsText: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.25)' },

  // Footer
  summaryFooter: {
    padding: spacing.lg, borderRadius: borderRadius.xl, alignItems: 'center',
    marginTop: spacing.sm, backgroundColor: '#1F4C8F', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryText: { ...typography.meta, color: 'rgba(255,255,255,0.5)' },
  serverTime: { ...typography.metaSmall, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
});
