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
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useCompetition } from '../contexts/CompetitionContext';
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
  const { setCurrentRoundInfo, pendingMatchupOpen, setPendingMatchupOpen } = useCompetition();
  const [tournament, setTournament] = useState<any>(null);
  const [myMatchups, setMyMatchups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Matchup live state — renders INLINE, not in a separate page
  const [activeMatchup, setActiveMatchup] = useState<any>(null);
  const [matchupLiveData, setMatchupLiveData] = useState<any>(null);
  const [matchupLoading, setMatchupLoading] = useState(false);
  const [detailFixtureId, setDetailFixtureId] = useState<number | null>(null);
  const [groups, setGroups] = useState<any>(null);
  const liveInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!token || !tournamentId) return;
    try {
      const [detail, matchups, groupsData] = await Promise.all([
        apiCall<any>(`/tournaments/${tournamentId}`, { token }),
        apiCall<any[]>(`/tournaments/${tournamentId}/my-matchups`, { token }).catch(() => []),
        apiCall<any>(`/tournaments/${tournamentId}/groups`, { token }).catch(() => ({})),
      ]);
      setTournament(detail);
      setMyMatchups(matchups);
      setGroups(groupsData);
      // Sync current round info to context for Pronostici tab routing
      if (detail?.current_round_info) setCurrentRoundInfo(detail.current_round_info);
    } catch (_) { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, tournamentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch when screen gains focus (e.g. returning from predictions)
  useFocusEffect(
    useCallback(() => { fetchData(); }, [fetchData])
  );

  // Countdown timer for OPEN rounds
  useEffect(() => {
    const cri = tournament?.current_round_info;
    if (!cri || cri.status !== 'OPEN' || !cri.countdown_seconds) return;
    setCountdown(cri.countdown_seconds);
    const interval = setInterval(() => setCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [tournament?.current_round_info?.countdown_seconds, tournament?.current_round_info?.status]);

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
    } catch (_) { /* silent */ }
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

  // Handle pending matchup open from Pronostici tab navigation
  useEffect(() => {
    if (pendingMatchupOpen && !loading && tournament) {
      openMatchupLive({ id: pendingMatchupOpen });
      setPendingMatchupOpen(null);
    }
  }, [pendingMatchupOpen, loading, tournament]);

  const joinTournament = async () => {
    if (!token) return;
    setJoining(true);
    try { await apiCall(`/tournaments/${tournamentId}/register`, { method: 'POST', token }); fetchData(); }
    catch (_) { /* silent */ }
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

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const sec = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
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
                <Text style={[s.muScore, aWin && { color: '#10B981' }, !aWin && !bWin && { color: '#fff' }]}>{Math.round(user_a_total).toString()}</Text>
                <Text style={s.muSep}>-</Text>
                <Text style={[s.muScore, bWin && { color: '#10B981' }, !aWin && !bWin && { color: '#fff' }]}>{Math.round(user_b_total).toString()}</Text>
              </View>
              <Text style={s.muResult}>{matchupLiveData.round.label}</Text>
            </View>
            <View style={s.muPlayer}>
              <View style={[s.muAvatar, isMe(mu.user_b_id) && s.muAvatarMe, bWin && { borderColor: '#10B981', borderWidth: 2 }]}><Text style={s.muAvatarText}>{mu.user_b_username.charAt(0).toUpperCase()}</Text></View>
              <Text style={[s.muName, isMe(mu.user_b_id) && { color: colors.accent }]} numberOfLines={1}>{bName}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ═══ TIEBREAK INDICATOR ═══ */}
        {mu.tiebreak_reason && mu.status === 'completed' && (
          <View style={{ marginTop: -6, marginBottom: 12, alignSelf: 'center', backgroundColor: 'rgba(245,166,35,0.12)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)' }} data-testid="tiebreak-indicator">
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#F5A623', textAlign: 'center' }}>
              {mu.tiebreak_reason === 'total_correct_predictions' ? 'Vince per tiebreak: piu pronostici indovinati'
                : mu.tiebreak_reason === 'exact_score_hits' ? 'Vince per tiebreak: piu risultati esatti'
                : mu.tiebreak_reason === 'one_x_two_hits' ? 'Vince per tiebreak: piu 1X2 corretti'
                : 'Vince per tiebreak: sorteggio'}
            </Text>
          </View>
        )}

        {/* ═══ 2. MATCH CARDS ═══ */}
        {matches.map((md: any, idx: number) => {
          const m = md.match;
          const mLive = m.status === 'live';
          const mDone = m.status === 'finished';
          const show = mDone || mLive;
          const aPts = md.user_a_points || 0;
          const bPts = md.user_b_points || 0;
          return (
            <TouchableOpacity key={m.id || idx} style={[s.matchCard, mLive && s.matchCardLive, m.is_special && s.matchCardSpecial]} activeOpacity={m.external_fixture_id ? 0.7 : 1} onPress={() => m.external_fixture_id && setDetailFixtureId(m.external_fixture_id)} data-testid={`match-${idx}`}>
              <AnimatedSweep />
              {/* BOOST X3 compact banner */}
              {m.is_special && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 14, marginHorizontal: -16, marginTop: -16, marginBottom: 6, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#F5A623' }}>
                  <Ionicons name="flash" size={12} color="#0D2240" />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#0D2240', letterSpacing: 1.5 }}>BOOST X3</Text>
                </View>
              )}
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
                        <Text style={[s.predPts, { color: aPts > 0 ? '#10B981' : '#ef4444' }]}>{aPts > 0 ? `+${Math.round(aPts).toString()}` : '0'}</Text>
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
                        <Text style={[s.predPts, { color: bPts > 0 ? '#10B981' : '#ef4444' }]}>{bPts > 0 ? `+${Math.round(bPts).toString()}` : '0'}</Text>
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
              <Text style={s.heroLabel}>{cri.label?.toUpperCase() || 'SFIDA TORNEO'}</Text>
            </View>
            <StatusBadge
              status={cri.status === 'OPEN' ? 'OPEN' : cri.status === 'LIVE' ? 'LIVE' : cri.status === 'PENDING' ? 'LOCKED' : 'COMPLETED'}
              label={cri.status === 'OPEN' ? 'PRONOSTICI APERTI' : cri.status === 'LIVE' ? 'LIVE' : cri.status === 'PENDING' ? 'IN PREPARAZIONE' : 'COMPLETATA'}
            />
          </View>

          {/* PRIMARY METRIC: match score for LIVE/COMPLETED */}
          {(cri.status === 'LIVE' || cri.status === 'COMPLETED') && cri.opponent_name ? (
            <>
              <View style={s.heroPrimaryWrap}>
                <Text style={s.heroPrimaryMetric} data-testid="tournament-primary-score">
                  {cri.my_points} – {cri.opp_points}
                </Text>
                <Text style={s.heroContextMsg} data-testid="tournament-context-msg">
                  {cri.my_points > cri.opp_points ? 'Hai vinto' : cri.my_points < cri.opp_points ? 'Hai perso' : 'Hai pareggiato'}
                </Text>
                <Text style={s.heroPrimaryLabel}>VS {cri.opponent_name.toUpperCase()}</Text>
              </View>

              {/* Live points badge */}
              {cri.status === 'LIVE' && cri.live_total !== null && (
                <View style={s.livePointsRow}>
                  <Text style={s.livePointsLabel}>I tuoi punti live</Text>
                  <Text style={s.livePointsVal}>{cri.live_total}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* OPEN/PENDING: opponent PRIMARY, countdown secondary, title tertiary */}
              {cri.opponent_name ? (
                <Text style={s.heroOpponentPrimary}>VS {cri.opponent_name.toUpperCase()}</Text>
              ) : (
                <Text style={s.heroOpponentPrimary}>{t.registered_count}/{t.max_participants} partecipanti</Text>
              )}

              {/* Countdown timer — secondary */}
              {cri.status === 'OPEN' && countdown > 0 && (
                <Text style={s.heroCountdownSec}>Scadenza tra {formatCountdown(countdown)}</Text>
              )}

              {/* Matchday label — tertiary */}
              <Text style={s.heroTitleTertiary}>{cri.label}</Text>

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
            </>
          )}

          {/* CTA button — identical to league */}
          {cri.status !== 'PENDING' && (
          <TouchableOpacity onPress={handleHeroCta} data-testid="tournament-hero-cta">
            <LinearGradient
              colors={cri.status === 'LIVE' ? ['#10B981', '#059669'] : ['#F7A21B', '#E88E00']}
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

      {/* ═══ MINI CLASSIFICA TORNEO ═══ */}
      {groups && Array.isArray(groups) && groups.length > 0 && (() => {
        const myGroup = groups.find((g: any) => g.standings?.some((s: any) => s.user_id === user?.id));
        if (!myGroup || !myGroup.standings?.length) return null;
        const top3 = myGroup.standings.slice(0, 3);
        return (
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
              <Text style={s.miniRankTitle}>CLASSIFICA {myGroup.group_name ? myGroup.group_name.toUpperCase() : 'GIRONE'}</Text>
              {top3.map((entry: any, i: number) => {
                const isMe = entry.user_id === user?.id;
                return (
                  <View key={i} style={s.miniRankRow}>
                    <Text style={[s.miniRankPos, i === 0 && { color: '#F7A21B' }]}>{`${i + 1}°`}</Text>
                    <Text style={[s.miniRankName, isMe && { color: '#F7A21B', fontWeight: '700' }]} numberOfLines={1}>{entry.username}</Text>
                    <Text style={s.miniRankPts}>{entry.group_points} pts</Text>
                  </View>
                );
              })}
              <View style={s.miniRankCtaRow}>
                <Text style={s.miniRankCta}>Vedi classifica</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        );
      })()}

      {/* ═══ PERFORMANCE ═══ */}
      {hasGroups && myMatchups.length > 0 && (() => {
        const completed = myMatchups.filter((m: any) => m.status === 'completed');
        const isA = (m: any) => m.user_a_id === user?.id;
        const wins = completed.filter((m: any) => m.result === (isA(m) ? 'user_a_win' : 'user_b_win')).length;
        const totalPts = completed.reduce((acc: number, m: any) => {
          const pts = isA(m) ? (m.user_a_prediction_total ?? m.user_a_points) : (m.user_b_prediction_total ?? m.user_b_points);
          return acc + pts;
        }, 0);
        const avg = completed.length > 0 ? Math.round(totalPts / completed.length).toString() : '-';
        return (
          <View>
            <Text style={s.sectionLabel}>PERFORMANCE</Text>
            <View style={s.perfRow}>
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
              <View style={s.perfCardOuter}>
                <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perfCardGrad}>
                  <LinearGradient colors={['rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.perfInset} />
                  <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
                  <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
                  <View style={s.perfIconWrap}><Ionicons name="star" size={20} color="#fff" /></View>
                  <Text style={s.perfValue}>{Math.round(totalPts).toString()}</Text>
                  <Text style={s.perfLabel}>{'PUNTI\nTOTALI'}</Text>
                </LinearGradient>
              </View>
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
          </View>
        );
      })()}

      {/* ═══ ULTIME 5 SFIDE ═══ */}
      {hasGroups && myMatchups.length > 0 && (() => {
        const completed = myMatchups.filter((m: any) => m.status === 'completed');
        const isA = (m: any) => m.user_a_id === user?.id;
        const last5 = completed.slice(-5).map((m: any) => {
          const ia = isA(m);
          const result = m.result === 'draw' ? 'P' : (m.result === 'user_a_win' ? (ia ? 'V' : 'S') : (ia ? 'S' : 'V'));
          return { result, matchday_number: m.round_number };
        });
        if (last5.length === 0) return null;
        return (
          <LinearGradient
            colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.last5Card}
          >
            <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
            <LinearGradient colors={['rgba(255,255,255,0.10)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.topGlow} />
            <Text style={s.last5Title}>ULTIME 5 SFIDE</Text>
            <View style={s.last5Row}>
              {last5.map((item: any, i: number) => (
                <View key={i} style={s.last5PillWrap}>
                  <View style={[s.last5Pill, item.result === 'V' && s.last5PillWin, item.result === 'S' && s.last5PillLoss, item.result === 'P' && s.last5PillDraw]}>
                    <Text style={[s.last5PillPts, item.result === 'V' && s.last5PillPtsWin, item.result === 'S' && s.last5PillPtsLoss]}>{item.result}</Text>
                  </View>
                  <Text style={s.last5PillMd}>{item.matchday_number}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        );
      })()}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80, gap: 24 },

  // Back row
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, fontWeight: '700', color: colors.accent },

  // Hero
  heroCard: { borderRadius: 22, padding: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: '#F5A623', shadowColor: '#162F5C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: spacing.md },
  heroOpponentPrimary: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  heroCountdownSec: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroTitleTertiary: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 12,
  },

  // Primary metric (match score for tournament)
  heroPrimaryWrap: { alignItems: 'center', marginVertical: 16 },
  heroPrimaryMetric: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: -2, lineHeight: 58 },
  heroPrimaryLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 2, marginTop: 4 },
  heroContextMsg: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 8, marginBottom: 2 },

  // Last 5 pills
  last5Card: { marginHorizontal: 16, marginTop: 16, borderRadius: 22, padding: 18, overflow: 'hidden' },
  last5Title: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, marginBottom: 14 },
  last5Row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  last5PillWrap: { flex: 1, alignItems: 'center', gap: 6 },
  last5Pill: { width: '100%', paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  last5PillActive: { backgroundColor: 'rgba(16, 185, 113, 0.2)' },
  last5PillWin: { backgroundColor: 'rgba(16, 185, 113, 0.2)' },
  last5PillLoss: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  last5PillDraw: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  last5PillPts: { fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.4)' },
  last5PillPtsWin: { color: '#10B981' },
  last5PillPtsLoss: { color: '#EF4444' },
  last5PillPtsActive: { color: '#F7A21B' },
  last5PillMd: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },

  // Mini ranking block
  miniRankCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 22, padding: 18, overflow: 'hidden' },
  miniRankTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, marginBottom: 14 },
  miniRankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  miniRankPos: { width: 32, fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)' },
  miniRankName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  miniRankPts: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  miniRankCtaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, gap: 4 },
  miniRankCta: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },

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
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10,
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

  matchCard: { backgroundColor: '#1F4C8F', borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.accent, overflow: 'hidden' as const },
  matchCardLive: { borderColor: '#10B981', borderWidth: 2 },
  matchCardSpecial: { borderWidth: 0, borderColor: 'transparent', backgroundColor: '#0D2240', shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16 } as any,
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
