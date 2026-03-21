import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Image, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { AnimatedSweep } from '../../src/components/ui';
import { MatchDetailSheet } from '../../src/components/MatchDetailSheet';

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
  home_goals: number | null;
  away_goals: number | null;
  round: string | null;
};

type TabView = 'standings' | 'results' | 'upcoming';

const COUNTRY_FLAGS: Record<string, string> = {
  Italy: '\u{1F1EE}\u{1F1F9}',
  England: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Spain: '\u{1F1EA}\u{1F1F8}',
  Germany: '\u{1F1E9}\u{1F1EA}',
  France: '\u{1F1EB}\u{1F1F7}',
};

/* ─── SANITIZE HELPERS ─── */

function safeString(val: unknown, fallback: string): string {
  if (typeof val === 'string' && val.length > 0) return val;
  return fallback;
}

function safeStringOrNull(val: unknown): string | null {
  if (typeof val === 'string' && val.length > 0) return val;
  return null;
}

function safeNumber(val: unknown): number | null {
  if (typeof val === 'number' && isFinite(val)) return val;
  return null;
}

function sanitizeFixture(raw: unknown): FixtureEntry | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const fixture_id = safeNumber(obj.fixture_id);
  if (fixture_id === null) return null;

  const home_team = safeString(obj.home_team, '');
  const away_team = safeString(obj.away_team, '');
  if (home_team === '' && away_team === '') return null;

  const date = safeString(obj.date, '');

  return {
    fixture_id: fixture_id,
    date: date,
    home_team: home_team || '?',
    home_logo: safeStringOrNull(obj.home_logo),
    away_team: away_team || '?',
    away_logo: safeStringOrNull(obj.away_logo),
    home_goals: safeNumber(obj.home_goals),
    away_goals: safeNumber(obj.away_goals),
    round: safeStringOrNull(obj.round),
  };
}

function sanitizeFixtures(input: unknown): FixtureEntry[] {
  if (!Array.isArray(input)) return [];
  const out: FixtureEntry[] = [];
  for (let i = 0; i < input.length; i++) {
    const f = sanitizeFixture(input[i]);
    if (f !== null) out.push(f);
  }
  return out;
}

function safeFormatDate(iso: unknown): string {
  if (typeof iso !== 'string' || iso.length === 0) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch {
    return '-';
  }
}

function safeFormatTime(iso: unknown): string {
  if (typeof iso !== 'string' || iso.length === 0) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

function safeFormatRound(round: string | null): string {
  if (typeof round !== 'string' || round.length === 0) return '';
  try {
    return round.replace('Regular Season - ', 'Giornata ');
  } catch {
    return '';
  }
}

function safeFormatRoundShort(round: string | null): string {
  if (typeof round !== 'string' || round.length === 0) return '';
  try {
    return round.replace('Regular Season - ', 'G');
  } catch {
    return '';
  }
}

/* ─── MAIN SCREEN ─── */

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
  const [detailFixtureId, setDetailFixtureId] = useState<number | null>(null);

  const fetchLeagues = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiCall<StatsLeague[]>('/stats/leagues', { token });
      const safe = Array.isArray(data) ? data : [];
      setLeagues(safe);
      if (safe.length > 0 && !selectedLeague) {
        setSelectedLeague(safe[0]);
      }
    } catch {
      setLeagues([]);
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
        const data = await apiCall<{ standings: unknown }>(
          `/stats/standings/${league.league_id}?season=${season}`, { token }
        );
        const raw = data && typeof data === 'object' ? (data as any).standings : undefined;
        setStandings(Array.isArray(raw) ? raw : []);
      } else if (tab === 'results') {
        const data = await apiCall<{ fixtures: unknown }>(
          `/stats/results/${league.league_id}?season=${season}&last=30`, { token }
        );
        const raw = data && typeof data === 'object' ? (data as any).fixtures : undefined;
        setResults(sanitizeFixtures(raw));
      } else if (tab === 'upcoming') {
        const data = await apiCall<{ fixtures: unknown }>(
          `/stats/upcoming/${league.league_id}?season=${season}&next=30`, { token }
        );
        const raw = data && typeof data === 'object' ? (data as any).fixtures : undefined;
        setUpcoming(sanitizeFixtures(raw));
      }
    } catch {
      if (tab === 'standings') setStandings([]);
      else if (tab === 'results') setResults([]);
      else setUpcoming([]);
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
      <LinearGradient
        colors={['#F5F6F8', '#ECEFF3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* HEADER */}
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={22} color={colors.primary} />
        <Text style={styles.headerTitle}>Statistiche</Text>
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
            standings: 'Classifica',
            results: 'Risultati',
            upcoming: 'Prossime',
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
            selectedRound={selectedRound}
            onSelectRound={setSelectedRound}
            onFixturePress={(fixtureId) => setDetailFixtureId(fixtureId)}
          />
        )}
      </ScrollView>

      {/* Match Detail Sheet */}
      <MatchDetailSheet
        fixtureId={detailFixtureId}
        token={token || ''}
        visible={!!detailFixtureId}
        onClose={() => setDetailFixtureId(null)}
      />
    </SafeAreaView>
  );
}

