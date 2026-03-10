import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, borderRadius } from '../../src/theme/designSystem';

type GroupStanding = {
  user_id: string;
  username: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  group_points: number;
  prediction_points: number;
};

type GroupData = {
  group_name: string;
  group_id: string;
  standings: GroupStanding[];
};

type Matchup = {
  id: string;
  round_type: string;
  round_number: number;
  user_a_id: string;
  user_b_id: string;
  user_a_username: string;
  user_b_username: string;
  user_a_points: number;
  user_b_points: number;
  result: string;
  status: string;
  winner_id: string | null;
};

type RoundInfo = {
  id: string;
  round_number: number;
  round_type: string;
  status: string;
  label: string;
};

type TournamentDetail = {
  id: string;
  name: string;
  status: string;
  max_participants: number;
  registered_count: number;
  spots_left: number;
  is_registered: boolean;
  my_status: string | null;
  groups_count: number;
  players_per_group: number;
  advance_count: number;
  duration_rounds: number;
  current_round: number;
  entry_fee: number;
  groups?: Array<{ group_name: string; members: Array<{ user_id: string; username: string }> }>;
  rounds?: RoundInfo[];
};

type Tab = 'info' | 'groups' | 'sfide' | 'bracket';

export default function TournamentDetail() {
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
  const [registering, setRegistering] = useState(false);

  const fetchAll = useCallback(async () => {
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
      if (detail.status === 'groups' || detail.status === 'knockout') {
        setActiveTab('sfide');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRegister = async () => {
    if (!token || !id) return;
    setRegistering(true);
    try {
      await apiCall(`/tournaments/${id}/register`, { method: 'POST', token });
      fetchAll();
    } catch (e: any) {
      alert(e.message || 'Errore');
    } finally {
      setRegistering(false);
    }
  };

  if (loading || !tournament) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  const t = tournament;
  const isOpen = t.status === 'registration';
  const hasGroups = t.status !== 'draft' && t.status !== 'registration';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{t.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab selector */}
      {hasGroups && (
        <View style={s.tabBar}>
          {(['info', 'sfide', 'groups', 'bracket'] as Tab[]).map(tab => {
            const labels: Record<Tab, string> = { info: 'Info', sfide: 'Le mie sfide', groups: 'Gironi', bracket: 'Tabellone' };
            const isActive = activeTab === tab;
            const disabled = tab === 'bracket' && t.status === 'groups';
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tabItem, isActive && s.tabItemActive, disabled && { opacity: 0.4 }]}
                onPress={() => !disabled && setActiveTab(tab)}
                data-testid={`tournament-tab-${tab}`}
              >
                <Text style={[s.tabText, isActive && s.tabTextActive]}>{labels[tab]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={colors.accent} />}
      >
        {/* INFO TAB */}
        {(activeTab === 'info' || !hasGroups) && (
          <>
            {/* Tournament info card */}
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <Ionicons name="people" size={18} color={colors.accent} />
                <Text style={s.infoLabel}>Partecipanti</Text>
                <Text style={s.infoValue}>{t.registered_count}/{t.max_participants}</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="grid" size={18} color={colors.accent} />
                <Text style={s.infoLabel}>Struttura</Text>
                <Text style={s.infoValue}>{t.groups_count} gironi da {t.players_per_group}</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="arrow-forward-circle" size={18} color={colors.accent} />
                <Text style={s.infoLabel}>Passano</Text>
                <Text style={s.infoValue}>Primi {t.advance_count} per girone</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="calendar" size={18} color={colors.accent} />
                <Text style={s.infoLabel}>Durata</Text>
                <Text style={s.infoValue}>{t.duration_rounds} giornate</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="cash" size={18} color={colors.accent} />
                <Text style={s.infoLabel}>Iscrizione</Text>
                <Text style={s.infoValue}>{t.entry_fee === 0 ? 'Gratuita' : `${t.entry_fee}$`}</Text>
              </View>
            </View>

            {/* Registration CTA */}
            {isOpen && !t.is_registered && t.spots_left > 0 && (
              <TouchableOpacity style={s.ctaBtn} onPress={handleRegister} disabled={registering} data-testid="register-tournament">
                {registering ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={s.ctaBtnText}>Iscriviti al torneo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {t.is_registered && (
              <View style={s.registeredCard}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={s.registeredCardText}>Sei iscritto a questo torneo</Text>
              </View>
            )}

            {/* Rounds list */}
            {t.rounds && t.rounds.length > 0 && (
              <View style={s.roundsSection}>
                <Text style={s.sectionTitle}>Giornate</Text>
                {t.rounds.map(r => (
                  <View key={r.id} style={s.roundItem}>
                    <View style={s.roundLeft}>
                      <Text style={s.roundLabel}>{r.label}</Text>
                      <Text style={s.roundType}>{r.round_type === 'group' ? 'Fase a gironi' : r.round_type}</Text>
                    </View>
                    <View style={[s.roundStatus, { backgroundColor: r.status === 'COMPLETED' ? '#22c55e20' : r.status === 'OPEN' ? '#3b82f620' : colors.background }]}>
                      <Text style={[s.roundStatusText, { color: r.status === 'COMPLETED' ? '#22c55e' : r.status === 'OPEN' ? '#3b82f6' : colors.textMuted }]}>
                        {r.status === 'COMPLETED' ? 'Completata' : r.status === 'OPEN' ? 'Aperta' : 'In attesa'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* LE MIE SFIDE TAB */}
        {activeTab === 'sfide' && hasGroups && (
          <>
            {myMatchups.length === 0 ? (
              <View style={s.emptyBracket}>
                <Ionicons name="flash-outline" size={40} color={colors.textMuted} />
                <Text style={s.emptyText}>Nessuna sfida ancora</Text>
              </View>
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
                    key={mu.id} style={s.matchupCard}
                    onPress={() => router.push({ pathname: '/tournament/matchup', params: { tournamentId: id, matchupId: mu.id } } as any)}
                    data-testid={`matchup-${mu.id}`}
                  >
                    <View style={s.matchupTop}>
                      <Text style={s.matchupRound}>{roundLabels[mu.round_type] || mu.round_type} - Round {mu.round_number}</Text>
                      {isDone && won && <View style={[s.resultBadge, { backgroundColor: '#22c55e20' }]}><Text style={[s.resultBadgeText, { color: '#22c55e' }]}>VITTORIA</Text></View>}
                      {isDone && lost && <View style={[s.resultBadge, { backgroundColor: '#ef444420' }]}><Text style={[s.resultBadgeText, { color: '#ef4444' }]}>SCONFITTA</Text></View>}
                      {isDone && mu.result === 'draw' && <View style={[s.resultBadge, { backgroundColor: '#f59e0b20' }]}><Text style={[s.resultBadgeText, { color: '#f59e0b' }]}>PAREGGIO</Text></View>}
                      {!isDone && <View style={[s.resultBadge, { backgroundColor: colors.accent + '20' }]}><Text style={[s.resultBadgeText, { color: colors.accent }]}>IN CORSO</Text></View>}
                    </View>
                    <View style={s.matchupBody}>
                      <View style={s.matchupPlayer}>
                        <View style={[s.matchupAvatar, { backgroundColor: colors.accent + '20' }]}>
                          <Text style={[s.matchupAvatarText, { color: colors.accent }]}>{user?.username?.charAt(0)?.toUpperCase() || 'T'}</Text>
                        </View>
                        <Text style={[s.matchupName, { color: colors.accent }]} numberOfLines={1}>Tu</Text>
                        <Text style={[s.matchupPts, won && { color: '#22c55e', fontWeight: '900' }]}>{myPts.toFixed(1)}</Text>
                      </View>
                      <View style={s.matchupVs}><Text style={s.matchupVsText}>VS</Text></View>
                      <View style={s.matchupPlayer}>
                        <View style={[s.matchupAvatar, { backgroundColor: '#ef444420' }]}>
                          <Text style={[s.matchupAvatarText, { color: '#ef4444' }]}>{opponent.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={s.matchupName} numberOfLines={1}>{opponent}</Text>
                        <Text style={[s.matchupPts, lost && { color: '#22c55e', fontWeight: '900' }]}>{oppPts.toFixed(1)}</Text>
                      </View>
                    </View>
                    <View style={s.matchupFooter}>
                      <Text style={s.matchupCta}>Vedi dettagli</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* GROUPS TAB */}
        {activeTab === 'groups' && hasGroups && (
          <>
            {groupStandings.length === 0 ? (
              <Text style={s.emptyText}>Gironi in preparazione</Text>
            ) : (
              groupStandings.map(g => (
                <View key={g.group_id} style={s.groupCard}>
                  <Text style={s.groupTitle}>Girone {g.group_name}</Text>
                  {/* Table header */}
                  <View style={s.tableHeader}>
                    <Text style={[s.tableCell, { flex: 2 }]}>Giocatore</Text>
                    <Text style={s.tableCell}>G</Text>
                    <Text style={s.tableCell}>V</Text>
                    <Text style={s.tableCell}>P</Text>
                    <Text style={s.tableCell}>S</Text>
                    <Text style={[s.tableCell, { fontWeight: '800' }]}>Pt</Text>
                    <Text style={s.tableCell}>Pred</Text>
                  </View>
                  {g.standings.map((st, idx) => {
                    const isMe = st.user_id === user?.id;
                    const qualifies = idx < (tournament?.advance_count || 2);
                    return (
                      <View key={st.user_id} style={[s.tableRow, isMe && s.tableRowMe, qualifies && s.tableRowQualify]}>
                        <View style={[s.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                          <Text style={s.tablePos}>{idx + 1}</Text>
                          <Text style={[s.tableName, isMe && { fontWeight: '800', color: colors.accent }]} numberOfLines={1}>{st.username}</Text>
                        </View>
                        <Text style={s.tableCell}>{st.played}</Text>
                        <Text style={[s.tableCell, { color: '#22c55e' }]}>{st.wins}</Text>
                        <Text style={s.tableCell}>{st.draws}</Text>
                        <Text style={[s.tableCell, { color: '#ef4444' }]}>{st.losses}</Text>
                        <Text style={[s.tableCell, { fontWeight: '800', color: colors.textPrimary }]}>{st.group_points}</Text>
                        <Text style={[s.tableCell, { fontSize: 11 }]}>{st.prediction_points}</Text>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}

        {/* BRACKET TAB */}
        {activeTab === 'bracket' && (
          <>
            {Object.keys(bracket).length === 0 ? (
              <View style={s.emptyBracket}>
                <Ionicons name="git-network-outline" size={40} color={colors.textMuted} />
                <Text style={s.emptyText}>Tabellone non ancora disponibile</Text>
              </View>
            ) : (
              Object.entries(bracket).map(([roundType, matchups]) => {
                const roundLabels: Record<string, string> = {
                  quarterfinal: 'Quarti di finale',
                  semifinal: 'Semifinali',
                  final: 'Finale',
                };
                return (
                  <View key={roundType} style={s.bracketRound}>
                    <Text style={s.bracketRoundTitle}>{roundLabels[roundType] || roundType}</Text>
                    {matchups.map(mu => {
                      const aWon = mu.result === 'user_a_win';
                      const bWon = mu.result === 'user_b_win';
                      return (
                        <TouchableOpacity
                          key={mu.id} style={s.bracketMatch}
                          onPress={() => router.push({ pathname: '/tournament/matchup', params: { tournamentId: id, matchupId: mu.id } } as any)}
                          data-testid={`bracket-match-${mu.id}`}
                        >
                          <View style={[s.bracketPlayer, aWon && s.bracketPlayerWin]}>
                            <Text style={[s.bracketName, aWon && s.bracketNameWin]}>{mu.user_a_username}</Text>
                            <Text style={[s.bracketPts, aWon && s.bracketPtsWin]}>{mu.user_a_points.toFixed(1)}</Text>
                          </View>
                          <View style={s.bracketVs}>
                            <Text style={s.bracketVsText}>VS</Text>
                          </View>
                          <View style={[s.bracketPlayer, bWon && s.bracketPlayerWin]}>
                            <Text style={[s.bracketName, bWon && s.bracketNameWin]}>{mu.user_b_username}</Text>
                            <Text style={[s.bracketPts, bWon && s.bracketPtsWin]}>{mu.user_b_points.toFixed(1)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1, textAlign: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabItemActive: { backgroundColor: colors.accent + '20' },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: colors.textMuted, paddingVertical: 30, fontSize: 14 },

  // Info
  infoCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1F4C8F', paddingVertical: 14, borderRadius: borderRadius.md },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  registeredCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22c55e15', paddingVertical: 14, borderRadius: borderRadius.md },
  registeredCardText: { fontSize: 15, fontWeight: '600', color: '#22c55e' },
  roundsSection: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  roundItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, padding: 14, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  roundLeft: { gap: 2 },
  roundLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  roundType: { fontSize: 11, color: colors.textMuted },
  roundStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roundStatusText: { fontSize: 11, fontWeight: '700' },

  // Groups
  groupCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: 14, borderWidth: 1, borderColor: colors.border },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.accent, marginBottom: 10 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tableRowMe: { backgroundColor: colors.accent + '10' },
  tableRowQualify: { borderLeftWidth: 3, borderLeftColor: '#22c55e', paddingLeft: 4 },
  tableCell: { flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  tablePos: { fontSize: 12, fontWeight: '700', color: colors.textMuted, width: 18, textAlign: 'center' },
  tableName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flex: 1 },

  // Bracket
  emptyBracket: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  bracketRound: { gap: 10 },
  bracketRoundTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  bracketMatch: { backgroundColor: colors.card, borderRadius: borderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  bracketPlayer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14 },
  bracketPlayerWin: { backgroundColor: '#22c55e15' },
  bracketName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  bracketNameWin: { fontWeight: '800', color: '#22c55e' },
  bracketPts: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  bracketPtsWin: { color: '#22c55e' },
  bracketVs: { alignItems: 'center', paddingVertical: 2, backgroundColor: colors.background },
  bracketVsText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },

  // Matchup cards (Le mie sfide)
  matchupCard: { backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  matchupTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  matchupRound: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  resultBadgeText: { fontSize: 10, fontWeight: '800' },
  matchupBody: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 0 },
  matchupPlayer: { flex: 1, alignItems: 'center', gap: 4 },
  matchupAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  matchupAvatarText: { fontSize: 16, fontWeight: '800' },
  matchupName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  matchupPts: { fontSize: 18, fontWeight: '800', color: colors.textSecondary },
  matchupVs: { width: 36, alignItems: 'center', justifyContent: 'center' },
  matchupVsText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
  matchupFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  matchupCta: { fontSize: 12, fontWeight: '700', color: colors.accent },
});
