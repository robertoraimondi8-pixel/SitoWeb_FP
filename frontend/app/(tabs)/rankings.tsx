import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  ActivityIndicator, Modal, FlatList, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { useCompetition } from '../../src/contexts/CompetitionContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

// Design System
import { League, Matchday, StandingsData, getErrorMessage } from '../../src/types/api';

import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { StatusBadge, AnimatedSweep } from '../../src/components/ui';

// Podium medal colors
const PODIUM_COLORS = [colors.gold, colors.silver, colors.bronze];
const PODIUM_ICONS: Array<React.ComponentProps<typeof Ionicons>['name']> = ['trophy', 'medal-outline', 'medal-outline'];

interface StandingEntry {
  user_id: string;
  username: string;
  rank: number;
  total_points?: number;
  matchday_points?: number;
  current_week_points?: number;
  matchdays_played?: number;
  exact_correct?: number;
  total_correct?: number;
  '1x2_correct'?: number;
  is_current_user: boolean;
}

export default function RankingsScreen() {
  const { t } = useTranslation();
  const { token, user, handleAuthError } = useAuth();
  const { activeLeague } = useLeague();
  const { mode: competitionMode, tournamentId, tournamentName } = useCompetition();
  const params = useLocalSearchParams<{ tab?: string; matchdayId?: string; leagueId?: string }>();
  const [tab, setTab] = useState<'total' | 'weekly'>('total');
  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiveMatchday, setIsLiveMatchday] = useState(false);
  
  // Weekly specific
  const [matchdays, setMatchdays] = useState<League[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<StandingsData | null>(null);
  const [showMatchdayPicker, setShowMatchdayPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle incoming navigation params (from Home LIVE button)
  useEffect(() => {
    if (params.tab === 'weekly') {
      setTab('weekly');
    }
  }, [params.tab]);

  // Auto-select matchday from params once matchdays are loaded
  useEffect(() => {
    if (params.matchdayId && matchdays.length > 0) {
      const targetMd = matchdays.find((m: any) => m.id === params.matchdayId);
      if (targetMd) {
        setSelectedMatchday(targetMd);
      }
    }
  }, [params.matchdayId, matchdays]);

  // Load matchdays when activeLeague changes
  useEffect(() => {
    if (!activeLeague?.id || !token) return;
    setStandings(null);
    setMatchdays([]);
    setSelectedMatchday(null);
    setLoading(true);
    (async () => {
      try {
        const mds = await apiCall(`/standings/matchdays?league_id=${activeLeague.id}`, { token });
        setMatchdays(mds);
        if (mds.length > 0) setSelectedMatchday(mds[0]);
      } catch (e: unknown) { 
        if (isAuthError(e)) {
          const didLogout = await handleAuthError(e);
          if (didLogout) router.replace('/(auth)/login');
          return;
        }
        console.error(e); 
      }
    })();
  }, [activeLeague?.id, token, handleAuthError]);

  const fetchStandings = useCallback(async () => {
    if (!activeLeague?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      let url: string;
      if (tab === 'total') {
        url = `/standings/total?league_id=${activeLeague.id}`;
      } else {
        if (!selectedMatchday) { setLoading(false); return; }
        url = `/standings/weekly/${selectedMatchday.id}?league_id=${activeLeague.id}`;
      }
      const res = await apiCall(url, { token });
      setStandings(res);
      // Track if viewing a LIVE matchday
      setIsLiveMatchday(tab === 'weekly' && (res?.matchday_status === 'LIVE' || selectedMatchday?.status === 'LIVE'));
    } catch (e: unknown) { 
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error(e); 
    }
    finally { setLoading(false); }
  }, [token, tab, activeLeague?.id, selectedMatchday, handleAuthError]);

  useEffect(() => { fetchStandings(); }, [fetchStandings]);

  const viewUserPredictions = (userId: string) => {
    if (!selectedMatchday) return;
    router.push({
      pathname: '/user-predictions',
      params: { userId, matchdayId: selectedMatchday.id, leagueId: activeLeague?.id || '' }
    });
  };

  const viewUserProfile = (userId: string) => {
    router.push({
      pathname: '/user-detail',
      params: { userId, leagueId: activeLeague?.id || '' }
    });
  };

  const formatPoints = (n: number) => Math.round(n).toString();

  // Frontend-only search filter (no API calls, no ranking changes)
  const filteredEntries = useMemo(() => {
    const entries = standings?.entries || [];
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e: StandingEntry) => e.username.toLowerCase().includes(q));
  }, [standings?.entries, searchQuery]);

  const renderEntry = (entry: StandingEntry, index: number) => {
    const isTop3 = index < 3;
    const isCurrentUser = entry.user_id === user?.id;
    const points = tab === 'total' ? entry.total_points : entry.matchday_points;
    const podiumColor = isTop3 ? PODIUM_COLORS[index] : undefined;
    
    return (
      <TouchableOpacity
        key={entry.user_id}
        testID={`rank-${index}`}
        onPress={() => tab === 'total' ? viewUserProfile(entry.user_id) : viewUserPredictions(entry.user_id)}
        style={[
          styles.entryRow,
          isTop3 && styles.entryRowTop3,
          isCurrentUser && styles.entryRowCurrent,
        ]}
      >
        {isCurrentUser && <View style={styles.currentUserAccent} />}
        
        <View style={[
          styles.rankBadge,
          isTop3 && styles.rankBadgeTop3,
          { backgroundColor: isTop3 ? podiumColor : colors.background }
        ]}>
          {isTop3 ? (
            <Ionicons name={PODIUM_ICONS[index]} size={index === 0 ? 18 : 16} color={colors.textInverse} />
          ) : (
            <Text style={styles.rankText}>{entry.rank}</Text>
          )}
        </View>
        
        <View style={styles.entryInfo}>
          <Text style={[styles.entryName, isCurrentUser && styles.entryNameBold]}>
            {entry.username}
            {isCurrentUser && ' (Tu)'}
          </Text>
          {isTop3 && (
            <Text style={[styles.entryMeta, { color: podiumColor }]}>
              {index === 0 ? 'Primo' : index === 1 ? 'Secondo' : 'Terzo'}
              {tab === 'total' && entry.matchdays_played ? ` · ${entry.matchdays_played} giornate` : ''}
            </Text>
          )}
        </View>
        
        <View style={styles.pointsContainer}>
          <Text style={[
            styles.pointsText,
            isTop3 && styles.pointsTextLarge,
            isTop3 && { color: podiumColor },
          ]}>
            {formatPoints(points || 0)}
          </Text>
          {tab === 'total' && entry.current_week_points !== undefined && entry.current_week_points > 0 && (
            <Text style={styles.weekBonus}>+{formatPoints(entry.current_week_points)}</Text>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  // ══ TOURNAMENT RANKINGS ══
  const [trkTab, setTrkTab] = useState<'gironi' | 'tabellone' | 'partite'>('gironi');
  const [trkGroups, setTrkGroups] = useState<any[]>([]);
  const [trkBracket, setTrkBracket] = useState<any[]>([]);
  const [trkLoading, setTrkLoading] = useState(true);
  const [trkTournament, setTrkTournament] = useState<any>(null);
  const [trkAllMatchups, setTrkAllMatchups] = useState<any[]>([]);
  const [trkPartiteFilter, setTrkPartiteFilter] = useState<string>('all');
  const [trkFilterOpen, setTrkFilterOpen] = useState(false);

  useEffect(() => {
    if (competitionMode !== 'tournament' || !tournamentId || !token) return;
    setTrkLoading(true);
    Promise.all([
      apiCall(`/tournaments/${tournamentId}`, { token }),
      apiCall(`/tournaments/${tournamentId}/groups`, { token }).catch(() => []),
      apiCall(`/tournaments/${tournamentId}/bracket`, { token }).catch(() => ({})),
      apiCall(`/tournaments/${tournamentId}/all-matchups`, { token }).catch(() => []),
      apiCall(`/tournaments/${tournamentId}/fixtures`, { token }).catch(() => ({ matchdays: [] })),
    ]).then(([detail, groups, bracketRes, allMatchups, fixturesRes]) => {
      setTrkTournament(detail);
      setTrkGroups(groups || []);
      setTrkAllMatchups(allMatchups || []);
      // Store fixtures for live scores
      (window as any).__trkFixtures = fixturesRes?.matchdays || [];
      // bracket API returns { bracket: { semifinal: [...], final: [...] } }
      const raw = bracketRes?.bracket || {};
      const rounds = Object.entries(raw).map(([roundType, matchups]) => ({
        round_label: roundType === 'quarterfinal' ? 'Quarti di Finale' : roundType === 'semifinal' ? 'Semifinali' : roundType === 'final' ? 'Finale' : roundType,
        round_type: roundType,
        matchups: matchups as any[],
      }));
      // Sort: quarterfinal → semifinal → final
      const order = ['quarterfinal', 'semifinal', 'final'];
      rounds.sort((a, b) => order.indexOf(a.round_type) - order.indexOf(b.round_type));
      setTrkBracket(rounds);
    }).catch(console.error).finally(() => setTrkLoading(false));
  }, [competitionMode, tournamentId, token]);

  if (competitionMode === 'tournament' && tournamentId) {
    const hasGroups = trkTournament && ['groups', 'knockout', 'completed'].includes(trkTournament.status);
    const bracketReady = trkTournament && ['knockout', 'completed'].includes(trkTournament.status);

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Classifiche Torneo</Text>
          <View style={styles.accentLine} />
        </View>
        <View style={styles.singleLeagueHeader}>
          <Ionicons name="flash" size={16} color="#22c55e" />
          <Text style={styles.singleLeagueText}>{tournamentName}</Text>
        </View>
        {/* Tabs: Gironi | Tabellone | Partite */}
        <View style={styles.tabContainer}>
          <View style={styles.tabRow}>
            <TouchableOpacity onPress={() => setTrkTab('gironi')} style={[styles.tabBtn, trkTab === 'gironi' && styles.tabBtnActive]} data-testid="trk-tab-gironi">
              <Text style={[styles.tabText, trkTab === 'gironi' && styles.tabTextActive]}>Gironi</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTrkTab('tabellone')} style={[styles.tabBtn, trkTab === 'tabellone' && styles.tabBtnActive]} data-testid="trk-tab-tabellone">
              <Text style={[styles.tabText, trkTab === 'tabellone' && styles.tabTextActive]}>Tabellone</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTrkTab('partite')} style={[styles.tabBtn, trkTab === 'partite' && styles.tabBtnActive]} data-testid="trk-tab-partite">
              <Text style={[styles.tabText, trkTab === 'partite' && styles.tabTextActive]}>Partite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {trkLoading && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* GIRONI TAB */}
        {!trkLoading && trkTab === 'gironi' && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {!hasGroups ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="time-outline" size={40} color={colors.textMuted} />
                <Text style={{ marginTop: 12, fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>I gironi saranno disponibili dopo la fase di iscrizione</Text>
              </View>
            ) : trkGroups.map((g: any) => (
              <View key={g.group_name} style={{ marginBottom: 20, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                <LinearGradient colors={['#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 1 }}>GIRONE {g.group_name}</Text>
                </LinearGradient>
                {/* Table header */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted }}>#</Text>
                  <Text style={{ flex: 4, fontSize: 11, fontWeight: '700', color: colors.textMuted }}>Giocatore</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted, textAlign: 'center' }}>G</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted, textAlign: 'center' }}>V</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted, textAlign: 'center' }}>P</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted, textAlign: 'center' }}>S</Text>
                  <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '700', color: colors.textMuted, textAlign: 'right' }}>Pts</Text>
                </View>
                {(g.standings || []).map((s: any, i: number) => {
                  const isMe = s.user_id === user?.id;
                  return (
                    <View key={s.user_id} style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8f8f8', backgroundColor: isMe ? 'rgba(245,166,35,0.06)' : (i < (g.qualifies || 2) ? 'rgba(34,197,94,0.04)' : 'transparent') }}>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: isMe ? '800' : '600', color: i < (g.qualifies || 2) ? '#22c55e' : colors.textSecondary }}>{i + 1}</Text>
                      <Text style={{ flex: 4, fontSize: 13, fontWeight: isMe ? '800' : '500', color: isMe ? colors.primary : colors.textPrimary }} numberOfLines={1}>{s.username}{isMe ? ' (tu)' : ''}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>{s.played ?? 0}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: '#22c55e', textAlign: 'center', fontWeight: '600' }}>{s.wins ?? 0}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>{s.draws ?? 0}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: '#ef4444', textAlign: 'center' }}>{s.losses ?? 0}</Text>
                      <Text style={{ flex: 1.5, fontSize: 13, fontWeight: '800', color: colors.primary, textAlign: 'right' }}>{Math.round(s.group_points ?? s.points ?? 0)}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}

        {/* TABELLONE TAB */}
        {!trkLoading && trkTab === 'tabellone' && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {(!bracketReady || trkBracket.length === 0 || trkBracket.every((r: any) => (r.matchups || []).every((m: any) => m.status === 'pending'))) ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="git-branch-outline" size={40} color={colors.textMuted} />
                <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Tabellone eliminazione diretta</Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>{bracketReady ? 'In attesa che terminino i gironi' : 'Disponibile dopo la fase a gironi'}</Text>
              </View>
            ) : (
              <View>
                {trkBracket.map((round: any, ri: number) => (
                  <View key={ri} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 4, height: 20, backgroundColor: colors.primary, borderRadius: 2 }} />
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 }}>{round.round_label}</Text>
                    </View>
                    {(round.matchups || []).map((m: any, mi: number) => (
                      <View key={mi} style={{ backgroundColor: (m.user_a_id === user?.id || m.user_b_id === user?.id) ? 'rgba(245,166,35,0.06)' : '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: (m.user_a_id === user?.id || m.user_b_id === user?.id) ? 1.5 : 1, borderColor: (m.user_a_id === user?.id || m.user_b_id === user?.id) ? colors.accent : '#e8e8e8' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: m.user_a_id === user?.id ? '800' : '500', color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{m.user_a_username || 'TBD'}</Text>
                          <View style={{ backgroundColor: m.status === 'completed' ? colors.primary : '#e0e0e0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginHorizontal: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: m.status === 'completed' ? '#fff' : colors.textSecondary }}>{Math.round(m.user_a_points || 0)} : {Math.round(m.user_b_points || 0)}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: m.user_b_id === user?.id ? '800' : '500', color: colors.textPrimary, flex: 1, textAlign: 'right' }} numberOfLines={1}>{m.user_b_username || 'TBD'}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* PARTITE TAB */}
        {!trkLoading && trkTab === 'partite' && (() => {
          const activeRound = trkTournament?.current_round_info;

          // Build group map from trkGroups
          const groupMap: Record<string, string> = {};
          (trkGroups || []).forEach((g: any) => { groupMap[g.group_id] = g.group_name; });

          // Collect unique groups and knockout phases from matchups
          const groupIds = new Set<string>();
          const knockoutTypes = new Set<string>();
          const allMatchupsFlat: any[] = [];
          (trkAllMatchups || []).forEach((round: any) => {
            (round.matchups || []).forEach((mu: any) => {
              const enriched = { ...mu, round_number: round.round_number, round_type: round.round_type, round_label: round.label };
              allMatchupsFlat.push(enriched);
              if (round.round_type === 'group' && mu.group_id) groupIds.add(mu.group_id);
              if (round.round_type !== 'group') knockoutTypes.add(round.round_type);
            });
          });

          // Build filter options
          const knockoutLabels: Record<string, string> = { knockout: 'Sedicesimi', round_of_16: 'Ottavi di Finale', quarter: 'Quarti di Finale', semi: 'Semifinali', final: 'Finale' };
          const filterOptions: { key: string; label: string; icon: string }[] = [
            { key: 'all', label: 'Tutte le partite', icon: 'list' },
          ];
          // Add group filters sorted by name
          [...groupIds].sort((a, b) => (groupMap[a] || '').localeCompare(groupMap[b] || '')).forEach(gid => {
            filterOptions.push({ key: `group_${gid}`, label: `Girone ${groupMap[gid] || '?'}`, icon: 'people' });
          });
          // Add knockout filters
          ['knockout', 'round_of_16', 'quarter', 'semi', 'final'].forEach(kt => {
            if (knockoutTypes.has(kt)) {
              filterOptions.push({ key: `ko_${kt}`, label: knockoutLabels[kt] || kt, icon: 'trophy' });
            }
          });

          // Apply filter
          let filtered: any[];
          if (trkPartiteFilter === 'all') {
            filtered = allMatchupsFlat;
          } else if (trkPartiteFilter.startsWith('group_')) {
            const gid = trkPartiteFilter.replace('group_', '');
            filtered = allMatchupsFlat.filter(mu => mu.group_id === gid);
          } else if (trkPartiteFilter.startsWith('ko_')) {
            const kt = trkPartiteFilter.replace('ko_', '');
            filtered = allMatchupsFlat.filter(mu => mu.round_type === kt);
          } else {
            filtered = allMatchupsFlat;
          }

          const activeLabel = filterOptions.find(f => f.key === trkPartiteFilter)?.label || 'Tutte le partite';

          // Group filtered matchups by round for display
          const roundsMap: Record<string, { label: string; round_type: string; round_number: number; matchups: any[] }> = {};
          filtered.forEach(mu => {
            const key = `${mu.round_type}_${mu.round_number}`;
            if (!roundsMap[key]) roundsMap[key] = { label: mu.round_label, round_type: mu.round_type, round_number: mu.round_number, matchups: [] };
            roundsMap[key].matchups.push(mu);
          });
          const groupedRounds = Object.values(roundsMap).sort((a, b) => {
            if (a.round_type === 'group' && b.round_type !== 'group') return -1;
            if (a.round_type !== 'group' && b.round_type === 'group') return 1;
            return a.round_number - b.round_number;
          });

          return (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
              {/* Dropdown filter */}
              <TouchableOpacity
                onPress={() => setTrkFilterOpen(!trkFilterOpen)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' }}
                data-testid="partite-filter-btn"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="filter" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{activeLabel}</Text>
                </View>
                <Ionicons name={trkFilterOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              {trkFilterOpen && (
                <View style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden' }}>
                  {filterOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => { setTrkPartiteFilter(opt.key); setTrkFilterOpen(false); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: trkPartiteFilter === opt.key ? 'rgba(31,76,143,0.05)' : 'transparent' }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name={opt.icon as any} size={16} color={trkPartiteFilter === opt.key ? colors.primary : colors.textMuted} />
                        <Text style={{ fontSize: 14, fontWeight: trkPartiteFilter === opt.key ? '700' : '400', color: trkPartiteFilter === opt.key ? colors.primary : colors.textPrimary }}>{opt.label}</Text>
                      </View>
                      {trkPartiteFilter === opt.key && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {groupedRounds.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Ionicons name="football-outline" size={40} color={colors.textMuted} />
                  <Text style={{ marginTop: 12, fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>Nessuna partita ancora disponibile</Text>
                </View>
              ) : groupedRounds.map((round: any) => (
                <View key={`${round.round_type}_${round.round_number}`} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <View style={{ width: 4, height: 20, backgroundColor: round.round_type === 'group' ? '#22c55e' : colors.primary, borderRadius: 2 }} />
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {trkPartiteFilter.startsWith('group_') ? `Girone ${groupMap[trkPartiteFilter.replace('group_', '')] || ''} - Round ${round.round_number}` : round.label}
                    </Text>
                    <View style={{ backgroundColor: round.round_type === 'group' ? 'rgba(34,197,94,0.1)' : 'rgba(31,76,143,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: round.round_type === 'group' ? '#22c55e' : colors.primary }}>{(round.matchups || []).length} sfide</Text>
                    </View>
                  </View>
                  {(round.matchups || []).map((m: any) => {
                    const isMyMatch = m.user_a_id === user?.id || m.user_b_id === user?.id;
                    const isDone = m.status === 'completed';
                    // Check if round is active (OPEN/LIVE)
                    const roundIsActive = activeRound && round.round_number === activeRound.round_number && ['OPEN', 'LIVE'].includes(activeRound.status);
                    const isInProgress = !isDone && (m.status === 'in_progress' || roundIsActive);
                    const statusColor = isDone ? colors.primary : isInProgress ? '#22c55e' : '#9ca3af';
                    const statusLabel = isDone ? 'Completata' : isInProgress ? 'In corso' : 'Da giocare';
                    return (
                      <TouchableOpacity key={m.id} style={{ backgroundColor: isMyMatch ? 'rgba(245,166,35,0.06)' : '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: isMyMatch ? 1.5 : 1, borderColor: isMyMatch ? colors.accent : '#e8e8e8' }}
                        activeOpacity={0.7}
                        onPress={() => {
                          // Navigate to live matchup view via home tournament
                          router.push({ pathname: '/(tabs)/home', params: { tournament_id: tournamentId, tournament_name: trkTournament?.name, matchup_id: m.id } } as any);
                        }}
                      >
                        {isMyMatch && <Text style={{ fontSize: 9, fontWeight: '800', color: colors.accent, letterSpacing: 1, marginBottom: 6 }}>LA TUA SFIDA</Text>}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: m.user_a_id === user?.id ? '800' : '500', color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{m.user_a_username || 'TBD'}</Text>
                          <View style={{ backgroundColor: statusColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginHorizontal: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{isDone ? `${Math.round(m.user_a_points || 0)} : ${Math.round(m.user_b_points || 0)}` : statusLabel}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: m.user_b_id === user?.id ? '800' : '500', color: colors.textPrimary, flex: 1, textAlign: 'right' }} numberOfLines={1}>{m.user_b_username || 'TBD'}</Text>
                        </View>
                        {m.group_name && <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 6 }}>Girone {m.group_name}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          );
        })()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#F5F6F8', '#ECEFF3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('rankings.title')}</Text>
        <View style={styles.accentLine} />
      </View>

      {/* League Header - single active league from context */}
      {activeLeague && (
        <View style={styles.singleLeagueHeader}>
          <Ionicons name="trophy" size={16} color={colors.accent} />
          <Text style={styles.singleLeagueText}>
            {activeLeague.name}
          </Text>
        </View>
      )}

      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <View style={styles.tabRow}>
          <TouchableOpacity 
            testID="tab-total"
            onPress={() => setTab('total')} 
            style={[styles.tabBtn, tab === 'total' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'total' && styles.tabTextActive]}>
              {t('rankings.tab_total')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            testID="tab-weekly"
            onPress={() => setTab('weekly')} 
            style={[styles.tabBtn, tab === 'weekly' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>
              {t('rankings.tab_weekly')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Matchday Selector */}
      {tab === 'weekly' && (
        <View>
          <TouchableOpacity 
            testID="matchday-selector"
            onPress={() => setShowMatchdayPicker(true)}
            style={[
              styles.matchdaySelector,
              isLiveMatchday && styles.matchdaySelectorLive,
            ]}
          >
            <Ionicons name={isLiveMatchday ? "pulse" : "calendar-outline"} size={18} color={isLiveMatchday ? colors.success : colors.primary} />
            <Text style={styles.matchdaySelectorText}>
              {selectedMatchday ? `Giornata ${selectedMatchday.number}` : 'Seleziona giornata'}
            </Text>
            <View style={[
              styles.matchdaySelectorBadge,
              isLiveMatchday && { backgroundColor: 'rgba(34,197,94,0.15)' },
            ]}>
              <Text style={[
                styles.matchdaySelectorBadgeText,
                isLiveMatchday && { color: colors.success },
              ]}>
                {selectedMatchday?.status || ''}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          {isLiveMatchday && (
            <View style={styles.liveBanner} data-testid="live-standings-banner">
              <View style={styles.liveBannerDot} />
              <Text style={styles.liveBannerText}>Classifica in tempo reale</Text>
            </View>
          )}
        </View>
      )}

      {/* Standings List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Search Bar */}
          <View style={styles.searchContainer} data-testid="search-bar">
            <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca utente..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              data-testid="search-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} data-testid="search-clear">
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.listCardOuter}>
            <LinearGradient
              colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.listCard}
            >
              <AnimatedSweep />
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry: StandingEntry, i: number) => renderEntry(entry, i))
            ) : (
              <View style={styles.emptySearch} data-testid="no-results">
                <Ionicons name="person-outline" size={32} color="rgba(255,255,255,0.4)" />
                <Text style={styles.emptySearchText}>Nessun utente trovato</Text>
              </View>
            )}
            </LinearGradient>
          </View>

          {standings?.my_position && !standings.entries?.find((e: StandingEntry) => e.is_current_user) && (
            <View style={styles.myPositionCard}>
              <Ionicons name="person-outline" size={18} color={colors.accent} />
              <Text style={styles.myPositionText}>
                La tua posizione: #{standings.my_position.rank}
              </Text>
              <Text style={styles.myPositionPoints}>
                {formatPoints(standings.my_position.total_points || standings.my_position.matchday_points || 0)} pts
              </Text>
            </View>
          )}

          {(!standings?.entries || standings.entries.length === 0) && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>In attesa del kickoff</Text>
              <Text style={styles.emptySubtitle}>
                La classifica sarà disponibile dopo l'inizio delle partite
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Matchday Picker Modal */}
      <Modal
        visible={showMatchdayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMatchdayPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMatchdayPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona Giornata</Text>
              <TouchableOpacity onPress={() => setShowMatchdayPicker(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={matchdays}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.matchdayItem,
                    selectedMatchday?.id === item.id && styles.matchdayItemActive
                  ]}
                  onPress={() => {
                    setSelectedMatchday(item);
                    setShowMatchdayPicker(false);
                  }}
                >
                  <Text style={styles.matchdayItemText}>
                    Giornata {item.number}
                  </Text>
                  <StatusBadge status={item.status} />
                  {selectedMatchday?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  // Header
  header: { 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.lg,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: { 
    ...typography.titleL,
    color: colors.textPrimary,
  },
  accentLine: {
    width: 32,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
    borderRadius: 2,
  },
  
  // League selector
  singleLeagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  singleLeagueText: {
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  
  // Tab toggle
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  tabRow: { 
    flexDirection: 'row', 
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl, 
    padding: spacing.xs,
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.lg, 
    alignItems: 'center' 
  },
  tabBtnActive: {
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  tabText: { 
    ...typography.bodyM,
    color: 'rgba(255,255,255,0.55)',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  
  // League header (blue box with league name)
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  leagueHeaderText: {
    ...typography.bodyM,
    color: colors.textInverse,
    fontWeight: '700',
  },
  
  // Matchday selector
  matchdaySelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: spacing.lg, 
    marginTop: spacing.md, 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.xl, 
    backgroundColor: '#1F4C8F',
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    gap: spacing.sm,
  },
  matchdaySelectorLive: {
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  matchdaySelectorText: { 
    flex: 1, 
    ...typography.bodyM,
    color: '#FFFFFF',
  },
  matchdaySelectorBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.infoLight,
  },
  matchdaySelectorBadgeText: {
    ...typography.metaSmall,
    color: colors.info,
    fontWeight: '600',
  },
  
  // LIVE banner
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  liveBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // List
  scrollContent: { 
    padding: spacing.lg, 
    paddingBottom: 100 
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: '#FFFFFF',
    height: '100%',
    paddingVertical: 0,
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptySearchText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.5)',
  },
  listCardOuter: {
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.accent,
    overflow: 'hidden',
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  listCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  
  // Entry row
  entryRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: spacing.md,
  },
  entryRowTop3: {
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  entryRowCurrent: {
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  currentUserAccent: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop3: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  rankText: {
    ...typography.bodyM,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
  },
  rankTextTop3: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
  },
  
  entryInfo: { 
    flex: 1 
  },
  entryName: { 
    ...typography.bodyM,
    color: '#FFFFFF',
  },
  entryNameBold: {
    fontWeight: '700',
  },
  entryMeta: { 
    ...typography.metaSmall,
    color: 'rgba(255,255,255,0.45)',
    marginTop: spacing.xs,
  },
  
  pointsContainer: { 
    alignItems: 'flex-end',
    marginRight: spacing.xs,
  },
  pointsText: { 
    ...typography.statMedium,
    color: '#FFFFFF',
  },
  pointsTextLarge: {
    fontSize: 20,
    fontWeight: '800',
  },
  weekBonus: { 
    ...typography.metaSmall,
    color: colors.success,
    marginTop: spacing.xs,
  },
  
  // My position
  myPositionCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.md, 
    padding: spacing.lg, 
    borderRadius: borderRadius.lg, 
    backgroundColor: colors.cardHighlight,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: spacing.lg,
  },
  myPositionText: { 
    flex: 1, 
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  myPositionPoints: { 
    ...typography.statMedium,
    color: colors.accent,
  },
  
  // Empty state
  emptyState: { 
    alignItems: 'center', 
    marginTop: 60,
    padding: spacing.xxl,
  },
  emptyTitle: { 
    ...typography.titleM,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: { 
    ...typography.bodyS,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  
  // Modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl, 
    borderTopRightRadius: borderRadius.xl, 
    maxHeight: '60%', 
    paddingBottom: 34,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: spacing.lg, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderLight,
  },
  modalTitle: { 
    ...typography.titleM,
    color: colors.textPrimary,
  },
  matchdayItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.lg, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  matchdayItemActive: {
    backgroundColor: colors.accentLight,
  },
  matchdayItemText: { 
    flex: 1, 
    ...typography.bodyM,
    color: colors.textPrimary,
  },
});
