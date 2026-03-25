import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView, Platform,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';
import { MatchDetailSheet } from '../../src/components/MatchDetailSheet';

/* --- TYPES --- */

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

/* --- SAFE HELPERS --- */

function safeStr(v: unknown, fb: string): string {
  if (typeof v === 'string' && v.length > 0) return v;
  return fb;
}

function safeNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  return null;
}

function safeImgUri(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 5 && v.startsWith('http')) return v;
  return null;
}

function safeDate(iso: unknown): string {
  if (typeof iso !== 'string' || iso.length === 0) return '-';
  try {
    var d = new Date(iso);
    var t = d.getTime();
    if (t !== t) return '-';
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
    if (t !== t) return '-';
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
        home_logo: safeImgUri(o.home_logo),
        away_team: at || '?',
        away_logo: safeImgUri(o.away_logo),
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

/* --- MAIN SCREEN --- */

const BUILD_TAG = 'v-EM-0326';

export default function StatisticsScreen() {
  const { token } = useAuth();

  var [leagues, setLeagues] = useState<StatsLeague[]>([]);
  var [selectedLeague, setSelectedLeague] = useState<StatsLeague | null>(null);
  var [activeTab, setActiveTab] = useState<TabView>('standings');
  var [standings, setStandings] = useState<StandingEntry[]>([]);
  var [results, setResults] = useState<FixtureEntry[]>([]);
  var [upcoming, setUpcoming] = useState<FixtureEntry[]>([]);
  var [loading, setLoading] = useState(true);
  var [tabLoading, setTabLoading] = useState(false);
  var [refreshing, setRefreshing] = useState(false);
  var [detailFixtureId, setDetailFixtureId] = useState<number | null>(null);

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

  var onFixturePress = function(fixtureId: number) {
    setDetailFixtureId(fixtureId);
  };

  if (loading) {
    return (
      <View style={st.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      {/* HEADER */}
      <View style={st.header}>
        <Ionicons name="stats-chart" size={22} color={colors.primary} />
        <Text style={st.headerTitle}>Statistiche</Text>
        <Text style={{ fontSize: 9, color: colors.textSecondary, marginLeft: 'auto' }}>{BUILD_TAG}</Text>
      </View>

      {/* LEAGUE CHIPS with logos */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.leagueBar} contentContainerStyle={st.leagueBarContent}>
        {leagues.map(function(lg) {
          var isActive = selectedLeague ? selectedLeague.league_id === lg.league_id : false;
          var logoUri = safeImgUri(lg.logo);
          return (
            <TouchableOpacity
              key={lg.league_id}
              style={[st.chip, isActive && st.chipActive]}
              onPress={function() { setSelectedLeague(lg); }}
            >
              {logoUri ? <Image source={{ uri: logoUri }} style={st.chipLogo} /> : null}
              <Text style={[st.chipText, isActive && st.chipTextActive]}>{lg.name || '?'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* TAB BAR */}
      <View style={st.tabBar}>
        {(['standings', 'results', 'upcoming'] as TabView[]).map(function(tab) {
          var isActive = activeTab === tab;
          var label = tab === 'standings' ? 'Classifica' : tab === 'results' ? 'Risultati' : 'Prossime';
          return (
            <TouchableOpacity
              key={tab}
              style={[st.tabItem, isActive && st.tabItemActive]}
              onPress={function() { setActiveTab(tab); }}
            >
              <Text style={[st.tabText, isActive && st.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={st.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        {tabLoading ? (
          <View style={st.tabLoadingWrap}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : activeTab === 'standings' ? (
          <StandingsTable entries={standings} />
        ) : (
          <FixturesList
            fixtures={activeTab === 'results' ? results : upcoming}
            showScore={activeTab === 'results'}
            onPress={onFixturePress}
          />
        )}
      </ScrollView>

      {/* Match Detail Sheet */}
      <MatchDetailSheet
        fixtureId={detailFixtureId}
        token={token || ''}
        visible={detailFixtureId !== null && detailFixtureId !== undefined}
        onClose={function() { setDetailFixtureId(null); }}
      />
    </SafeAreaView>
  );
}

/* --- STANDINGS TABLE (with logos) --- */
function StandingsTable(props: { entries: StandingEntry[] }) {
  var safe = Array.isArray(props.entries) ? props.entries : [];
  if (safe.length === 0) {
    return <Text style={st.emptyText}>Nessun dato disponibile</Text>;
  }

  return (
    <View style={st.tableCard}>
      <View style={st.tableHeaderRow}>
        <Text style={[st.th, { width: 30 }]}>#</Text>
        <Text style={[st.th, { flex: 1 }]}>Squadra</Text>
        <Text style={[st.th, st.tc, { width: 30 }]}>G</Text>
        <Text style={[st.th, st.tc, { width: 30 }]}>V</Text>
        <Text style={[st.th, st.tc, { width: 30 }]}>P</Text>
        <Text style={[st.th, st.tc, { width: 30 }]}>S</Text>
        <Text style={[st.th, st.tc, { width: 36 }]}>DR</Text>
        <Text style={[st.th, st.tr, { width: 36 }]}>Pts</Text>
      </View>
      {safe.map(function(row, idx) {
        if (!row) return null;
        var rank = typeof row.rank === 'number' ? row.rank : idx + 1;
        var gd = typeof row.goal_diff === 'number' ? row.goal_diff : 0;
        var isTop4 = rank <= 4;
        var isRel = rank >= safe.length - 2;
        var logoUri = safeImgUri(row.team_logo);
        return (
          <View key={String(rank) + '-' + String(idx)} style={[st.tableRow, idx % 2 === 0 && st.tableRowAlt]}>
            <View style={[st.rankBar, isTop4 && st.rankTop, isRel && st.rankBot]} />
            <Text style={[st.td, { width: 26, fontWeight: '700' }]}>{rank}</Text>
            <View style={st.teamCell}>
              {logoUri ? <Image source={{ uri: logoUri }} style={st.teamLogo} /> : null}
              <Text style={st.teamName} numberOfLines={1}>{row.team_name || '?'}</Text>
            </View>
            <Text style={[st.td, st.tc, { width: 30 }]}>{row.played || 0}</Text>
            <Text style={[st.td, st.tc, { width: 30 }]}>{row.win || 0}</Text>
            <Text style={[st.td, st.tc, { width: 30 }]}>{row.draw || 0}</Text>
            <Text style={[st.td, st.tc, { width: 30 }]}>{row.lose || 0}</Text>
            <Text style={[st.td, st.tc, { width: 36 }]}>{gd > 0 ? '+' + gd : String(gd)}</Text>
            <Text style={[st.td, st.tr, { width: 36, fontWeight: '700' }]}>{row.points || 0}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* --- FIXTURES LIST (with logos, clickable) --- */
function FixturesList(props: { fixtures: FixtureEntry[]; showScore: boolean; onPress: (id: number) => void }) {
  var safe = Array.isArray(props.fixtures) ? props.fixtures : [];
  if (safe.length === 0) {
    return <Text style={st.emptyText}>Nessun dato disponibile</Text>;
  }

  var groups = groupByRound(safe);

  return (
    <View>
      {groups.map(function(g, gi) {
        return (
          <View key={String(gi)}>
            <Text style={st.sectionTitle}>{formatRoundLabel(g.round)}</Text>
            {g.items.map(function(f, fi) {
              if (!f || typeof f.fixture_id !== 'number') return null;
              var hg = f.home_goals;
              var ag = f.away_goals;
              var homeStr = typeof f.home_team === 'string' ? f.home_team : '?';
              var awayStr = typeof f.away_team === 'string' ? f.away_team : '?';
              var dateStr = safeDate(f.date);
              var timeStr = safeTime(f.date);

              return (
                <Pressable
                  key={String(f.fixture_id) + '-' + String(fi)}
                  style={function({ pressed }: { pressed: boolean }) { return [st.fixtureCard, pressed && { opacity: 0.7 }]; }}
                  onPress={function() { props.onPress(f.fixture_id); }}
                >
                  <View style={st.fixtureTeams}>
                    <View style={st.fixtureRow}>
                      {f.home_logo ? <Image source={{ uri: f.home_logo }} style={st.fixtureLogo} /> : <View style={st.fixtureLogoEmpty} />}
                      <Text style={st.fixtureName} numberOfLines={1}>{homeStr}</Text>
                      {props.showScore && hg !== null && hg !== undefined && typeof hg === 'number' ? (
                        <Text style={st.fixtureScore}>{String(hg)}</Text>
                      ) : null}
                    </View>
                    <View style={st.fixtureRow}>
                      {f.away_logo ? <Image source={{ uri: f.away_logo }} style={st.fixtureLogo} /> : <View style={st.fixtureLogoEmpty} />}
                      <Text style={st.fixtureName} numberOfLines={1}>{awayStr}</Text>
                      {props.showScore && ag !== null && ag !== undefined && typeof ag === 'number' ? (
                        <Text style={st.fixtureScore}>{String(ag)}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={st.fixtureMeta}>
                    <Text style={st.fixtureDate}>{dateStr}</Text>
                    {!props.showScore ? <Text style={st.fixtureTime}>{timeStr}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/* --- STYLES --- */
var st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },

  // League chips
  leagueBar: { backgroundColor: '#F3F4F6', flexShrink: 0, flexGrow: 0, height: 56 },
  leagueBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 10, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  chipActive: { backgroundColor: '#1F4C8F', borderColor: '#1F4C8F' },
  chipLogo: { width: 20, height: 20, borderRadius: 10 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingHorizontal: 16 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.accent, fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 100 },
  tabLoadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 40 },

  // Standings table
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
  rankBar: { width: 3, height: 24, borderRadius: 2, marginRight: 4, backgroundColor: 'transparent' },
  rankTop: { backgroundColor: colors.accent },
  rankBot: { backgroundColor: colors.error },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamLogo: { width: 20, height: 20, borderRadius: 4 },
  teamName: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, flexShrink: 1 },

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
  fixtureLogo: { width: 18, height: 18, borderRadius: 3 },
  fixtureLogoEmpty: { width: 18, height: 18, borderRadius: 3, backgroundColor: '#E5E7EB' },
  fixtureName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  fixtureScore: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, minWidth: 20, textAlign: 'right' },
  fixtureMeta: { alignItems: 'flex-end', marginLeft: 12 },
  fixtureDate: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  fixtureTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
