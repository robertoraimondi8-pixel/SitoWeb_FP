import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Image, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

type StatsLeague = {
  league_id: number;
  name: string;
  country: string;
  logo: string | null;
  current_season: number | null;
};

type StandingEntry = {
  rank: number;
  team_name: string;
  team_logo: string | null;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  form: string | null;
};

type FixtureEntry = {
  fixture_id: number;
  date: string;
  home_team: string;
  home_logo: string | null;
  away_team: string;
  away_logo: string | null;
  home_goals?: number | null;
  away_goals?: number | null;
  round?: string;
};

type TabView = 'standings' | 'results' | 'upcoming';

const COUNTRY_FLAGS: Record<string, string> = {
  Italy: '\u{1F1EE}\u{1F1F9}',
  England: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Spain: '\u{1F1EA}\u{1F1F8}',
  Germany: '\u{1F1E9}\u{1F1EA}',
  France: '\u{1F1EB}\u{1F1F7}',
};

const formatRound = (round?: string) => {
  if (!round) return '';
  return round.replace('Regular Season - ', 'Giornata ');
};

const formatRoundShort = (round?: string) => {
  if (!round) return '';
  return round.replace('Regular Season - ', 'G');
};

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [leagues, setLeagues] = useState<StatsLeague[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<StatsLeague | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>('standings');
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [results, setResults] = useState<FixtureEntry[]>([]);
  const [upcoming, setUpcoming] = useState<FixtureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);

  const fetchLeagues = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiCall<StatsLeague[]>('/stats/leagues', { token });
      setLeagues(data);
      if (data.length > 0 && !selectedLeague) {
        setSelectedLeague(data[0]);
      }
    } catch (e) {
      console.error('Stats leagues error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchTabData = useCallback(async (tab: TabView, league: StatsLeague) => {
    if (!token || !league) return;
    setTabLoading(true);
    const season = league.current_season || 2025;
    try {
      if (tab === 'standings') {
        const data = await apiCall<{ standings: StandingEntry[] }>(
          `/stats/standings/${league.league_id}?season=${season}`, { token }
        );
        setStandings(data.standings || []);
      } else if (tab === 'results') {
        const data = await apiCall<{ fixtures: FixtureEntry[] }>(
          `/stats/results/${league.league_id}?season=${season}&last=30`, { token }
        );
        setResults(data.fixtures || []);
      } else if (tab === 'upcoming') {
        const data = await apiCall<{ fixtures: FixtureEntry[] }>(
          `/stats/upcoming/${league.league_id}?season=${season}&next=30`, { token }
        );
        setUpcoming(data.fixtures || []);
      }
    } catch (e) {
      console.error(`Stats ${tab} error:`, e);
    } finally {
      setTabLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

  useEffect(() => {
    if (selectedLeague) {
      setSelectedRound(null);
      fetchTabData(activeTab, selectedLeague);
    }
  }, [selectedLeague, activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedLeague) await fetchTabData(activeTab, selectedLeague);
    setRefreshing(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const currentFixtures = activeTab === 'results' ? results : upcoming;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={22} color={colors.primary} />
        <Text style={styles.headerTitle}>{t('stats.title', { defaultValue: 'Statistiche' })}</Text>
      </View>

      {/* LEAGUE SELECTOR */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.leagueSelector}
        contentContainerStyle={styles.leagueSelectorContent}
      >
        {leagues.map((lg) => {
          const isActive = selectedLeague?.league_id === lg.league_id;
          return (
            <TouchableOpacity
              key={lg.league_id}
              style={[styles.leagueChip, isActive && styles.leagueChipActive]}
              onPress={() => setSelectedLeague(lg)}
              data-testid={`league-chip-${lg.league_id}`}
            >
              {lg.logo ? (
                <Image source={{ uri: lg.logo }} style={styles.leagueLogo} />
              ) : (
                <Text style={styles.leagueFlag}>{COUNTRY_FLAGS[lg.country] || '\u26BD'}</Text>
              )}
              <Text style={[styles.leagueChipText, isActive && styles.leagueChipTextActive]}>
                {lg.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* SUB-TAB BAR */}
      <View style={styles.tabBar}>
        {(['standings', 'results', 'upcoming'] as TabView[]).map((tab) => {
          const isActive = activeTab === tab;
          const labels: Record<TabView, string> = {
            standings: t('stats.standings', { defaultValue: 'Classifica' }),
            results: t('stats.results', { defaultValue: 'Risultati' }),
            upcoming: t('stats.upcoming', { defaultValue: 'Prossime' }),
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
              data-testid={`stats-tab-${tab}`}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {tabLoading ? (
          <View style={styles.tabLoadingWrap}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : activeTab === 'standings' ? (
          <StandingsTable entries={standings} />
        ) : (
          <FixturesWithRoundPicker
            fixtures={currentFixtures}
            showScore={activeTab === 'results'}
            formatDate={formatDate}
            formatTime={formatTime}
            selectedRound={selectedRound}
            onSelectRound={setSelectedRound}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── STANDINGS TABLE ─── */
function StandingsTable({ entries }: { entries: StandingEntry[] }) {
  if (entries.length === 0) {
    return <Text style={styles.emptyText}>Nessun dato disponibile</Text>;
  }

  return (
    <View style={styles.tableCard}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { width: 30 }]}>#</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Squadra</Text>
        <Text style={[styles.tableHeaderCell, styles.tableCellCenter, { width: 30 }]}>G</Text>
        <Text style={[styles.tableHeaderCell, styles.tableCellCenter, { width: 30 }]}>V</Text>
        <Text style={[styles.tableHeaderCell, styles.tableCellCenter, { width: 30 }]}>P</Text>
        <Text style={[styles.tableHeaderCell, styles.tableCellCenter, { width: 30 }]}>S</Text>
        <Text style={[styles.tableHeaderCell, styles.tableCellCenter, { width: 36 }]}>DR</Text>
        <Text style={[styles.tableHeaderCell, styles.tableCellRight, { width: 36 }]}>Pts</Text>
      </View>

      {entries.map((row, idx) => {
        const isTop4 = row.rank <= 4;
        const isRelegation = row.rank >= entries.length - 2;
        return (
          <View key={row.rank} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]} data-testid={`standing-row-${row.rank}`}>
            <View style={[styles.rankIndicator, isTop4 && styles.rankTop, isRelegation && styles.rankBottom]} />
            <Text style={[styles.tableCell, { width: 30 }, isTop4 && styles.tableCellBold]}>{row.rank}</Text>
            <View style={[styles.teamCell, { flex: 1 }]}>
              {row.team_logo && <Image source={{ uri: row.team_logo }} style={styles.teamLogo} />}
              <Text style={styles.teamName} numberOfLines={1}>{row.team_name}</Text>
            </View>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.played}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.win}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.draw}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.lose}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 36 }]}>{row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}</Text>
            <Text style={[styles.tableCell, styles.tableCellRight, styles.tableCellBold, { width: 36 }]}>{row.points}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ─── FIXTURES WITH ROUND PICKER ─── */
function FixturesWithRoundPicker({
  fixtures,
  showScore,
  formatDate,
  formatTime,
  selectedRound,
  onSelectRound,
}: {
  fixtures: FixtureEntry[];
  showScore?: boolean;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  selectedRound: string | null;
  onSelectRound: (round: string | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Extract unique rounds preserving order
  const rounds = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const f of fixtures) {
      const r = f.round || '';
      if (r && !seen.has(r)) {
        seen.add(r);
        list.push(r);
      }
    }
    return list;
  }, [fixtures]);

  // Auto-select first round when data loads and no round selected
  useEffect(() => {
    if (rounds.length > 0 && !selectedRound) {
      onSelectRound(rounds[0]);
    }
  }, [rounds]);

  // Filter fixtures by selected round
  const filtered = useMemo(() => {
    if (!selectedRound) return fixtures;
    return fixtures.filter(f => f.round === selectedRound);
  }, [fixtures, selectedRound]);

  if (fixtures.length === 0) {
    return <Text style={styles.emptyText}>Nessun dato disponibile</Text>;
  }

  return (
    <View>
      {/* Round Picker Button */}
      {rounds.length > 0 && (
        <TouchableOpacity
          style={styles.roundPickerBtn}
          onPress={() => setPickerOpen(true)}
          data-testid="round-picker-button"
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.roundPickerText}>
            {selectedRound ? formatRound(selectedRound) : 'Tutte le giornate'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Filtered fixtures */}
      {filtered.map((f) => (
        <View key={f.fixture_id} style={styles.fixtureCard} data-testid={`fixture-${f.fixture_id}`}>
          <View style={styles.fixtureTeams}>
            <View style={styles.fixtureTeamRow}>
              {f.home_logo && <Image source={{ uri: f.home_logo }} style={styles.fixtureTeamLogo} />}
              <Text style={styles.fixtureTeamName} numberOfLines={1}>{f.home_team}</Text>
              {showScore && f.home_goals != null && (
                <Text style={styles.fixtureScore}>{f.home_goals}</Text>
              )}
            </View>
            <View style={styles.fixtureTeamRow}>
              {f.away_logo && <Image source={{ uri: f.away_logo }} style={styles.fixtureTeamLogo} />}
              <Text style={styles.fixtureTeamName} numberOfLines={1}>{f.away_team}</Text>
              {showScore && f.away_goals != null && (
                <Text style={styles.fixtureScore}>{f.away_goals}</Text>
              )}
            </View>
          </View>
          <View style={styles.fixtureMeta}>
            <Text style={styles.fixtureDate}>{formatDate(f.date)}</Text>
            {!showScore && <Text style={styles.fixtureTime}>{formatTime(f.date)}</Text>}
          </View>
        </View>
      ))}

      {/* Round Picker Modal */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Seleziona Giornata</Text>

            {/* "All rounds" option */}
            <TouchableOpacity
              style={[styles.modalItem, !selectedRound && styles.modalItemActive]}
              onPress={() => { onSelectRound(null); setPickerOpen(false); }}
              data-testid="round-option-all"
            >
              <Text style={[styles.modalItemText, !selectedRound && styles.modalItemTextActive]}>
                Tutte le giornate
              </Text>
              {!selectedRound && <Ionicons name="checkmark" size={18} color={colors.accent} />}
            </TouchableOpacity>

            <FlatList
              data={rounds}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isActive = selectedRound === item;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isActive && styles.modalItemActive]}
                    onPress={() => { onSelectRound(item); setPickerOpen(false); }}
                    data-testid={`round-option-${item}`}
                  >
                    <Text style={[styles.modalItemText, isActive && styles.modalItemTextActive]}>
                      {formatRound(item)}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 400 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.titleL,
    color: colors.textPrimary,
  },

  // League selector — chips must NOT shrink
  leagueSelector: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 56,
  },
  leagueSelectorContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  leagueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  leagueChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  leagueChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 0,
  },
  leagueChipTextActive: {
    color: '#fff',
  },
  leagueLogo: { width: 20, height: 20, borderRadius: 10 },
  leagueFlag: { fontSize: 16 },

  // Sub-tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },

  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl + 32,
  },
  tabLoadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodyM,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 40,
  },

  // ── Standings Table ──
  tableCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.primary,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.background,
  },
  tableCell: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  tableCellCenter: { textAlign: 'center' },
  tableCellRight: { textAlign: 'right' },
  tableCellBold: { fontWeight: '700' },
  teamCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamLogo: { width: 20, height: 20, borderRadius: 4 },
  teamName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  rankIndicator: {
    width: 3,
    height: '70%',
    borderRadius: 2,
    marginRight: 6,
    backgroundColor: 'transparent',
  },
  rankTop: { backgroundColor: colors.primaryLight },
  rankBottom: { backgroundColor: colors.error },

  // ── Round Picker ──
  roundPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roundPickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalItemActive: {
    backgroundColor: colors.background,
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  modalItemTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },

  // ── Fixtures ──
  fixtureCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.card,
  },
  fixtureTeams: {
    flex: 1,
    gap: 6,
  },
  fixtureTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fixtureTeamLogo: { width: 18, height: 18, borderRadius: 3 },
  fixtureTeamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  fixtureScore: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 20,
    textAlign: 'right',
  },
  fixtureMeta: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  fixtureDate: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  fixtureTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
