import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  ActivityIndicator, Modal, FlatList 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface StandingEntry {
  user_id: string;
  username: string;
  rank: number;
  total_points?: number;
  matchday_points?: number;
  current_week_points?: number;
  matchdays_played?: number;
  jolly_used?: number;
  exact_correct?: number;
  '1x2_correct'?: number;
  jolly_active?: boolean;
  is_current_user: boolean;
}

export default function RankingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token, handleAuthError } = useAuth();
  const [tab, setTab] = useState<'total' | 'weekly'>('total');
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [standings, setStandings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Weekly specific
  const [matchdays, setMatchdays] = useState<any[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<any>(null);
  const [showMatchdayPicker, setShowMatchdayPicker] = useState(false);

  // Load leagues and matchdays on mount
  useEffect(() => {
    (async () => {
      try {
        const [ls, mds] = await Promise.all([
          apiCall('/leagues', { token }),
          apiCall('/standings/matchdays', { token }),
        ]);
        setLeagues(ls);
        setMatchdays(mds);
        if (ls.length > 0) setSelectedLeague(ls[0].id);
        if (mds.length > 0) setSelectedMatchday(mds[0]);
      } catch (e: any) { 
        if (isAuthError(e)) {
          await handleAuthError(e);
          router.replace('/(auth)/login');
          return;
        }
        console.error(e); 
      }
    })();
  }, [token, handleAuthError]);

  // Fetch standings when tab/league/matchday changes
  const fetchStandings = useCallback(async () => {
    if (!selectedLeague) { setLoading(false); return; }
    setLoading(true);
    try {
      let url: string;
      if (tab === 'total') {
        url = `/standings/total?league_id=${selectedLeague}`;
      } else {
        if (!selectedMatchday) { setLoading(false); return; }
        url = `/standings/weekly/${selectedMatchday.id}?league_id=${selectedLeague}`;
      }
      const res = await apiCall(url, { token });
      setStandings(res);
    } catch (e: any) { 
      if (isAuthError(e)) {
        await handleAuthError(e);
        router.replace('/(auth)/login');
        return;
      }
      console.error(e); 
    }
    finally { setLoading(false); }
  }, [token, tab, selectedLeague, selectedMatchday, handleAuthError]);

  useEffect(() => { fetchStandings(); }, [fetchStandings]);

  // Navigate to user predictions transparency (weekly)
  const viewUserPredictions = (userId: string) => {
    if (!selectedMatchday) return;
    router.push({
      pathname: '/user-predictions',
      params: { 
        userId, 
        matchdayId: selectedMatchday.id,
        leagueId: selectedLeague 
      }
    });
  };

  // Navigate to user profile (total standings)
  const viewUserProfile = (userId: string) => {
    router.push({
      pathname: '/user-detail',
      params: { 
        userId, 
        leagueId: selectedLeague 
      }
    });
  };

  const renderTotalEntry = (entry: StandingEntry, index: number) => {
    const isTop3 = index < 3;
    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    
    return (
      <TouchableOpacity
        key={entry.user_id}
        testID={`rank-${index}`}
        onPress={() => selectedMatchday && viewUserPredictions(entry.user_id)}
        style={[
          isTop3 ? s.topRow : s.row,
          { 
            backgroundColor: isTop3 ? colors.card : 'transparent',
            borderColor: entry.is_current_user ? colors.accent : colors.border,
            borderWidth: entry.is_current_user ? 2 : isTop3 ? 1 : 0,
            borderBottomWidth: isTop3 ? (entry.is_current_user ? 2 : 1) : 1,
            borderBottomColor: isTop3 ? (entry.is_current_user ? colors.accent : colors.border) : colors.border,
          }
        ]}
      >
        {isTop3 ? (
          <View style={[s.rankCircle, { backgroundColor: medalColors[index] }]}>
            <Text style={s.rankCircleText}>{entry.rank}</Text>
          </View>
        ) : (
          <Text style={[s.rowRank, { color: colors.textSecondary }]}>{entry.rank}</Text>
        )}
        
        <View style={isTop3 ? s.rankInfo : s.rowInfo}>
          <Text style={[isTop3 ? s.rankUsername : s.rowName, { color: colors.text }]}>
            {entry.username}
            {entry.is_current_user && ' (Tu)'}
          </Text>
          {isTop3 && (
            <Text style={[s.rankMeta, { color: colors.textSecondary }]}>
              {entry.matchdays_played || 0} giornate • {entry.jolly_used || 0} jolly
            </Text>
          )}
        </View>
        
        <View style={s.pointsCol}>
          <Text style={[isTop3 ? s.rankPoints : s.rowPts, { color: colors.accent }]}>
            {(entry.total_points || 0).toFixed(1)}
          </Text>
          {entry.current_week_points !== undefined && entry.current_week_points > 0 && (
            <Text style={[s.weekPoints, { color: colors.success }]}>
              +{entry.current_week_points.toFixed(1)}
            </Text>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderWeeklyEntry = (entry: StandingEntry, index: number) => {
    const isTop3 = index < 3;
    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    
    return (
      <TouchableOpacity
        key={entry.user_id}
        testID={`rank-weekly-${index}`}
        onPress={() => viewUserPredictions(entry.user_id)}
        style={[
          isTop3 ? s.topRow : s.row,
          { 
            backgroundColor: isTop3 ? colors.card : 'transparent',
            borderColor: entry.is_current_user ? colors.accent : colors.border,
            borderWidth: entry.is_current_user ? 2 : isTop3 ? 1 : 0,
            borderBottomWidth: isTop3 ? (entry.is_current_user ? 2 : 1) : 1,
            borderBottomColor: isTop3 ? (entry.is_current_user ? colors.accent : colors.border) : colors.border,
          }
        ]}
      >
        {isTop3 ? (
          <View style={[s.rankCircle, { backgroundColor: medalColors[index] }]}>
            <Text style={s.rankCircleText}>{entry.rank}</Text>
          </View>
        ) : (
          <Text style={[s.rowRank, { color: colors.textSecondary }]}>{entry.rank}</Text>
        )}
        
        <View style={isTop3 ? s.rankInfo : s.rowInfo}>
          <Text style={[isTop3 ? s.rankUsername : s.rowName, { color: colors.text }]}>
            {entry.username}
            {entry.is_current_user && ' (Tu)'}
          </Text>
          {isTop3 && (
            <Text style={[s.rankMeta, { color: colors.textSecondary }]}>
              {entry.exact_correct || 0} esatti • {entry['1x2_correct'] || 0} 1X2
              {entry.jolly_active && ' • JOLLY'}
            </Text>
          )}
        </View>
        
        <View style={s.pointsCol}>
          <Text style={[isTop3 ? s.rankPoints : s.rowPts, { color: colors.accent }]}>
            {(entry.matchday_points || 0).toFixed(1)}
          </Text>
          {entry.jolly_active && (
            <View style={[s.jollyBadge, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
              <Ionicons name="star" size={10} color={colors.accent} />
              <Text style={[s.jollyText, { color: colors.accent }]}>x2</Text>
            </View>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Classifiche</Text>
      </View>

      {/* League Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={s.leagueScroll} 
        contentContainerStyle={s.leagueContent}
      >
        {leagues.map(l => (
          <TouchableOpacity 
            key={l.id} 
            testID={`league-filter-${l.id}`} 
            onPress={() => setSelectedLeague(l.id)} 
            style={[
              s.leagueChip, 
              { 
                backgroundColor: selectedLeague === l.id ? colors.accent : colors.card, 
                borderColor: colors.border 
              }
            ]}
          >
            <Text style={[
              s.leagueChipText, 
              { color: selectedLeague === l.id ? colors.background : colors.text }
            ]}>
              {l.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Toggle */}
      <View style={[s.tabRow, { backgroundColor: colors.card }]}>
        <TouchableOpacity 
          testID="tab-total"
          onPress={() => setTab('total')} 
          style={[s.tabBtn, tab === 'total' && { backgroundColor: colors.accent }]}
        >
          <Text style={[s.tabText, { color: tab === 'total' ? colors.background : colors.textSecondary }]}>
            Totale
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          testID="tab-weekly"
          onPress={() => setTab('weekly')} 
          style={[s.tabBtn, tab === 'weekly' && { backgroundColor: colors.accent }]}
        >
          <Text style={[s.tabText, { color: tab === 'weekly' ? colors.background : colors.textSecondary }]}>
            Settimanale
          </Text>
        </TouchableOpacity>
      </View>

      {/* Matchday Selector (only for weekly tab) */}
      {tab === 'weekly' && (
        <TouchableOpacity 
          testID="matchday-selector"
          onPress={() => setShowMatchdayPicker(true)}
          style={[s.matchdaySelector, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="calendar" size={18} color={colors.accent} />
          <Text style={[s.matchdaySelectorText, { color: colors.text }]}>
            {selectedMatchday ? `Giornata ${selectedMatchday.number}` : 'Seleziona giornata'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Standings List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scrollContent}>
          {standings?.entries?.map((entry: StandingEntry, i: number) => 
            tab === 'total' ? renderTotalEntry(entry, i) : renderWeeklyEntry(entry, i)
          )}

          {/* My Position (if not in visible list) */}
          {standings?.my_position && !standings.entries?.find((e: StandingEntry) => e.is_current_user) && (
            <View style={[s.myPos, { backgroundColor: colors.card, borderColor: colors.accent }]}>
              <Ionicons name="person" size={16} color={colors.accent} />
              <Text style={[s.myPosText, { color: colors.text }]}>
                La tua posizione: #{standings.my_position.rank}
              </Text>
              <Text style={[s.myPosPts, { color: colors.accent }]}>
                {(standings.my_position.total_points || standings.my_position.matchday_points || 0).toFixed(1)} pts
              </Text>
            </View>
          )}

          {(!standings?.entries || standings.entries.length === 0) && (
            <View style={s.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={colors.textSecondary} />
              <Text style={[s.noData, { color: colors.textSecondary }]}>
                Nessun dato disponibile
              </Text>
              <Text style={[s.noDataSub, { color: colors.textSecondary }]}>
                La classifica sarà disponibile dopo la prima giornata
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
          style={s.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMatchdayPicker(false)}
        >
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Seleziona Giornata</Text>
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
                    s.matchdayItem,
                    { borderBottomColor: colors.border },
                    selectedMatchday?.id === item.id && { backgroundColor: 'rgba(245,166,35,0.1)' }
                  ]}
                  onPress={() => {
                    setSelectedMatchday(item);
                    setShowMatchdayPicker(false);
                  }}
                >
                  <Text style={[s.matchdayItemText, { color: colors.text }]}>
                    Giornata {item.number}
                  </Text>
                  <View style={[s.statusBadge, { 
                    backgroundColor: item.status === 'COMPLETED' ? colors.success : 
                                    item.status === 'LIVE' ? colors.error : colors.info 
                  }]}>
                    <Text style={s.statusText}>{item.status}</Text>
                  </View>
                  {selectedMatchday?.id === item.id && (
                    <Ionicons name="checkmark" size={20} color={colors.accent} />
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

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  
  // League selector
  leagueScroll: { maxHeight: 44 },
  leagueContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  leagueChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  leagueChipText: { fontSize: 13, fontWeight: '600' },
  
  // Tab toggle
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  
  // Matchday selector
  matchdaySelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16, 
    marginTop: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 10, 
    borderWidth: 1,
    gap: 8,
  },
  matchdaySelectorText: { flex: 1, fontSize: 14, fontWeight: '500' },
  
  // List
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  // Top 3 rows
  topRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 14, 
    marginBottom: 8, 
    gap: 12 
  },
  rankCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankCircleText: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  rankInfo: { flex: 1 },
  rankUsername: { fontSize: 15, fontWeight: '600' },
  rankMeta: { fontSize: 11, marginTop: 2 },
  rankPoints: { fontSize: 18, fontWeight: '800' },
  
  // Regular rows
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 4,
    gap: 8,
  },
  rowRank: { width: 32, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '500' },
  rowPts: { fontSize: 14, fontWeight: '700' },
  
  // Points column
  pointsCol: { alignItems: 'flex-end', marginRight: 4 },
  weekPoints: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  
  // Jolly badge
  jollyBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  jollyText: { fontSize: 10, fontWeight: '700' },
  
  // My position
  myPos: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    padding: 12, 
    borderRadius: 10, 
    borderWidth: 2, 
    marginTop: 16 
  },
  myPosText: { flex: 1, fontSize: 14, fontWeight: '600' },
  myPosPts: { fontSize: 14, fontWeight: '700' },
  
  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60 },
  noData: { textAlign: 'center', marginTop: 16, fontSize: 16, fontWeight: '600' },
  noDataSub: { textAlign: 'center', marginTop: 8, fontSize: 13 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  matchdayItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  matchdayItemText: { flex: 1, fontSize: 15, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
