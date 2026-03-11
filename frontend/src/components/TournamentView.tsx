/**
 * TournamentView — Renders INSIDE the Home tab when a tournament is selected.
 * Uses the SAME visual components as the league home. No separate navigation.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../api/client';
import { colors, typography, spacing, borderRadius } from '../theme/designSystem';
import { AnimatedSweep, StatusBadge } from './ui';
import { MatchDetailSheet } from './MatchDetailSheet';

const DARK = { accent: '#F5A623', textMuted: 'rgba(255,255,255,0.45)' };

type Tab = 'sfide' | 'groups' | 'bracket';

interface Props {
  tournamentId: string;
}

export function TournamentView({ tournamentId }: Props) {
  const { token, user } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [groupStandings, setGroupStandings] = useState<any[]>([]);
  const [bracket, setBracket] = useState<Record<string, any[]>>({});
  const [myMatchups, setMyMatchups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('sfide');
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
      const [detail, groups, bracketData, matchups] = await Promise.all([
        apiCall<any>(`/tournaments/${tournamentId}`, { token }),
        apiCall<any[]>(`/tournaments/${tournamentId}/groups`, { token }).catch(() => []),
        apiCall<any>(`/tournaments/${tournamentId}/bracket`, { token }).catch(() => ({ bracket: {} })),
        apiCall<any[]>(`/tournaments/${tournamentId}/my-matchups`, { token }).catch(() => []),
      ]);
      setTournament(detail);
      setGroupStandings(groups);
      setBracket(bracketData.bracket || {});
      setMyMatchups(matchups);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, tournamentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

    return (
      <ScrollView contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMatchupLive(activeMatchup.id)} tintColor={colors.accent} />}>
        {/* Back to tournament */}
        <TouchableOpacity style={s.backRow} onPress={closeMatchupLive} data-testid="matchup-back">
          <Ionicons name="arrow-back" size={18} color={colors.accent} />
          <Text style={s.backText}>Torna al torneo</Text>
        </TouchableOpacity>

        {/* Score card — same visual as league points card */}
        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
          <AnimatedSweep />
          <View style={s.heroTop}>
            <View style={s.heroLabelRow}>
              <Ionicons name="flash" size={13} color={DARK.textMuted} />
              <Text style={s.heroLabel}>SFIDA 1 VS 1</Text>
            </View>
            {isLive && <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveText}>LIVE</Text></View>}
          </View>
          <View style={s.muScoreRow}>
            <View style={s.muPlayer}>
              <View style={[s.muAvatar, isMe(mu.user_a_id) && s.muAvatarMe]}><Text style={s.muAvatarText}>{mu.user_a_username.charAt(0).toUpperCase()}</Text></View>
              <Text style={[s.muName, isMe(mu.user_a_id) && { color: colors.accent }]} numberOfLines={1}>{isMe(mu.user_a_id) ? 'Tu' : mu.user_a_username}</Text>
            </View>
            <View style={s.muCenter}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={[s.muScore, aWin && { color: '#fff' }]}>{user_a_total.toFixed(1)}</Text>
                <Text style={s.muSep}>-</Text>
                <Text style={[s.muScore, bWin && { color: '#fff' }]}>{user_b_total.toFixed(1)}</Text>
              </View>
              <Text style={s.muResult}>{matchupLiveData.round.label}</Text>
            </View>
            <View style={s.muPlayer}>
              <View style={[s.muAvatar, isMe(mu.user_b_id) && s.muAvatarMe]}><Text style={s.muAvatarText}>{mu.user_b_username.charAt(0).toUpperCase()}</Text></View>
              <Text style={[s.muName, isMe(mu.user_b_id) && { color: colors.accent }]} numberOfLines={1}>{isMe(mu.user_b_id) ? 'Tu' : mu.user_b_username}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Matches — SAME style as league live cards */}
        {matches.map((md: any, idx: number) => {
          const m = md.match;
          const mLive = m.status === 'live';
          const mDone = m.status === 'finished';
          const show = mDone || mLive;
          return (
            <TouchableOpacity key={m.id || idx} style={[s.matchCard, mLive && s.matchCardLive]} activeOpacity={m.external_fixture_id ? 0.7 : 1} onPress={() => m.external_fixture_id && setDetailFixtureId(m.external_fixture_id)} data-testid={`match-${idx}`}>
              <AnimatedSweep />
              <View style={s.matchHeader}>
                <View style={s.matchNumBadge}><Text style={s.matchNum}>{idx + 1}</Text></View>
                <Text style={s.competition}>{m.competition || ''}</Text>
                {mLive && m.elapsed != null && <View style={s.elapsedBadge}><Text style={s.elapsedText}>{m.elapsed}'</Text></View>}
                <View style={[s.statusBadge, { backgroundColor: mLive ? colors.success : mDone ? 'rgba(255,255,255,0.4)' : colors.info }]}>
                  {mLive && <View style={s.liveDotSm} />}
                  <Text style={s.statusText}>{mLive ? 'LIVE' : mDone ? 'FT' : 'SCH'}</Text>
                </View>
                {m.external_fixture_id && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 'auto' }} />}
              </View>
              <View style={s.teamsRow}>
                <View style={s.teamCol}>
                  <View style={s.teamNameRow}>
                    {m.home_logo && <Image source={{ uri: m.home_logo }} style={s.teamLogo} />}
                    <Text style={s.teamName} numberOfLines={1}>{m.home_team}</Text>
                  </View>
                </View>
                <View style={s.scoreCol}>
                  {m.home_score !== null ? <Text style={[s.score, mLive && { color: colors.success }]}>{m.home_score} - {m.away_score}</Text> : <Text style={s.vs}>vs</Text>}
                </View>
                <View style={s.teamCol}>
                  <View style={[s.teamNameRow, { justifyContent: 'flex-end' }]}>
                    <Text style={[s.teamName, { textAlign: 'right' }]} numberOfLines={1}>{m.away_team}</Text>
                    {m.away_logo && <Image source={{ uri: m.away_logo }} style={s.teamLogo} />}
                  </View>
                </View>
              </View>
              {/* Pronostici affiancati */}
              <View style={s.predRow}>
                <View style={[s.predSide, md.user_a_points > 0 && s.predCorrect]}>
                  <Text style={s.predPlayer}>{isMe(mu.user_a_id) ? 'Tu' : mu.user_a_username.slice(0, 8)}</Text>
                  {show && md.user_a_prediction ? (
                    <><View style={s.mktBadge}><Text style={s.mktText}>{formatMarket(md.user_a_market)}</Text></View><Text style={s.predVal}>{md.user_a_prediction}</Text></>
                  ) : show ? <Text style={s.noPred}>—</Text> : <Text style={s.hiddenPred}>?</Text>}
                  {show && <Text style={[s.predPts, { color: md.user_a_points > 0 ? colors.success : colors.error }]}>{md.user_a_points > 0 ? `+${md.user_a_points.toFixed(1)}` : '0'}</Text>}
                </View>
                <View style={s.predVsCol}><Text style={s.predVsText}>VS</Text></View>
                <View style={[s.predSide, md.user_b_points > 0 && s.predCorrect]}>
                  <Text style={s.predPlayer}>{isMe(mu.user_b_id) ? 'Tu' : mu.user_b_username.slice(0, 8)}</Text>
                  {show && md.user_b_prediction ? (
                    <><View style={s.mktBadge}><Text style={s.mktText}>{formatMarket(md.user_b_market)}</Text></View><Text style={s.predVal}>{md.user_b_prediction}</Text></>
                  ) : show ? <Text style={s.noPred}>—</Text> : <Text style={s.hiddenPred}>?</Text>}
                  {show && <Text style={[s.predPts, { color: md.user_b_points > 0 ? colors.success : colors.error }]}>{md.user_b_points > 0 ? `+${md.user_b_points.toFixed(1)}` : '0'}</Text>}
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
  return (
    <ScrollView contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accent} />}>
      {/* Hero card */}
      <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
        <AnimatedSweep />
        <View style={s.heroTop}>
          <View style={s.heroLabelRow}><Ionicons name="trophy" size={13} color={DARK.textMuted} /><Text style={s.heroLabel}>TORNEO</Text></View>
          <StatusBadge status={t.status === 'registration' ? 'OPEN' : (t.status === 'groups' || t.status === 'knockout') ? 'LIVE' : 'COMPLETED'} label={statusLabels[t.status] || t.status} />
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
          <View style={s.enrolledRow}><Ionicons name="checkmark-circle" size={16} color={colors.success} /><Text style={s.enrolledText}>Sei iscritto</Text></View>
        )}
      </LinearGradient>

      {/* Tab bar */}
      {hasGroups && (
        <View style={s.tabBar}>
          {(['sfide', 'groups', 'bracket'] as Tab[]).map(tab => {
            const labels: Record<Tab, string> = { sfide: 'Le mie sfide', groups: 'Gironi', bracket: 'Tabellone' };
            const icons: Record<Tab, string> = { sfide: 'flash', groups: 'grid', bracket: 'git-network' };
            const isActive = activeTab === tab;
            const disabled = tab === 'bracket' && t.status === 'groups';
            return (
              <TouchableOpacity key={tab} style={[s.tabItem, isActive && s.tabItemActive]} onPress={() => !disabled && setActiveTab(tab)} disabled={disabled} data-testid={`tab-${tab}`}>
                <Ionicons name={icons[tab] as any} size={16} color={isActive ? colors.accent : disabled ? 'rgba(0,0,0,0.2)' : colors.textSecondary} />
                <Text style={[s.tabLabel, isActive && s.tabLabelActive, disabled && { color: 'rgba(0,0,0,0.2)' }]}>{labels[tab]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* LE MIE SFIDE */}
      {activeTab === 'sfide' && hasGroups && myMatchups.map(mu => {
        const isA = mu.user_a_id === user?.id;
        const opp = isA ? mu.user_b_username : mu.user_a_username;
        const myPts = isA ? mu.user_a_points : mu.user_b_points;
        const oppPts = isA ? mu.user_b_points : mu.user_a_points;
        const won = mu.result === (isA ? 'user_a_win' : 'user_b_win');
        const lost = mu.result === (isA ? 'user_b_win' : 'user_a_win');
        const isDone = mu.status === 'completed';
        const rl: Record<string, string> = { group: 'Girone', quarterfinal: 'Quarti', semifinal: 'Semi', final: 'Finale' };
        return (
          <TouchableOpacity key={mu.id} onPress={() => openMatchupLive(mu)} data-testid={`matchup-${mu.id}`}>
            <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.matchupCard}>
              <AnimatedSweep />
              <View style={s.matchupHeader}><Text style={s.matchupRound}>{rl[mu.round_type] || mu.round_type} - Round {mu.round_number}</Text>
                {isDone && won && <View style={[s.badge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}><Text style={[s.badgeText, { color: colors.success }]}>VITTORIA</Text></View>}
                {isDone && lost && <View style={[s.badge, { backgroundColor: 'rgba(239,68,68,0.2)' }]}><Text style={[s.badgeText, { color: colors.error }]}>SCONFITTA</Text></View>}
                {isDone && mu.result === 'draw' && <View style={[s.badge, { backgroundColor: 'rgba(245,166,35,0.2)' }]}><Text style={[s.badgeText, { color: colors.accent }]}>PAREGGIO</Text></View>}
                {!isDone && <View style={[s.badge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}><Text style={[s.badgeText, { color: colors.success }]}>IN CORSO</Text></View>}
              </View>
              <View style={s.muScoreRow}>
                <View style={s.muPlayer}><View style={[s.muAvatar, s.muAvatarMe]}><Text style={s.muAvatarText}>{user?.username?.charAt(0)?.toUpperCase() || 'T'}</Text></View><Text style={[s.muName, { color: colors.accent }]}>Tu</Text><Text style={s.muPtsSmall}>{myPts.toFixed(1)}</Text></View>
                <View style={s.muCenter}><Text style={s.muVs}>VS</Text></View>
                <View style={s.muPlayer}><View style={s.muAvatar}><Text style={s.muAvatarText}>{opp.charAt(0).toUpperCase()}</Text></View><Text style={s.muName}>{opp}</Text><Text style={s.muPtsSmall}>{oppPts.toFixed(1)}</Text></View>
              </View>
              <View style={s.matchupFooter}><Text style={s.matchupCta}>Vedi sfida</Text><Ionicons name="chevron-forward" size={16} color={colors.accent} /></View>
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
      {activeTab === 'sfide' && hasGroups && myMatchups.length === 0 && (
        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCard}>
          <AnimatedSweep /><Ionicons name="flash-outline" size={40} color={DARK.textMuted} /><Text style={s.emptyTitle}>Nessuna sfida ancora</Text>
        </LinearGradient>
      )}

      {/* GIRONI */}
      {activeTab === 'groups' && hasGroups && groupStandings.map(g => (
        <LinearGradient key={g.group_id} colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.groupCard}>
          <AnimatedSweep />
          <Text style={s.groupTitle}>Girone {g.group_name}</Text>
          <View style={s.tblHeader}><Text style={[s.tblCell, { flex: 2.5, textAlign: 'left' }]}>#</Text><Text style={s.tblCell}>G</Text><Text style={s.tblCell}>V</Text><Text style={s.tblCell}>P</Text><Text style={s.tblCell}>S</Text><Text style={[s.tblCell, { fontWeight: '800' }]}>PT</Text></View>
          {g.standings.map((st: any, idx: number) => {
            const q = idx < tournament.advance_count;
            const me = st.user_id === user?.id;
            return (
              <View key={st.user_id} style={[s.tblRow, q && { borderLeftWidth: 3, borderLeftColor: colors.success, paddingLeft: 6 }, me && { backgroundColor: 'rgba(245,166,35,0.1)' }]}>
                <View style={[s.tblCell, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 6 }]}><Text style={s.posNum}>{idx + 1}</Text><Text style={[s.userName, me && { color: colors.accent }]} numberOfLines={1}>{st.username}</Text></View>
                <Text style={s.tblCell}>{st.played}</Text><Text style={[s.tblCell, { color: colors.success }]}>{st.wins}</Text><Text style={s.tblCell}>{st.draws}</Text><Text style={[s.tblCell, { color: colors.error }]}>{st.losses}</Text><Text style={[s.tblCell, { fontWeight: '800', color: '#fff' }]}>{st.group_points}</Text>
              </View>
            );
          })}
        </LinearGradient>
      ))}
      {activeTab === 'groups' && hasGroups && groupStandings.length === 0 && (
        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCard}><AnimatedSweep /><Ionicons name="grid-outline" size={40} color={DARK.textMuted} /><Text style={s.emptyTitle}>Gironi non ancora generati</Text></LinearGradient>
      )}

      {/* TABELLONE */}
      {activeTab === 'bracket' && hasGroups && Object.entries(bracket).map(([phase, matchups]) => (
        <View key={phase}>
          <Text style={s.sectionLabel}>{phase.toUpperCase()}</Text>
          {matchups.map((mu: any) => {
            const aW = mu.result === 'user_a_win'; const bW = mu.result === 'user_b_win';
            return (
              <TouchableOpacity key={mu.id} onPress={() => openMatchupLive(mu)} data-testid={`bracket-${mu.id}`}>
                <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bracketCard}>
                  <AnimatedSweep />
                  <View style={[s.bracketRow, aW && { borderLeftWidth: 3, borderLeftColor: colors.success }]}><Text style={[s.bracketName, aW && { color: '#fff', fontWeight: '800' }]}>{mu.user_a_username}</Text><Text style={[s.bracketScore, aW && { color: colors.success }]}>{mu.user_a_points.toFixed(1)}</Text></View>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                  <View style={[s.bracketRow, bW && { borderLeftWidth: 3, borderLeftColor: colors.success }]}><Text style={[s.bracketName, bW && { color: '#fff', fontWeight: '800' }]}>{mu.user_b_username}</Text><Text style={[s.bracketScore, bW && { color: colors.success }]}>{mu.user_b_points.toFixed(1)}</Text></View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {activeTab === 'bracket' && hasGroups && Object.keys(bracket).length === 0 && (
        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCard}><AnimatedSweep /><Ionicons name="git-network-outline" size={40} color={DARK.textMuted} /><Text style={s.emptyTitle}>Tabellone non ancora generato</Text></LinearGradient>
      )}
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

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 3, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E5E7EB' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: borderRadius.md },
  tabItemActive: { backgroundColor: colors.accent + '15' },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  tabLabelActive: { color: colors.accent, fontWeight: '700' },
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
  muPlayer: { flex: 1, alignItems: 'center', gap: 4 },
  muAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  muAvatarMe: { borderWidth: 2, borderColor: colors.accent },
  muAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  muName: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  muPtsSmall: { fontSize: 18, fontWeight: '800', color: '#fff' },
  muCenter: { alignItems: 'center', paddingHorizontal: 12 },
  muScore: { fontSize: 28, fontWeight: '900', color: 'rgba(255,255,255,0.6)' },
  muSep: { fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.3)' },
  muResult: { fontSize: 10, fontWeight: '700', color: colors.accent, marginTop: 4 },
  muVs: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.25)' },

  // Match cards (same as league live)
  matchCard: { backgroundColor: '#1F4C8F', borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.accent, overflow: 'hidden' },
  matchCardLive: { borderColor: colors.success, borderWidth: 2 },
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
  teamName: { fontSize: 14, color: '#fff', fontWeight: '600', flex: 1, flexShrink: 1 },
  scoreCol: { width: 80, alignItems: 'center', flexShrink: 0 },
  score: { fontSize: 20, fontWeight: '800', color: '#fff' },
  vs: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },

  // Predictions row
  predRow: { flexDirection: 'row', alignItems: 'stretch', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  predSide: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  predCorrect: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  predPlayer: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  mktBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(59,130,246,0.2)' },
  mktText: { fontSize: 9, fontWeight: '700', color: '#60A5FA' },
  predVal: { fontSize: 14, fontWeight: '700', color: '#fff' },
  noPred: { fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' },
  hiddenPred: { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.2)' },
  predPts: { fontSize: 12, fontWeight: '700' },
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
