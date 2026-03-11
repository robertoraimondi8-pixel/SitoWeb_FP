/**
 * Tournament Detail — FantaPronostic
 * Stessa struttura visiva della home lega: card navy, gradienti, accent borders.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';
import { AnimatedSweep, StatusBadge } from '../../src/components/ui';
import { SideMenu } from '../../src/components/SideMenu';

const DARK = { accent: '#F5A623', textMuted: 'rgba(255,255,255,0.45)' };

type Tab = 'info' | 'sfide' | 'groups' | 'bracket';

type TournamentDetail = {
  id: string; name: string; status: string;
  max_participants: number; duration_rounds: number;
  groups_count: number; players_per_group: number;
  advance_count: number; entry_fee: number;
  current_round: number; registered_count: number;
  spots_left: number; is_registered: boolean;
  rounds?: any[];
};
type GroupData = {
  group_name: string; group_id: string;
  standings: Array<{
    user_id: string; username: string; played: number;
    wins: number; draws: number; losses: number;
    group_points: number; prediction_points: number;
  }>;
};
type Matchup = {
  id: string; round_type: string; round_number: number;
  user_a_id: string; user_b_id: string;
  user_a_username: string; user_b_username: string;
  user_a_points: number; user_b_points: number;
  result: string; status: string; winner_id: string | null;
};

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [groupStandings, setGroupStandings] = useState<GroupData[]>([]);
  const [bracket, setBracket] = useState<Record<string, Matchup[]>>({});
  const [myMatchups, setMyMatchups] = useState<Matchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [joining, setJoining] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [detail, groups, bracketData, matchups] = await Promise.all([
        apiCall<TournamentDetail>(`/tournaments/${id}`, { token }),
        apiCall<GroupData[]>(`/tournaments/${id}/groups`, { token }).catch(() => []),
        apiCall<{ bracket: Record<string, Matchup[]> }>(`/tournaments/${id}/bracket`, { token }).catch(() => ({ bracket: {} })),
        apiCall<Matchup[]>(`/tournaments/${id}/my-matchups`, { token }).catch(() => []),
      ]);
      setTournament(detail);
      setGroupStandings(groups);
      setBracket(bracketData.bracket || {});
      setMyMatchups(matchups);
      if ((detail.status === 'groups' || detail.status === 'knockout') && matchups.length > 0) {
        setActiveTab('sfide');
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const joinTournament = async () => {
    if (!token || !id) return;
    setJoining(true);
    try {
      await apiCall(`/tournaments/${id}/register`, { method: 'POST', token });
      fetchData();
    } catch (e) { console.error(e); }
    finally { setJoining(false); }
  };

  const leaveTournament = async () => {
    if (!token || !id) return;
    setJoining(true);
    try {
      await apiCall(`/tournaments/${id}/unregister`, { method: 'POST', token });
      fetchData();
    } catch (e) { console.error(e); }
    finally { setJoining(false); }
  };

  if (loading || !tournament) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      </SafeAreaView>
    );
  }

  const t = tournament;
  const hasGroups = t.status !== 'draft' && t.status !== 'registration';
  const statusLabels: Record<string, string> = {
    draft: 'BOZZA', registration: 'ISCRIZIONI APERTE', groups: 'FASE A GIRONI', knockout: 'ELIMINAZIONE DIRETTA', completed: 'CONCLUSO'
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Header — same as league home */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerIcon} onPress={() => setMenuOpen(true)} testID="hamburger-menu-btn">
          <Ionicons name="menu" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>FantaPronostic</Text>
        </View>
        <TouchableOpacity style={s.headerIcon} onPress={() => router.back()} data-testid="tournament-back-btn">
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accent} />}
      >
        {/* ─── HERO CARD (same style as league matchday card) ─── */}
        <LinearGradient
          colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          <LinearGradient colors={['rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.1, y: 0.0 }} end={{ x: 0.9, y: 1.0 }} style={s.whiteSweep} />
          <AnimatedSweep />

          <View style={s.heroTop}>
            <View style={s.heroLabelRow}>
              <Ionicons name="trophy" size={13} color={DARK.textMuted} />
              <Text style={s.heroLabel}>TORNEO</Text>
            </View>
            <StatusBadge status={t.status === 'registration' ? 'OPEN' : t.status === 'groups' ? 'LIVE' : t.status === 'knockout' ? 'LIVE' : 'COMPLETED'} label={statusLabels[t.status] || t.status} />
          </View>

          <Text style={s.heroTitle}>{t.name}</Text>
          <Text style={s.heroSub}>
            {t.registered_count}/{t.max_participants} iscritti  &bull;  {t.groups_count} gironi da {t.players_per_group}  &bull;  {t.duration_rounds} round
          </Text>

          {/* Registration CTA */}
          {t.status === 'registration' && !t.is_registered && (
            <TouchableOpacity style={s.ctaBtn} onPress={joinTournament} disabled={joining} data-testid="join-tournament-btn">
              <LinearGradient colors={['#F7A21B', '#E88E00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaGrad}>
                {joining ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Text style={s.ctaText}>Iscriviti al Torneo</Text>
                    <View style={s.ctaIconCircle}><Ionicons name="arrow-forward" size={18} color="#fff" /></View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {t.is_registered && t.status === 'registration' && (
            <View style={s.enrolledBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={s.enrolledText}>Sei iscritto a questo torneo</Text>
              <TouchableOpacity onPress={leaveTournament} disabled={joining}>
                <Text style={s.leaveText}>Esci</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* ─── STATS ROW (same as Performance cards) ─── */}
        {hasGroups && (
          <View style={s.perfRow}>
            <View style={s.perfCardOuter}>
              <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perfCardGrad}>
                <AnimatedSweep />
                <View style={s.perfIconWrap}><Ionicons name="grid" size={20} color={DARK.accent} /></View>
                <Text style={s.perfValue}>{t.groups_count}x{t.players_per_group}</Text>
                <Text style={s.perfLabel}>GIRONI</Text>
              </LinearGradient>
            </View>
            <View style={s.perfCardOuter}>
              <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perfCardGrad}>
                <AnimatedSweep />
                <View style={s.perfIconWrap}><Ionicons name="people" size={20} color="#fff" /></View>
                <Text style={s.perfValue}>{t.registered_count}</Text>
                <Text style={s.perfLabel}>ISCRITTI</Text>
              </LinearGradient>
            </View>
            <View style={s.perfCardOuter}>
              <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.perfCardGrad}>
                <AnimatedSweep />
                <View style={s.perfIconWrap}><Ionicons name="football" size={20} color={colors.success} /></View>
                <Text style={s.perfValue}>{t.current_round}</Text>
                <Text style={s.perfLabel}>ROUND</Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* ─── TAB BAR ─── */}
        {hasGroups && (
          <View style={s.tabBar}>
            {(['sfide', 'groups', 'bracket'] as Tab[]).map(tab => {
              const labels: Record<Tab, string> = { info: 'Info', sfide: 'Le mie sfide', groups: 'Gironi', bracket: 'Tabellone' };
              const icons: Record<Tab, string> = { info: 'information-circle', sfide: 'flash', groups: 'grid', bracket: 'git-network' };
              const isActive = activeTab === tab;
              const disabled = tab === 'bracket' && t.status === 'groups';
              return (
                <TouchableOpacity
                  key={tab}
                  style={[s.tabItem, isActive && s.tabItemActive]}
                  onPress={() => !disabled && setActiveTab(tab)}
                  disabled={disabled}
                  data-testid={`tab-${tab}`}
                >
                  <Ionicons name={icons[tab] as any} size={16} color={isActive ? colors.accent : disabled ? 'rgba(0,0,0,0.2)' : colors.textSecondary} />
                  <Text style={[s.tabLabel, isActive && s.tabLabelActive, disabled && { color: 'rgba(0,0,0,0.2)' }]}>
                    {labels[tab]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── LE MIE SFIDE (matchup cards — navy style) ─── */}
        {activeTab === 'sfide' && hasGroups && (
          <>
            {myMatchups.length === 0 ? (
              <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCard}>
                <AnimatedSweep />
                <Ionicons name="flash-outline" size={40} color={DARK.textMuted} />
                <Text style={s.emptyTitle}>Nessuna sfida ancora</Text>
                <Text style={s.emptySub}>Le sfide verranno generate quando il torneo inizia</Text>
              </LinearGradient>
            ) : (
              myMatchups.map(mu => {
                const isA = mu.user_a_id === user?.id;
                const opponent = isA ? mu.user_b_username : mu.user_a_username;
                const myPts = isA ? mu.user_a_points : mu.user_b_points;
                const oppPts = isA ? mu.user_b_points : mu.user_a_points;
                const won = mu.result === (isA ? 'user_a_win' : 'user_b_win');
                const lost = mu.result === (isA ? 'user_b_win' : 'user_a_win');
                const isDone = mu.status === 'completed';
                const roundLabels: Record<string, string> = { group: 'Girone', quarterfinal: 'Quarti', semifinal: 'Semi', final: 'Finale' };
                return (
                  <TouchableOpacity
                    key={mu.id}
                    onPress={() => router.push({ pathname: '/(tabs)/tournament-matchup', params: { tournamentId: id, matchupId: mu.id } } as any)}
                    data-testid={`matchup-${mu.id}`}
                  >
                    <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.matchupCard}>
                      <AnimatedSweep />
                      <View style={s.matchupHeader}>
                        <Text style={s.matchupRound}>{roundLabels[mu.round_type] || mu.round_type} - Round {mu.round_number}</Text>
                        {isDone && won && <View style={[s.matchupBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}><Text style={[s.matchupBadgeText, { color: colors.success }]}>VITTORIA</Text></View>}
                        {isDone && lost && <View style={[s.matchupBadge, { backgroundColor: 'rgba(239,68,68,0.2)' }]}><Text style={[s.matchupBadgeText, { color: colors.error }]}>SCONFITTA</Text></View>}
                        {isDone && mu.result === 'draw' && <View style={[s.matchupBadge, { backgroundColor: 'rgba(245,166,35,0.2)' }]}><Text style={[s.matchupBadgeText, { color: colors.accent }]}>PAREGGIO</Text></View>}
                        {!isDone && <View style={[s.matchupBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}><Text style={[s.matchupBadgeText, { color: colors.success }]}>IN CORSO</Text></View>}
                      </View>
                      <View style={s.matchupBody}>
                        <View style={s.matchupPlayerCol}>
                          <View style={[s.matchupAvatar, { borderColor: colors.accent, borderWidth: 2 }]}>
                            <Text style={s.matchupAvatarText}>{user?.username?.charAt(0)?.toUpperCase() || 'T'}</Text>
                          </View>
                          <Text style={[s.matchupPlayerName, { color: colors.accent }]}>Tu</Text>
                          <Text style={s.matchupPts}>{myPts.toFixed(1)}</Text>
                        </View>
                        <View style={s.matchupVsCol}><Text style={s.matchupVs}>VS</Text></View>
                        <View style={s.matchupPlayerCol}>
                          <View style={s.matchupAvatar}>
                            <Text style={s.matchupAvatarText}>{opponent.charAt(0).toUpperCase()}</Text>
                          </View>
                          <Text style={s.matchupPlayerName}>{opponent}</Text>
                          <Text style={s.matchupPts}>{oppPts.toFixed(1)}</Text>
                        </View>
                      </View>
                      <View style={s.matchupFooter}>
                        <Text style={s.matchupCta}>Vedi sfida</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* ─── GIRONI ─── */}
        {activeTab === 'groups' && hasGroups && (
          <>
            {groupStandings.length === 0 ? (
              <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCard}>
                <AnimatedSweep />
                <Ionicons name="grid-outline" size={40} color={DARK.textMuted} />
                <Text style={s.emptyTitle}>Gironi non ancora generati</Text>
              </LinearGradient>
            ) : (
              groupStandings.map(g => (
                <LinearGradient key={g.group_id} colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.groupCard}>
                  <AnimatedSweep />
                  <Text style={s.groupTitle}>Girone {g.group_name}</Text>
                  <View style={s.tableHeader}>
                    <Text style={[s.cell, { flex: 2.5, textAlign: 'left' }]}>#</Text>
                    <Text style={s.cell}>G</Text>
                    <Text style={s.cell}>V</Text>
                    <Text style={s.cell}>P</Text>
                    <Text style={s.cell}>S</Text>
                    <Text style={[s.cell, { fontWeight: '800' }]}>PT</Text>
                  </View>
                  {g.standings.map((st, idx) => {
                    const qualifies = idx < tournament.advance_count;
                    const isMe = st.user_id === user?.id;
                    return (
                      <View key={st.user_id} style={[s.tableRow, qualifies && { borderLeftWidth: 3, borderLeftColor: colors.success, paddingLeft: 6 }, isMe && { backgroundColor: 'rgba(245,166,35,0.1)' }]}>
                        <View style={[s.cell, { flex: 2.5, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                          <Text style={s.posNum}>{idx + 1}</Text>
                          <Text style={[s.userName, isMe && { color: colors.accent }]} numberOfLines={1}>{st.username}</Text>
                        </View>
                        <Text style={s.cell}>{st.played}</Text>
                        <Text style={[s.cell, { color: colors.success }]}>{st.wins}</Text>
                        <Text style={s.cell}>{st.draws}</Text>
                        <Text style={[s.cell, { color: colors.error }]}>{st.losses}</Text>
                        <Text style={[s.cell, { fontWeight: '800', color: '#fff' }]}>{st.group_points}</Text>
                      </View>
                    );
                  })}
                </LinearGradient>
              ))
            )}
          </>
        )}

        {/* ─── TABELLONE ─── */}
        {activeTab === 'bracket' && hasGroups && (
          <>
            {Object.keys(bracket).length === 0 ? (
              <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyCard}>
                <AnimatedSweep />
                <Ionicons name="git-network-outline" size={40} color={DARK.textMuted} />
                <Text style={s.emptyTitle}>Tabellone non ancora generato</Text>
                <Text style={s.emptySub}>Verrà generato al termine della fase a gironi</Text>
              </LinearGradient>
            ) : (
              Object.entries(bracket).map(([phase, matchups]) => (
                <View key={phase}>
                  <Text style={s.sectionLabel}>{phase.toUpperCase()}</Text>
                  {matchups.map(mu => {
                    const aWon = mu.result === 'user_a_win';
                    const bWon = mu.result === 'user_b_win';
                    return (
                      <TouchableOpacity
                        key={mu.id}
                        onPress={() => router.push({ pathname: '/(tabs)/tournament-matchup', params: { tournamentId: id, matchupId: mu.id } } as any)}
                        data-testid={`bracket-match-${mu.id}`}
                      >
                        <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bracketCard}>
                          <AnimatedSweep />
                          <View style={[s.bracketRow, aWon && { borderLeftColor: colors.success, borderLeftWidth: 3 }]}>
                            <Text style={[s.bracketName, aWon && { color: '#fff', fontWeight: '800' }]}>{mu.user_a_username}</Text>
                            <Text style={[s.bracketScore, aWon && { color: colors.success }]}>{mu.user_a_points.toFixed(1)}</Text>
                          </View>
                          <View style={s.bracketDivider} />
                          <View style={[s.bracketRow, bWon && { borderLeftColor: colors.success, borderLeftWidth: 3 }]}>
                            <Text style={[s.bracketName, bWon && { color: '#fff', fontWeight: '800' }]}>{mu.user_b_username}</Text>
                            <Text style={[s.bracketScore, bWon && { color: colors.success }]}>{mu.user_b_points.toFixed(1)}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={DARK.textMuted} style={{ position: 'absolute', right: 12, top: '50%' }} />
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Side Menu — same as league home */}
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },

  // Header — same as league home
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: '#F3F4F6' },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },

  // Hero Card (same as league matchday card)
  heroCard: {
    borderRadius: borderRadius.xl, padding: spacing.xl, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.accent,
    shadowColor: '#162F5C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 10,
    marginBottom: spacing.md,
  },
  whiteSweep: { position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, opacity: 0.5 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub: { ...typography.bodyS, color: 'rgba(255,255,255,0.55)', marginBottom: spacing.md },

  // CTA Button
  ctaBtn: { borderRadius: 22, overflow: 'hidden', marginTop: spacing.sm },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 22 },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  ctaIconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Enrolled banner
  enrolledBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: spacing.sm },
  enrolledText: { ...typography.bodyS, color: 'rgba(255,255,255,0.7)', flex: 1 },
  leaveText: { fontSize: 13, fontWeight: '700', color: colors.error },

  // Performance row (same as league)
  perfRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  perfCardOuter: { flex: 1, borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent },
  perfCardGrad: { padding: spacing.md, borderRadius: borderRadius.xl, alignItems: 'center', overflow: 'hidden' },
  perfIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  perfValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  perfLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', textAlign: 'center', marginTop: 4 },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 3, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: borderRadius.md },
  tabItemActive: { backgroundColor: colors.accent + '15' },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  tabLabelActive: { color: colors.accent, fontWeight: '700' },

  // Section label
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  // Matchup cards
  matchupCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, marginBottom: spacing.md, padding: spacing.lg },
  matchupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  matchupRound: { ...typography.metaSmall, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  matchupBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  matchupBadgeText: { fontSize: 10, fontWeight: '800' },
  matchupBody: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  matchupPlayerCol: { flex: 1, alignItems: 'center', gap: 4 },
  matchupAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  matchupAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  matchupPlayerName: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  matchupPts: { fontSize: 20, fontWeight: '800', color: '#fff' },
  matchupVsCol: { width: 40, alignItems: 'center' },
  matchupVs: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.25)' },
  matchupFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  matchupCta: { fontSize: 13, fontWeight: '700', color: colors.accent },

  // Group cards
  groupCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, marginBottom: spacing.md, padding: spacing.lg },
  groupTitle: { fontSize: 14, fontWeight: '800', color: colors.accent, marginBottom: spacing.sm },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  cell: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  posNum: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', width: 18 },
  userName: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', flex: 1 },

  // Bracket cards
  bracketCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, marginBottom: spacing.sm, padding: spacing.md },
  bracketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 4 },
  bracketName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)', flex: 1 },
  bracketScore: { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.5)', width: 50, textAlign: 'right' },
  bracketDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Empty states
  emptyCard: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent, padding: spacing.xl, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  emptySub: { ...typography.bodyS, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
});
