import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  ActivityIndicator, TouchableOpacity, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../src/api/client';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface MatchdayBreakdown {
  matchday_id: string;
  matchday_number: number;
  matchday_label: string;
  status: string;
  base_points: number;
  joker_bonus: number;
  total_points: number;
}

interface UserProfile {
  user_id: string;
  username: string;
  league_id: string;
  league_name: string;
  rank: number;
  total_points: number;
  matchdays_played: number;
  total_base_points: number;
  total_joker_bonus: number;
  current_week_points: number;
  current_matchday: number | null;
  last_matchday_id: string | null;
  jolly_used: number;
  is_current_user: boolean;
  matchday_breakdown: MatchdayBreakdown[];
}

export default function UserDetailScreen() {
  const { colors } = useTheme();
  const { token, handleAuthError } = useAuth();
  const params = useLocalSearchParams<{ userId: string; leagueId?: string }>();
  
  const [data, setData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        let url = `/standings/user/${params.userId}`;
        if (params.leagueId) url += `?league_id=${params.leagueId}`;
        const res = await apiCall(url, { token });
        setData(res);
      } catch (e: unknown) { 
        if (isAuthError(e)) {
          const didLogout = await handleAuthError(e);
          if (didLogout) router.replace('/(auth)/login');
          return;
        }
        setError(e.message || 'Errore nel caricamento');
      }
      finally { setLoading(false); }
    })();
  }, [params.userId, params.leagueId, token, handleAuthError]);

  const viewMatchdayPredictions = (matchdayId: string) => {
    router.push({
      pathname: '/user-predictions',
      params: { 
        userId: params.userId, 
        matchdayId,
        leagueId: params.leagueId || data?.league_id || ''
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      'COMPLETED': { bg: 'rgba(34,197,94,0.15)', text: colors.success },
      'LIVE': { bg: 'rgba(239,68,68,0.15)', text: colors.error },
      'LOCKED': { bg: 'rgba(245,166,35,0.15)', text: colors.accent },
      'OPEN': { bg: 'rgba(59,130,246,0.15)', text: colors.info },
    };
    return statusColors[status] || statusColors['OPEN'];
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Profilo Utente</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[s.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {data.username}
            {data.is_current_user && ' (Tu)'}
          </Text>
          <Text style={[s.headerSub, { color: colors.textSecondary }]}>
            {data.league_name}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Rank Card */}
        <View style={[s.rankCard, { backgroundColor: colors.card }]}>
          <View style={[s.rankBadge, { backgroundColor: data.rank <= 3 ? colors.accent : colors.border }]}>
            <Text style={[s.rankNum, { color: data.rank <= 3 ? colors.background : colors.text }]}>
              #{data.rank}
            </Text>
          </View>
          <View style={s.rankPointsWrap}>
            <Text style={[s.totalPointsLabel, { color: colors.textSecondary }]}>
              Punti Totali
            </Text>
            <Text style={[s.totalPointsValue, { color: colors.accent }]}>
              {data.total_points.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={s.statsGrid}>
          <View style={[s.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar" size={24} color={colors.info} />
            <Text style={[s.statValue, { color: colors.text }]}>{data.matchdays_played}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Giornate</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="trophy" size={24} color={colors.accent} />
            <Text style={[s.statValue, { color: colors.text }]}>{data.total_base_points.toFixed(1)}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Punti Base</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="star" size={24} color="#FFD700" />
            <Text style={[s.statValue, { color: colors.text }]}>+{data.total_joker_bonus.toFixed(1)}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Bonus Jolly</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="flash" size={24} color={colors.success} />
            <Text style={[s.statValue, { color: colors.text }]}>{data.jolly_used}/2</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Jolly Usati</Text>
          </View>
        </View>

        {/* Current Week Highlight */}
        {data.current_week_points > 0 && data.current_matchday && (
          <View style={[s.currentWeekCard, { backgroundColor: colors.card, borderLeftColor: colors.success }]}>
            <View style={s.currentWeekInfo}>
              <Text style={[s.currentWeekLabel, { color: colors.textSecondary }]}>
                Giornata {data.current_matchday}
              </Text>
              <Text style={[s.currentWeekPoints, { color: colors.success }]}>
                +{data.current_week_points.toFixed(1)} pts
              </Text>
            </View>
            {data.last_matchday_id && (
              <TouchableOpacity 
                onPress={() => viewMatchdayPredictions(data.last_matchday_id!)}
                style={[s.viewBtn, { borderColor: colors.accent }]}
              >
                <Text style={[s.viewBtnText, { color: colors.accent }]}>Vedi</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Matchday Breakdown */}
        <View style={s.breakdownSection}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Storico Giornate
          </Text>
          
          {data.matchday_breakdown.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.card }]}>
              <Ionicons name="document-text-outline" size={32} color={colors.textSecondary} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                Nessuna giornata giocata
              </Text>
            </View>
          ) : (
            data.matchday_breakdown.map((md) => {
              const statusStyle = getStatusBadge(md.status);
              return (
                <TouchableOpacity
                  key={md.matchday_id}
                  onPress={() => viewMatchdayPredictions(md.matchday_id)}
                  style={[s.breakdownRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <View style={s.breakdownLeft}>
                    <Text style={[s.breakdownLabel, { color: colors.text }]}>
                      {md.matchday_label}
                    </Text>
                    <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[s.statusText, { color: statusStyle.text }]}>
                        {md.status}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={s.breakdownRight}>
                    <View style={s.breakdownPointsCol}>
                      <Text style={[s.breakdownPointsValue, { color: colors.accent }]}>
                        {md.total_points.toFixed(1)}
                      </Text>
                      {md.joker_bonus > 0 && (
                        <Text style={[s.breakdownJolly, { color: colors.success }]}>
                          (+{md.joker_bonus.toFixed(1)} jolly)
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  
  // Error
  errorText: { fontSize: 15, textAlign: 'center', marginHorizontal: 32 },
  
  // Scroll
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  // Rank Card
  rankCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    padding: 20,
    gap: 20,
    marginBottom: 16,
  },
  rankBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: { fontSize: 24, fontWeight: '900' },
  rankPointsWrap: { flex: 1 },
  totalPointsLabel: { fontSize: 13, fontWeight: '500', textTransform: 'uppercase' },
  totalPointsValue: { fontSize: 36, fontWeight: '900', marginTop: 4 },
  
  // Stats Grid
  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 32 - 10) / 2,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase' },
  
  // Current Week
  currentWeekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    marginBottom: 20,
  },
  currentWeekInfo: { flex: 1 },
  currentWeekLabel: { fontSize: 12, fontWeight: '500' },
  currentWeekPoints: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  viewBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 8, 
    borderWidth: 1 
  },
  viewBtnText: { fontSize: 13, fontWeight: '600' },
  
  // Breakdown Section
  breakdownSection: { marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 14 },
  
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  breakdownLeft: { flex: 1, gap: 6 },
  breakdownLabel: { fontSize: 15, fontWeight: '600' },
  statusBadge: { 
    alignSelf: 'flex-start',
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 4 
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  
  breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownPointsCol: { alignItems: 'flex-end' },
  breakdownPointsValue: { fontSize: 18, fontWeight: '800' },
  breakdownJolly: { fontSize: 11, fontWeight: '500' },
});
