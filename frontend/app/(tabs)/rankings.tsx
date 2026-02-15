import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function RankingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [tab, setTab] = useState<'weekly' | 'total'>('total');
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [standings, setStandings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [matchdayId, setMatchdayId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ls = await apiCall('/leagues', { token });
        setLeagues(ls);
        if (ls.length > 0) setSelectedLeague(ls[0].id);
        const home = await apiCall('/home', { token });
        if (home.matchday) setMatchdayId(home.matchday.id);
      } catch (e) { console.error(e); }
    })();
  }, [token]);

  const fetchStandings = useCallback(async () => {
    if (!selectedLeague) { setLoading(false); return; }
    setLoading(true);
    try {
      const url = tab === 'total' ? `/standings/total?league=${selectedLeague}` : `/standings/weekly/${matchdayId}?league=${selectedLeague}`;
      const res = await apiCall(url, { token });
      setStandings(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token, tab, selectedLeague, matchdayId]);

  useEffect(() => { fetchStandings(); }, [fetchStandings]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('rankings')}</Text>
      </View>

      {/* League Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.leagueScroll} contentContainerStyle={s.leagueContent}>
        {leagues.map(l => (
          <TouchableOpacity key={l.id} testID={`league-filter-${l.id}`} onPress={() => setSelectedLeague(l.id)} style={[s.leagueChip, { backgroundColor: selectedLeague === l.id ? colors.accent : colors.card, borderColor: colors.border }]}>
            <Text style={[s.leagueChipText, { color: selectedLeague === l.id ? colors.background : colors.text }]}>{l.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Toggle */}
      <View style={[s.tabRow, { backgroundColor: colors.card }]}>
        {(['total', 'weekly'] as const).map(t2 => (
          <TouchableOpacity key={t2} testID={`tab-${t2}`} onPress={() => setTab(t2)} style={[s.tabBtn, tab === t2 && { backgroundColor: colors.accent }]}>
            <Text style={[s.tabText, { color: tab === t2 ? colors.background : colors.textSecondary }]}>{t(t2)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scrollContent}>
          {/* Top 3 */}
          {standings?.entries?.slice(0, 3).map((entry: any, i: number) => (
            <View key={entry.user_id} testID={`rank-${i}`} style={[s.topRow, { backgroundColor: colors.card, borderColor: entry.is_current_user ? colors.accent : colors.border, borderWidth: entry.is_current_user ? 2 : 1 }]}>
              <View style={[s.rankCircle, { backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32' }]}>
                <Text style={s.rankCircleText}>{entry.rank}</Text>
              </View>
              <View style={s.rankInfo}>
                <Text style={[s.rankUsername, { color: colors.text }]}>{entry.username}</Text>
                <Text style={[s.rankMeta, { color: colors.textSecondary }]}>{entry.matchdays_played} {t('matchday').toLowerCase()}</Text>
              </View>
              <Text style={[s.rankPoints, { color: colors.accent }]}>{entry.total_points.toFixed(1)}</Text>
            </View>
          ))}

          {/* Rest */}
          {standings?.entries?.slice(3).map((entry: any, i: number) => (
            <View key={entry.user_id} testID={`rank-${i + 3}`} style={[s.row, { borderBottomColor: colors.border }, entry.is_current_user && { backgroundColor: 'rgba(245,166,35,0.08)' }]}>
              <Text style={[s.rowRank, { color: colors.textSecondary }]}>{entry.rank}</Text>
              <Text style={[s.rowName, { color: colors.text }]}>{entry.username}</Text>
              <Text style={[s.rowPts, { color: colors.accent }]}>{entry.total_points.toFixed(1)}</Text>
            </View>
          ))}

          {/* My Position */}
          {standings?.my_position && !standings.entries?.find((e: any) => e.is_current_user) && (
            <View style={[s.myPos, { backgroundColor: colors.card, borderColor: colors.accent }]}>
              <Ionicons name="person" size={16} color={colors.accent} />
              <Text style={[s.myPosText, { color: colors.text }]}>{t('my_position')}: #{standings.my_position.rank}</Text>
              <Text style={[s.myPosPts, { color: colors.accent }]}>{standings.my_position.total_points.toFixed(1)} pts</Text>
            </View>
          )}

          {(!standings?.entries || standings.entries.length === 0) && (
            <Text style={[s.noData, { color: colors.textSecondary }]}>{t('no_data')}</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  leagueScroll: { maxHeight: 44 },
  leagueContent: { paddingHorizontal: 16, gap: 8 },
  leagueChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  leagueChipText: { fontSize: 13, fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  scrollContent: { padding: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8, gap: 12 },
  rankCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankCircleText: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  rankInfo: { flex: 1 },
  rankUsername: { fontSize: 15, fontWeight: '600' },
  rankMeta: { fontSize: 11 },
  rankPoints: { fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, paddingHorizontal: 4 },
  rowRank: { width: 32, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  rowName: { flex: 1, fontSize: 14, fontWeight: '500' },
  rowPts: { fontSize: 14, fontWeight: '700' },
  myPos: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 16 },
  myPosText: { flex: 1, fontSize: 14, fontWeight: '600' },
  myPosPts: { fontSize: 14, fontWeight: '700' },
  noData: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
