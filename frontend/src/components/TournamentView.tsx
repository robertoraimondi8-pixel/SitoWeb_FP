/**
 * TournamentView — Renders INSIDE the Home tab when a tournament is selected.
 * Uses the SAME visual components as the league home. No separate navigation.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, ScrollView, Image, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../api/client';
import { colors, typography, spacing, borderRadius } from '../theme/designSystem';
import { AnimatedSweep, StatusBadge, LastFiveIndicator } from './ui';
import { MatchDetailSheet } from './MatchDetailSheet';

const DARK = { accent: '#F5A623', textMuted: 'rgba(255,255,255,0.45)' };

interface Props {
  tournamentId: string;
  initialMatchupId?: string;
}

export function TournamentView({ tournamentId, initialMatchupId }: Props) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [myMatchups, setMyMatchups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  // Matchup live state — renders INLINE, not in a separate page
  const [activeMatchup, setActiveMatchup] = useState<any>(null);
  const [matchupLiveData, setMatchupLiveData] = useState<any>(null);
  const [matchupLoading, setMatchupLoading] = useState(false);
  const [detailFixtureId, setDetailFixtureId] = useState<number | null>(null);
  const liveInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!token || !tournamentId) return;
    try {
      const [detail, matchups] = await Promise.all([
        apiCall<any>(`/tournaments/${tournamentId}`, { token }),
        apiCall<any[]>(`/tournaments/${tournamentId}/my-matchups`, { token }).catch(() => []),
      ]);
      setTournament(detail);
      setMyMatchups(matchups);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, tournamentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-open matchup live if initialMatchupId is passed (from rankings)
  useEffect(() => {
    if (initialMatchupId && !loading && tournament) {
      openMatchupLive({ id: initialMatchupId });
    }
  }, [initialMatchupId, loading, tournament]);

  // Matchup live fetch
  const fetchMatchupLive = useCallback(async (matchupId: string) => {
    if (!token) return;
    try {
      const res = await apiCall<any>(`/tournaments/${tournamentId}/matchup/${matchupId}/live`, { token });
      setMatchupLiveData(res);
    } catch (e) { console.error(e); }
    finally { setMatchupLoading(false); }
  }, [token, tournamentId]);

  const openMatchupLive = (matchup: any) => {
    setActiveMatchup(matchup);
    setMatchupLoading(true);
    setMatchupLiveData(null);
    fetchMatchupLive(matchup.id);
    liveInterval.current = setInterval(() => fetchMatchupLive(matchup.id), 30000);
  };

  const closeMatchupLive = () => {
    setActiveMatchup(null);
    setMatchupLiveData(null);
    if (liveInterval.current) { clearInterval(liveInterval.current); liveInterval.current = null; }
  };

  useEffect(() => {
    return () => { if (liveInterval.current) clearInterval(liveInterval.current); };
  }, []);

  const joinTournament = async () => {
    if (!token) return;
    setJoining(true);
    try { await apiCall(`/tournaments/${tournamentId}/register`, { method: 'POST', token }); fetchData(); }
    catch (e) { console.error(e); }
    finally { setJoining(false); }
  };

  if (loading || !tournament) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  const t = tournament;
  const hasGroups = t.status !== 'draft' && t.status !== 'registration';
  const statusLabels: Record<string, string> = {
    draft: 'BOZZA', registration: 'ISCRIZIONI APERTE', groups: 'FASE A GIRONI', knockout: 'ELIMINAZIONE DIRETTA', completed: 'CONCLUSO'
  };
  const formatMarket = (m: string | null) => {
    if (!m) return '';
    const map: Record<string, string> = { '1X2': '1X2', 'GOAL_NOGOL': 'GNG', 'OVER_UNDER_25': 'O/U', 'EXACT_SCORE': 'ES' };
    return map[m] || m;
  };

  // ══════════════════════════════════════
  // MATCHUP LIVE VIEW (inline, not a page)
  // ══════════════════════════════════════
  if (activeMatchup && matchupLiveData) {
    const mu = matchupLiveData.matchup;
    const { user_a_total, user_b_total, matches } = matchupLiveData;
    const isLive = matches.some((m: any) => m.match.status === 'live');
    const isMe = (uid: string) => uid === user?.id;
    const aWin = user_a_total > user_b_total;
    const bWin = user_b_total > user_a_total;
    const aName = isMe(mu.user_a_id) ? 'Tu' : mu.user_a_username;
    const bName = isMe(mu.user_b_id) ? 'Tu' : mu.user_b_username;

    return (
      <ScrollView contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMatchupLive(activeMatchup.id)} tintColor={colors.accent} />}>
        {/* Back to tournament */}
        <TouchableOpacity style={s.backRow} onPress={closeMatchupLive} data-testid="matchup-back">
          <Ionicons name="arrow-back" size={18} color={colors.accent} />
          <Text style={s.backText}>Torna al torneo</Text>
        </TouchableOpacity>

        {/* ═══ 1. HERO SCORE CARD ═══ */}
        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
          <AnimatedSweep />
          <View style={s.heroTop}>
            <View style={s.heroLabelRow}>
              <Ionicons name="flash" size={13} color={DARK.textMuted} />
              <Text style={s.heroLabel}>SFIDA 1 VS 1</Text>
            </View>
            {isLive && <View style={s.liveBadgeBig}><View style={s.liveDotBig} /><Text style={s.liveTextBig}>LIVE</Text></View>}
          </View>
          <View style={s.muScoreRow}>
            <View style={s.muPlayer}>
              <View style={[s.muAvatar, isMe(mu.user_a_id) && s.muAvatarMe, aWin && { borderColor: '#10B981', borderWidth: 2 }]}><Text style={s.muAvatarText}>{mu.user_a_username.charAt(0).toUpperCase()}</Text></View>
              <Text style={[s.muName, isMe(mu.user_a_id) && { color: colors.accent }]} numberOfLines={1}>{aName}</Text>
            </View>
            <View style={s.muCenter}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={[s.muScore, aWin && { color: '#10B981' }, !aWin && !bWin && { color: '#fff' }]}>{user_a_total.toFixed(1)}</Text>
                <Text style={s.muSep}>-</Text>
                <Text style={[s.muScore, bWin && { color: '#10B981' }, !aWin && !bWin && { color: '#fff' }]}>{user_b_total.toFixed(1)}</Text>
              </View>
              <Text style={s.muResult}>{matchupLiveData.round.label}</Text>
            </View>
            <View style={s.muPlayer}>
              <View style={[s.muAvatar, isMe(mu.user_b_id) && s.muAvatarMe, bWin && { borderColor: '#10B981', borderWidth: 2 }]}><Text style={s.muAvatarText}>{mu.user_b_username.charAt(0).toUpperCase()}</Text></View>
              <Text style={[s.muName, isMe(mu.user_b_id) && { color: colors.accent }]} numberOfLines={1}>{bName}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ═══ 2. MATCH CARDS ═══ */}
        {matches.map((md: any, idx: number) => {
          const m = md.match;
          const mLive = m.status === 'live';
          const mDone = m.status === 'finished';
          const show = mDone || mLive;
          const aPts = md.user_a_points || 0;
          const bPts = md.user_b_points || 0;
          return (
            <TouchableOpacity key={m.id || idx} style={[s.matchCard, mLive && s.matchCardLive]} activeOpacity={m.external_fixture_id ? 0.7 : 1} onPress={() => m.external_fixture_id && setDetailFixtureId(m.external_fixture_id)} data-testid={`match-${idx}`}>
              <AnimatedSweep />
              {/* Match header */}
              <View style={s.matchHeader}>
                <View style={s.matchNumBadge}><Text style={s.matchNum}>{idx + 1}</Text></View>
                <Text style={s.competition}>{m.competition || ''}</Text>
                {mLive && m.elapsed != null && <View style={s.elapsedBadge}><Text style={s.elapsedText}>{m.elapsed}'</Text></View>}
                {mLive && <View style={s.liveBadgeMatch}><View style={s.liveDotSm} /><Text style={s.liveTextMatch}>LIVE</Text></View>}
                {mDone && <View style={[s.liveBadgeMatch, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={[s.liveTextMatch, { color: 'rgba(255,255,255,0.6)' }]}>FT</Text></View>}
              </View>
              {/* Teams + Score */}
              <View style={s.teamsRow}>
                <View style={s.teamCol}>
                  <View style={s.teamNameRow}>
                    {m.home_logo && <Image source={{ uri: m.home_logo }} style={s.teamLogo} />}
                    <Text style={s.teamName} numberOfLines={1}>{m.home_team}</Text>
                  </View>
                </View>
                <View style={s.scoreCol}>
                  {m.home_score !== null ? <Text style={[s.score, mLive && { color: '#10B981', fontSize: 24 }]}>{m.home_score} - {m.away_score}</Text> : <Text style={s.vs}>vs</Text>}
                </View>
                <View style={s.teamCol}>
                  <View style={[s.teamNameRow, { justifyContent: 'flex-end' }]}>
                    <Text style={[s.teamName, { textAlign: 'right' }]} numberOfLines={1}>{m.away_team}</Text>
                    {m.away_logo && <Image source={{ uri: m.away_logo }} style={s.teamLogo} />}
                  </View>
                </View>
              </View>
              {/* ═══ 3. PREDICTIONS COMPARISON ═══ */}
              <View style={s.predRow}>
                <View style={[s.predSide, show && aPts > 0 && s.predCorrect, show && aPts === 0 && s.predWrong]}>
                  <Text style={s.predPlayer} numberOfLines={1}>{aName}</Text>
                  {show && md.user_a_prediction ? (
                    <>
                      <View style={s.mktBadge}><Text style={s.mktText}>{formatMarket(md.user_a_market)}</Text></View>
                      <Text style={s.predVal}>{md.user_a_prediction}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name={aPts > 0 ? 'checkmark-circle' : 'close-circle'} size={14} color={aPts > 0 ? '#10B981' : '#ef4444'} />
                        <Text style={[s.predPts, { color: aPts > 0 ? '#10B981' : '#ef4444' }]}>{aPts > 0 ? `+${aPts.toFixed(1)}` : '0'}</Text>
                      </View>
                    </>
                  ) : show ? <Text style={s.noPred}>—</Text> : <Text style={s.hiddenPred}>?</Text>}
                </View>
                <View style={s.predVsCol}><Text style={s.predVsText}>VS</Text></View>
                <View style={[s.predSide, show && bPts > 0 && s.predCorrect, show && bPts === 0 && s.predWrong]}>
                  <Text style={s.predPlayer} numberOfLines={1}>{bName}</Text>
                  {show && md.user_b_prediction ? (
                    <>
                      <View style={s.mktBadge}><Text style={s.mktText}>{formatMarket(md.user_b_market)}</Text></View>
                      <Text style={s.predVal}>{md.user_b_prediction}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name={bPts > 0 ? 'checkmark-circle' : 'close-circle'} size={14} color={bPts > 0 ? '#10B981' : '#ef4444'} />
                        <Text style={[s.predPts, { color: bPts > 0 ? '#10B981' : '#ef4444' }]}>{bPts > 0 ? `+${bPts.toFixed(1)}` : '0'}</Text>
                      </View>
                    </>
                  ) : show ? <Text style={s.noPred}>—</Text> : <Text style={s.hiddenPred}>?</Text>}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <MatchDetailSheet fixtureId={detailFixtureId} token={token || ''} visible={!!detailFixtureId} onClose={() => setDetailFixtureId(null)} />
      </ScrollView>
    );
  }

  // Loading matchup live
  if (activeMatchup && matchupLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /><Text style={{ color: colors.textSecondary, marginTop: 8 }}>Caricamento sfida...</Text></View>;
  }

  // ══════════════════════════════════════
  // TOURNAMENT HOME VIEW (inline in home)
  // ══════════════════════════════════════
  const cri = tournament.current_round_info;

  // CTA press handler — mirrors league behavior
  const handleHeroCta = () => {
    if (!cri) return;
    if (cri.status === 'OPEN') {
      // Navigate to predictions screen reusing the league flow
      router.push({ pathname: '/(tabs)/predictions', params: { league_id: tournamentId, matchday_id: cri.round_id } } as any);
    } else if (cri.status === 'LIVE') {
      if (cri.matchup_id) openMatchupLive({ id: cri.matchup_id });
      else router.push({ pathname: '/live/[id]', params: { id: cri.round_id, league_id: tournamentId } } as any);
    } else if (cri.status === 'COMPLETED') {
      if (cri.matchup_id) openMatchupLive({ id: cri.matchup_id });
      else router.push({ pathname: '/live/[id]', params: { id: cri.round_id, league_id: tournamentId } } as any);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accent} />}>
      {/* ═══ HERO CARD ═══ Dynamic, mirrors league home card */}
      {cri ? (
        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
          <AnimatedSweep />
          {/* Top row: label + status badge */}
          <View style={s.heroTop}>
            <View style={s.heroLabelRow}>
              <Ionicons name="flash" size={13} color={DARK.textMuted} />
              <Text style={s.heroLabel}>SFIDA TORNEO</Text>
            </View>
            <StatusBadge
              status={cri.status === 'OPEN' ? 'OPEN' : cri.status === 'LIVE' ? 'LIVE' : cri.status === 'PENDING' ? 'LOCKED' : 'COMPLETED'}
              label={cri.status === 'OPEN' ? 'PRONOSTICI APERTI' : cri.status === 'LIVE' ? 'LIVE' : cri.status === 'PENDING' ? 'IN PREPARAZIONE' : 'COMPLETATA'}
            />
          </View>

          {/* Round label */}
          <Text style={s.heroTitle}>{cri.label}</Text>

          {/* Opponent info */}
          {cri.opponent_name ? (
            <Text style={s.heroSub}>
              VS {cri.opponent_name}
              {cri.status !== 'OPEN' && cri.status !== 'PENDING' ? `  \u2022  ${cri.my_points} - ${cri.opp_points}` : ''}
            </Text>
          ) : (
            <Text style={s.heroSub}>{t.registered_count}/{t.max_participants} partecipanti</Text>
          )}

          {/* Live points badge */}
          {cri.status === 'LIVE' && cri.live_total !== null && (
            <View style={s.livePointsRow}>
              <Text style={s.livePointsLabel}>I tuoi punti live</Text>
              <Text style={s.livePointsVal}>{cri.live_total}</Text>
            </View>
          )}

          {/* Prediction progress */}
          {cri.status === 'OPEN' && (
            <View style={s.predProgressRow}>
              <View style={s.predProgressBarBg}>
                <View style={[s.predProgressBarFill, { width: cri.total_matches > 0 ? `${(cri.my_predictions_count / cri.total_matches) * 100}%` : '0%' }]} />
              </View>
              <Text style={s.predProgressText}>{cri.my_predictions_count}/{cri.total_matches} pronostici</Text>
            </View>
          )}

          {/* PENDING state message */}
          {cri.status === 'PENDING' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, opacity: 0.7 }}>
              <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>In attesa delle partite da pronosticare</Text>
            </View>
          )}

          {/* CTA button — identical to league */}
          {cri.status !== 'PENDING' && (
          <TouchableOpacity onPress={handleHeroCta} data-testid="tournament-hero-cta">
            <LinearGradient
              colors={cri.status === 'LIVE' ? ['#ef4444', '#dc2626'] : ['#F7A21B', '#E88E00']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaGrad}
            >
              <Text style={s.ctaText}>
                {cri.status === 'OPEN' ? (cri.my_predictions_count > 0 ? 'MODIFICA PRONOSTICI' : 'INSERISCI PRONOSTICI')
                  : cri.status === 'LIVE' ? 'SEGUI LIVE'
                  : 'VEDI RISULTATI'}
              </Text>
              <View style={s.ctaIcon}>
                <Ionicons name={cri.status === 'LIVE' ? 'pulse' : 'arrow-forward'} size={18} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          )}
        </LinearGradient>
      ) : (
        /* Fallback: Registration / No active round */
        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
          <AnimatedSweep />
          <View style={s.heroTop}>
            <View style={s.heroLabelRow}><Ionicons name="trophy" size={13} color={DARK.textMuted} /><Text style={s.heroLabel}>TORNEO</Text></View>
            <StatusBadge status={t.status === 'registration' ? 'OPEN' : 'COMPLETED'} label={statusLabels[t.status] || t.status} />
          </View>
          <Text style={s.heroTitle}>{t.name}</Text>
          <Text style={s.heroSub}>{t.registered_count}/{t.max_participants} iscritti  &bull;  {t.groups_count} gironi da {t.players_per_group}  &bull;  {t.duration_rounds} round</Text>

          {t.status === 'registration' && !t.is_registered && (
            <TouchableOpacity onPress={joinTournament} disabled={joining} data-testid="join-tournament-btn">
              <LinearGradient colors={['#F7A21B', '#E88E00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaGrad}>
                {joining ? <ActivityIndicator size="small" color="#fff" /> : <><Text style={s.ctaText}>Iscriviti al Torneo</Text><View style={s.ctaIcon}><Ionicons name="arrow-forward" size={18} color="#fff" /></View></>}
              </LinearGradient>
            </TouchableOpacity>
          )}
          {t.is_registered && t.status === 'registration' && (
            <View style={s.enrolledRow}><Ionicons name="checkmark-circle" size={16} color={colors.success} /><Text style={s.enrolledText}>Sei iscritto — In attesa di inizio</Text></View>
          )}
        </LinearGradient>
      )}

      {/* ═══ PERFORMANCE ═══ mirrors league home */}
      {hasGroups && myMatchups.length > 0 && (() => {
        const completed = myMatchups.filter((m: any) => m.status === 'completed');
        const isA = (m: any) => m.user_a_id === user?.id;
        const wins = completed.filter((m: any) => m.result === (isA(m) ? 'user_a_win' : 'user_b_win')).length;
        const totalPts = completed.reduce((s: number, m: any) => s + (isA(m) ? m.user_a_points : m.user_b_points), 0);
        const avg = completed.length > 0 ? (totalPts / completed.length).toFixed(1) : '-';
        const last5 = myMatchups.slice(-5).map((m: any) => ({
          points: isA(m) ? m.user_a_points : m.user_b_points,
          matchday_number: m.round_number,
        }));
        return (
          <>
            <Text style={s.sectionLabel}>PERFORMANCE</Text>
            <View style={s.perfRow}>
              {/* Vittorie */}
              <View style={s.perfCardOuter}>
                <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perfCardGrad}>
                  <LinearGradient colors={['rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.perfInset} />
                  <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
                  <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
                  <View style={s.perfIconWrap}><Ionicons name="trophy" size={20} color={DARK.accent} /></View>
                  <Text style={s.perfValue}>{wins}</Text>
                  <Text style={s.perfLabel}>{'VITTORIE\nTORNEO'}</Text>
                </LinearGradient>
              </View>
              {/* Punti Totali */}
              <View style={s.perfCardOuter}>
                <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perfCardGrad}>
                  <LinearGradient colors={['rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.perfInset} />
                  <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
                  <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
                  <View style={s.perfIconWrap}><Ionicons name="star" size={20} color="#fff" /></View>
                  <Text style={s.perfValue}>{totalPts.toFixed(1)}</Text>
                  <Text style={s.perfLabel}>{'PUNTI\nTOTALI'}</Text>
                </LinearGradient>
              </View>
              {/* Media */}
              <View style={s.perfCardOuter}>
                <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perfCardGrad}>
                  <LinearGradient colors={['rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.perfInset} />
                  <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
                  <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
                  <View style={s.perfIconWrap}><Ionicons name="football" size={20} color="#22c55e" /></View>
                  <Text style={s.perfValue}>{avg}</Text>
                  <Text style={s.perfLabel}>{'MEDIA\nULTIME 5'}</Text>
                </LinearGradient>
              </View>
            </View>

            {/* ─── TREND ─── */}
            {last5.length > 0 && (
              <View style={s.perfCardOuter}>
                <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.trendCardGrad}>
                  <LinearGradient colors={['rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.perfInset} />
                  <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
                  <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
                  <Text style={s.sectionLabelInCard}>TREND</Text>
                  <LastFiveIndicator data={last5} label="Punti per sfida" dark />
                </LinearGradient>
              </View>
            )}
          </>
        );
      })()}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },

  // Back row
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: '700', color: colors.accent },

  // Hero
  heroCard: { borderRadius: borderRadius.xl, padding: spacing.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, marginBottom: spacing.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: spacing.md },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 22 },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  ctaIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  enrolledRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: spacing.sm },
  enrolledText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#ef4444' },

  // Live points row
  livePointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 10, marginBottom: spacing.md },
  livePointsLabel: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  livePointsVal: { fontSize: 20, fontWeight: '900', color: '#fff' },

  // Prediction progress
  predProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  predProgressBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' },
  predProgressBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  predProgressText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

  // Performance — identical to league home
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#6B7280', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  perfRow: { flexDirection: 'row', gap: 12 },
  perfCardOuter: {
    flex: 1, borderRadius: 22, borderWidth: 1.5, borderColor: DARK.accent, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10, marginBottom: spacing.sm,
  },
  perfCardGrad: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, overflow: 'hidden' },
  perfInset: { position: 'absolute', top: 0, left: 0, right: 0, height: 40 },
  whiteSweep: { position: 'absolute', top: -20, left: -40, width: '140%', height: '60%', transform: [{ rotate: '-12deg' }], borderRadius: 22, opacity: 0.9 },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 28, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  perfIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  perfValue: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, lineHeight: 32 },
  perfLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center', marginTop: 4, lineHeight: 13 },
  trendCardGrad: { padding: 16, borderRadius: 22, overflow: 'hidden' },
  sectionLabelInCard: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  // Matchup cards
  matchupCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, marginBottom: spacing.md, padding: spacing.lg },
  matchupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  matchupRound: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  matchupFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  matchupCta: { fontSize: 13, fontWeight: '700', color: colors.accent },

  // Shared matchup score
  muScoreRow: { flexDirection: 'row', alignItems: 'center' },
  muPlayer: { flex: 1, alignItems: 'center', gap: 6 },
  muAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  muAvatarMe: { borderWidth: 2, borderColor: colors.accent },
  muAvatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  muName: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' as const },
  muPtsSmall: { fontSize: 18, fontWeight: '800', color: '#fff' },
  muCenter: { alignItems: 'center', paddingHorizontal: 8 },
  muScore: { fontSize: 34, fontWeight: '900', color: 'rgba(255,255,255,0.5)' },
  muSep: { fontSize: 22, fontWeight: '300', color: 'rgba(255,255,255,0.3)' },
  muResult: { fontSize: 11, fontWeight: '700', color: colors.accent, marginTop: 4, textTransform: 'uppercase' as const },
  muVs: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.25)' },

  // LIVE badges
  liveBadgeBig: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,113,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16,185,113,0.4)' } as any,
  liveDotBig: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  liveTextBig: { fontSize: 12, fontWeight: '900', color: '#10B981', letterSpacing: 1 },
  liveBadgeMatch: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,113,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 } as any,
  liveTextMatch: { fontSize: 10, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 },

  // Match cards
  matchCard: { backgroundColor: '#1F4C8F', borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.accent, overflow: 'hidden' as const },
  matchCardLive: { borderColor: '#10B981', borderWidth: 2 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  matchNumBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  matchNum: { fontSize: 10, color: '#fff', fontWeight: '800' },
  competition: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', flex: 1 },
  elapsedBadge: { backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  elapsedText: { fontSize: 12, fontWeight: '700', color: colors.error },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveDotSm: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  teamCol: { flex: 1, flexShrink: 1 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamLogo: { width: 22, height: 22, borderRadius: 11, flexShrink: 0 },
  teamName: { fontSize: 15, color: '#FFFFFF', fontWeight: '700', flex: 1, flexShrink: 1 },
  scoreCol: { width: 80, alignItems: 'center', flexShrink: 0 },
  score: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  vs: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },

  // Predictions row
  predRow: { flexDirection: 'row', alignItems: 'stretch', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  predSide: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  predCorrect: { backgroundColor: 'rgba(16,185,113,0.15)', borderWidth: 1.5, borderColor: 'rgba(16,185,113,0.35)' },
  predWrong: { backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  predPlayer: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  mktBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(59,130,246,0.2)' },
  mktText: { fontSize: 9, fontWeight: '700', color: '#60A5FA' },
  predVal: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  noPred: { fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' },
  hiddenPred: { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.2)' },
  predPts: { fontSize: 13, fontWeight: '800' },
  predVsCol: { width: 30, alignItems: 'center', justifyContent: 'center' },
  predVsText: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.25)' },

  // Groups
  groupCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, marginBottom: spacing.md, padding: spacing.lg },
  groupTitle: { fontSize: 14, fontWeight: '800', color: colors.accent, marginBottom: spacing.sm },
  tblHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tblRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tblCell: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  posNum: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', width: 18 },
  userName: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', flex: 1 },

  // Bracket
  bracketCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, marginBottom: spacing.sm, padding: spacing.md },
  bracketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 4 },
  bracketName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)', flex: 1 },
  bracketScore: { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.5)', width: 50, textAlign: 'right' },

  // Empty
  emptyCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, padding: spacing.xl, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