/* ─── STANDINGS TABLE ─── */
function StandingsTable({ entries }: { entries: StandingEntry[] }) {
  const safe = Array.isArray(entries) ? entries : [];
  if (safe.length === 0) {
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

      {safe.map((row, idx) => {
        if (!row) return null;
        const rank = typeof row.rank === 'number' ? row.rank : idx + 1;
        const isTop4 = rank <= 4;
        const isRelegation = rank >= safe.length - 2;
        const goalDiff = typeof row.goal_diff === 'number' ? row.goal_diff : 0;
        return (
          <View key={`${rank}-${idx}`} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]} data-testid={`standing-row-${rank}`}>
            <View style={[styles.rankIndicator, isTop4 && styles.rankTop, isRelegation && styles.rankBottom]} />
            <Text style={[styles.tableCell, { width: 30 }, isTop4 && styles.tableCellBold]}>{rank}</Text>
            <View style={[styles.teamCell, { flex: 1 }]}>
              {row.team_logo ? <Image source={{ uri: row.team_logo }} style={styles.teamLogo} /> : null}
              <Text style={styles.teamName} numberOfLines={1}>{row.team_name || '?'}</Text>
            </View>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.played || 0}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.win || 0}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.draw || 0}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 30 }]}>{row.lose || 0}</Text>
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: 36 }]}>{goalDiff > 0 ? `+${goalDiff}` : goalDiff}</Text>
            <Text style={[styles.tableCell, styles.tableCellRight, styles.tableCellBold, { width: 36 }]}>{row.points || 0}</Text>
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
  selectedRound,
  onSelectRound,
  onFixturePress,
}: {
  fixtures: FixtureEntry[];
  showScore?: boolean;
  selectedRound: string | null;
  onSelectRound: (round: string | null) => void;
  onFixturePress?: (fixtureId: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // DEFENSE: ensure fixtures is always a safe array
  const safeFixtures = Array.isArray(fixtures) ? fixtures : [];

  // Extract unique rounds preserving order
  const rounds = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (let i = 0; i < safeFixtures.length; i++) {
      const f = safeFixtures[i];
      if (!f) continue;
      const r = typeof f.round === 'string' ? f.round : '';
      if (r.length > 0 && !seen.has(r)) {
        seen.add(r);
        list.push(r);
      }
    }
    return list;
  }, [safeFixtures]);

  // Auto-select first round when data loads and no round selected
  useEffect(() => {
    if (rounds.length > 0 && !selectedRound) {
      onSelectRound(rounds[0]);
    }
  }, [rounds]);

  // Filter fixtures by selected round
  const filtered = useMemo(() => {
    if (!selectedRound) return safeFixtures;
    return safeFixtures.filter(f => f && f.round === selectedRound);
  }, [safeFixtures, selectedRound]);

  if (safeFixtures.length === 0) {
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
            {selectedRound ? safeFormatRound(selectedRound) : 'Tutte le giornate'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Filtered fixtures */}
      {filtered.map((f, idx) => {
        if (!f || typeof f.fixture_id !== 'number') return null;
        const homeGoals = f.home_goals;
        const awayGoals = f.away_goals;
        return (
          <TouchableOpacity
            key={`${f.fixture_id}-${idx}`}
            style={styles.fixtureCard}
            data-testid={`fixture-${f.fixture_id}`}
            activeOpacity={0.7}
            onPress={() => onFixturePress?.(f.fixture_id)}
          >
            <View style={styles.fixtureTeams}>
              <View style={styles.fixtureTeamRow}>
                {f.home_logo ? <Image source={{ uri: f.home_logo }} style={styles.fixtureTeamLogo} /> : null}
                <Text style={styles.fixtureTeamName} numberOfLines={1}>{f.home_team || '?'}</Text>
                {showScore && homeGoals !== null && homeGoals !== undefined && typeof homeGoals === 'number' && (
                  <Text style={styles.fixtureScore}>{homeGoals}</Text>
                )}
              </View>
              <View style={styles.fixtureTeamRow}>
                {f.away_logo ? <Image source={{ uri: f.away_logo }} style={styles.fixtureTeamLogo} /> : null}
                <Text style={styles.fixtureTeamName} numberOfLines={1}>{f.away_team || '?'}</Text>
                {showScore && awayGoals !== null && awayGoals !== undefined && typeof awayGoals === 'number' && (
                  <Text style={styles.fixtureScore}>{awayGoals}</Text>
                )}
              </View>
            </View>
            <View style={styles.fixtureMeta}>
              <Text style={styles.fixtureDate}>{safeFormatDate(f.date)}</Text>
              {!showScore && <Text style={styles.fixtureTime}>{safeFormatTime(f.date)}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        );
      })}

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
                      {safeFormatRound(item)}
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: '#F3F4F6',
    flexShrink: 0,
  },
  headerTitle: {
    ...typography.titleL,
    color: colors.textPrimary,
  },

  leagueSelector: {
    backgroundColor: '#F3F4F6',
    flexShrink: 0,
    flexGrow: 0,
    height: 64,
  },
  leagueSelectorContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    gap: 10,
    flexDirection: 'row',
  },
  leagueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexShrink: 0,
  },
  leagueChipActive: {
    backgroundColor: '#1F4C8F',
    borderColor: '#1F4C8F',
  },
  leagueChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 0,
  },
  leagueChipTextActive: {
    color: '#fff',
  },
  leagueLogo: { width: 20, height: 20, borderRadius: 10 },
  leagueFlag: { fontSize: 16 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing.lg,
    flexShrink: 0,
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

  tableCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: '#1F4C8F',
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
  rankTop: { backgroundColor: colors.accent },
  rankBottom: { backgroundColor: colors.error },

  roundPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roundPickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

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

  fixtureCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
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
