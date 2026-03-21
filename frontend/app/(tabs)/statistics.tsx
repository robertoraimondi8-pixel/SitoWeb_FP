import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';

/* ─── TYPES ─── */

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

/* ─── SAFE HELPERS (no external deps, pure functions, try/catch everything) ─── */

function safeStr(v: unknown, fb: string): string {
  if (typeof v === 'string' && v.length > 0) return v;
  return fb;
}

function safeNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  return null;
}

function safeDate(iso: unknown): string {
  if (typeof iso !== 'string' || iso.length === 0) return '-';
  try {
    var d = new Date(iso);
    var t = d.getTime();
    if (t !== t) return '-'; // NaN check without isNaN
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch (e) {
    return '-';
  }
}

function safeTime(iso: unknown): string {
  if (typeof iso !== 'string' || iso.length === 0) return '-';
  try {
    var d = new Date(iso);
    var t = d.getTime();
    if (t !== t) return '-'; // NaN check without isNaN
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
}

function cleanFixtures(raw: unknown): FixtureEntry[] {
  if (!Array.isArray(raw)) return [];
  var out: FixtureEntry[] = [];
  for (var i = 0; i < raw.length; i++) {
    try {
      var item = raw[i];
      if (!item || typeof item !== 'object') continue;
      var o = item as Record<string, unknown>;
      var fid = safeNum(o.fixture_id);
      if (fid === null) continue;
      var ht = safeStr(o.home_team, '');
      var at = safeStr(o.away_team, '');
      if (ht === '' && at === '') continue;
      out.push({
        fixture_id: fid,
        date: safeStr(o.date, ''),
        home_team: ht || '?',
        home_logo: null, // intentionally null — no images
        away_team: at || '?',
        away_logo: null, // intentionally null — no images
        home_goals: safeNum(o.home_goals),
        away_goals: safeNum(o.away_goals),
        round: typeof o.round === 'string' ? o.round : null,
      });
    } catch (e) {
      continue;
    }
  }
  return out;
}

function groupByRound(fixtures: FixtureEntry[]): { round: string; items: FixtureEntry[] }[] {
  var map: Record<string, FixtureEntry[]> = {};
  var order: string[] = [];
  for (var i = 0; i < fixtures.length; i++) {
    var f = fixtures[i];
    var r = f.round || 'Altro';
    if (!map[r]) {
      map[r] = [];
      order.push(r);
    }
    map[r].push(f);
  }
  return order.map(function(r) { return { round: r, items: map[r] }; });
}

function formatRoundLabel(r: string): string {
  if (typeof r !== 'string') return '';
  try {
    return r.replace('Regular Season - ', 'Giornata ');
  } catch (e) {
    return r;
  }
}

/* ─── MAIN SCREEN ─── */

export default function StatisticsScreen() {
  var auth = useAuth();
  var token = auth ? auth.token : null;

  var [leagues, setLeagues] = useState<StatsLeague[]>([]);
  var [selectedLeague, setSelectedLeague] = useState<StatsLeague | null>(null);
  var [activeTab, setActiveTab] = useState<TabView>('standings');
  var [standings, setStandings] = useState<StandingEntry[]>([]);
  var [results, setResults] = useState<FixtureEntry[]>([]);
  var [upcoming, setUpcoming] = useState<FixtureEntry[]>([]);
  var [loading, setLoading] = useState(true);
  var [tabLoading, setTabLoading] = useState(false);
  var [refreshing, setRefreshing] = useState(false);

  var fetchLeagues = useCallback(function() {
    if (!token) return;
    apiCall('/stats/leagues', { token: token })
      .then(function(data: any) {
        var safe = Array.isArray(data) ? data : [];
        setLeagues(safe);
        if (safe.length > 0 && !selectedLeague) {
          setSelectedLeague(safe[0]);
        }
      })
      .catch(function() { setLeagues([]); })
      .finally(function() { setLoading(false); });
  }, [token]);

  var fetchTabData = useCallback(function(tab: TabView, league: StatsLeague) {
    if (!token || !league) return;
    setTabLoading(true);
    var season = league.current_season || 2025;

    if (tab === 'standings') {
      apiCall('/stats/standings/' + league.league_id + '?season=' + season, { token: token })
        .then(function(data: any) {
          var raw = data && typeof data === 'object' ? data.standings : undefined;
          setStandings(Array.isArray(raw) ? raw : []);
        })
        .catch(function() { setStandings([]); })
        .finally(function() { setTabLoading(false); });
    } else if (tab === 'results') {
      apiCall('/stats/results/' + league.league_id + '?season=' + season + '&last=30', { token: token })
        .then(function(data: any) {
          var raw = data && typeof data === 'object' ? data.fixtures : undefined;
          setResults(cleanFixtures(raw));
        })
        .catch(function() { setResults([]); })
        .finally(function() { setTabLoading(false); });
    } else {
      apiCall('/stats/upcoming/' + league.league_id + '?season=' + season + '&next=30', { token: token })
        .then(function(data: any) {
          var raw = data && typeof data === 'object' ? data.fixtures : undefined;
          setUpcoming(cleanFixtures(raw));
        })
        .catch(function() { setUpcoming([]); })
        .finally(function() { setTabLoading(false); });
    }
  }, [token]);

  useEffect(function() { fetchLeagues(); }, [fetchLeagues]);

  useEffect(function() {
    if (selectedLeague) {
      fetchTabData(activeTab, selectedLeague);
    }
  }, [selectedLeague, activeTab]);

  var onRefresh = function() {
    setRefreshing(true);
    if (selectedLeague) {
      fetchTabData(activeTab, selectedLeague);
    }
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* HEADER — plain View, no LinearGradient */}
      <View style={s.header}>
        <Ionicons name="stats-chart" size={22} color={colors.primary} />
        <Text style={s.headerTitle}>Statistiche</Text>
        <Text style={{ fontSize: 10, color: '#999', marginLeft: 'auto' }}>v-EM-0321</Text>
      </View>

      {/* LEAGUE CHIPS — no Image, text only */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.leagueBar} contentContainerStyle={s.leagueBarContent}>
        {leagues.map(function(lg) {
          var isActive = selectedLeague ? selectedLeague.league_id === lg.league_id : false;
          return (
            <TouchableOpacity
              key={lg.league_id}
              style={[s.chip, isActive && s.chipActive]}
              onPress={function() { setSelectedLeague(lg); }}
            >
              <Text style={[s.chipText, isActive && s.chipTextActive]}>{lg.name || '?'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* TAB BAR */}
      <View style={s.tabBar}>
        {(['standings', 'results', 'upcoming'] as TabView[]).map(function(tab) {
          var isActive = activeTab === tab;
          var label = tab === 'standings' ? 'Classifica' : tab === 'results' ? 'Risultati' : 'Prossime';
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, isActive && s.tabItemActive]}
              onPress={function() { setActiveTab(tab); }}
            >
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        {tabLoading ? (
          <View style={s.tabLoadingWrap}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : activeTab === 'standings' ? (
          <SimpleStandings entries={standings} />
        ) : (
          <SimpleFixtures fixtures={activeTab === 'results' ? results : upcoming} showScore={activeTab === 'results'} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── STANDINGS (no Image, text only) ─── */
function SimpleStandings(props: { entries: StandingEntry[] }) {
  var safe = Array.isArray(props.entries) ? props.entries : [];
  if (safe.length === 0) {
    return <Text style={s.emptyText}>Nessun dato disponibile</Text>;
  }

  return (
    <View style={s.tableCard}>
      <View style={s.tableHeaderRow}>
        <Text style={[s.th, { width: 30 }]}>#</Text>
        <Text style={[s.th, { flex: 1 }]}>Squadra</Text>
        <Text style={[s.th, s.tc, { width: 30 }]}>G</Text>
        <Text style={[s.th, s.tc, { width: 30 }]}>V</Text>
        <Text style={[s.th, s.tc, { width: 30 }]}>P</Text>
        <Text style={[s.th, s.tc, { width: 30 }]}>S</Text>
        <Text style={[s.th, s.tc, { width: 36 }]}>DR</Text>
        <Text style={[s.th, s.tr, { width: 36 }]}>Pts</Text>
      </View>
      {safe.map(function(row, idx) {
        if (!row) return null;
        var rank = typeof row.rank === 'number' ? row.rank : idx + 1;
        var gd = typeof row.goal_diff === 'number' ? row.goal_diff : 0;
        return (
          <View key={String(rank) + '-' + String(idx)} style={[s.tableRow, idx % 2 === 0 && s.tableRowAlt]}>
            <Text style={[s.td, { width: 30, fontWeight: '700' }]}>{rank}</Text>
            <Text style={[s.td, { flex: 1 }]} numberOfLines={1}>{row.team_name || '?'}</Text>
            <Text style={[s.td, s.tc, { width: 30 }]}>{row.played || 0}</Text>
            <Text style={[s.td, s.tc, { width: 30 }]}>{row.win || 0}</Text>
            <Text style={[s.td, s.tc, { width: 30 }]}>{row.draw || 0}</Text>
            <Text style={[s.td, s.tc, { width: 30 }]}>{row.lose || 0}</Text>
            <Text style={[s.td, s.tc, { width: 36 }]}>{gd > 0 ? '+' + gd : String(gd)}</Text>
            <Text style={[s.td, s.tr, { width: 36, fontWeight: '700' }]}>{row.points || 0}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ─── FIXTURES LIST (no Image, no Modal, no FlatList, text only) ─── */
function SimpleFixtures(props: { fixtures: FixtureEntry[]; showScore: boolean }) {
  var safe = Array.isArray(props.fixtures) ? props.fixtures : [];
  if (safe.length === 0) {
    return <Text style={s.emptyText}>Nessun dato disponibile</Text>;
  }

  var groups = groupByRound(safe);

  return (
    <View>
      {groups.map(function(g, gi) {
        return (
          <View key={String(gi)}>
            <Text style={s.sectionTitle}>{formatRoundLabel(g.round)}</Text>
            {g.items.map(function(f, fi) {
              if (!f || typeof f.fixture_id !== 'number') return null;
              var hg = f.home_goals;
              var ag = f.away_goals;
              var homeStr = typeof f.home_team === 'string' ? f.home_team : '?';
              var awayStr = typeof f.away_team === 'string' ? f.away_team : '?';
              var dateStr = safeDate(f.date);
              var timeStr = safeTime(f.date);

              return (
                <View key={String(f.fixture_id) + '-' + String(fi)} style={s.fixtureCard}>
                  <View style={s.fixtureTeams}>
                    <View style={s.fixtureRow}>
                      <Text style={s.fixtureName} numberOfLines={1}>{homeStr}</Text>
                      {props.showScore && hg !== null && hg !== undefined && typeof hg === 'number' ? (
                        <Text style={s.fixtureScore}>{String(hg)}</Text>
                      ) : null}
                    </View>
                    <View style={s.fixtureRow}>
                      <Text style={s.fixtureName} numberOfLines={1}>{awayStr}</Text>
                      {props.showScore && ag !== null && ag !== undefined && typeof ag === 'number' ? (
                        <Text style={s.fixtureScore}>{String(ag)}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={s.fixtureMeta}>
                    <Text style={s.fixtureDate}>{dateStr}</Text>
                    {!props.showScore ? <Text style={s.fixtureTime}>{timeStr}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/* ─── STYLES ─── */
var s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  leagueBar: { backgroundColor: '#F3F4F6', flexShrink: 0, flexGrow: 0, height: 56 },
  leagueBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 10, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  chipActive: { backgroundColor: '#1F4C8F', borderColor: '#1F4C8F' },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  tabBar: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingHorizontal: 16 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  tabLoadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 40 },

  // Standings
  tableCard: {
    backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.accent,
  },
  tableHeaderRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#1F4C8F',
  },
  th: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  tableRowAlt: { backgroundColor: colors.background },
  td: { fontSize: 13, color: colors.textPrimary },
  tc: { textAlign: 'center' },
  tr: { textAlign: 'right' },

  // Fixtures
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: colors.textPrimary,
    paddingVertical: 8, paddingHorizontal: 4, marginTop: 8,
  },
  fixtureCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  fixtureTeams: { flex: 1, gap: 4 },
  fixtureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fixtureName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  fixtureScore: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, minWidth: 20, textAlign: 'right' },
  fixtureMeta: { alignItems: 'flex-end', marginLeft: 12 },
  fixtureDate: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  fixtureTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
