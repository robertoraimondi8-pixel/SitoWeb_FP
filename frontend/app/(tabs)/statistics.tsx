import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Image,
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
  Italy: '🇮🇹',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Spain: '🇪🇸',
  Germany: '🇩🇪',
  France: '🇫🇷',
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

  // Fetch available leagues
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

  // Fetch data for the selected tab
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
          `/stats/results/${league.league_id}?season=${season}&last=20`, { token }
        );
        setResults(data.fixtures || []);
      } else if (tab === 'upcoming') {
        const data = await apiCall<{ fixtures: FixtureEntry[] }>(
          `/stats/upcoming/${league.league_id}?season=${season}&next=20`, { token }
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
    if (selectedLeague) fetchTabData(activeTab, selectedLeague);
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

  const formatRound = (round?: string) => {
    if (!round) return '';
    return round.replace('Regular Season - ', 'G');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
                <Text style={styles.leagueFlag}>{COUNTRY_FLAGS[lg.country] || '⚽'}</Text>
              )}
              <Text style={[styles.leagueChipText, isActive && styles.leagueChipTextActive]} numberOfLines={1}>
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
        ) : activeTab === 'results' ? (
          <FixturesList fixtures={results} showScore formatDate={formatDate} formatTime={formatTime} formatRound={formatRound} />
        ) : (
          <FixturesList fixtures={upcoming} formatDate={formatDate} formatTime={formatTime} formatRound={formatRound} />
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
      {/* Table header */}
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

/* ─── FIXTURES LIST ─── */
function FixturesList({
  fixtures,
  showScore,
  formatDate,
  formatTime,
  formatRound,
}: {
  fixtures: FixtureEntry[];
  showScore?: boolean;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  formatRound: (r?: string) => string;
}) {
  if (fixtures.length === 0) {
    return <Text style={styles.emptyText}>Nessun dato disponibile</Text>;
  }

  // Group by round
  const grouped: Record<string, FixtureEntry[]> = {};
  for (const f of fixtures) {
    const key = f.round || 'Altro';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  }

  return (
    <View>
      {Object.entries(grouped).map(([round, fixes]) => (
        <View key={round} style={styles.roundGroup}>
          <Text style={styles.roundLabel}>{formatRound(round)}</Text>
          {fixes.map((f) => (
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
        </View>
      ))}
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

  // League selector
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
  },
  leagueChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  leagueChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
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

  // ── Fixtures ──
  roundGroup: {
    marginBottom: spacing.lg,
  },
  roundLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
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
