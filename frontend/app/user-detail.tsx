import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  ActivityIndicator, TouchableOpacity, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall, isAuthError } from '../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '../src/theme/designSystem';
import { AnimatedSweep } from '../src/components/ui';

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
  total_correct_predictions: number;
  exact_score_hits: number;
  one_x_two_hits: number;
  current_week_points: number;
  current_matchday: number | null;
  last_matchday_id: string | null;
  is_current_user: boolean;
  matchday_breakdown: MatchdayBreakdown[];
}

export default function UserDetailScreen() {
  const { t } = useTranslation();
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
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="back-btn">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profilo Utente</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} data-testid="user-detail-name">
            {data.username}
            {data.is_current_user && ' (Tu)'}
          </Text>
          <Text style={s.headerSub}>{data.league_name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Rank Card — Dark Navy */}
        <View style={s.rankOuter}>
          <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.rankCard}>
            <AnimatedSweep />
            <View style={[s.rankBadge, { backgroundColor: data.rank <= 3 ? colors.accent : 'rgba(255,255,255,0.1)' }]}>
              <Text style={s.rankNum}>#{data.rank}</Text>
            </View>
            <View style={s.rankPointsWrap}>
              <Text style={s.totalPointsLabel}>Punti Totali</Text>
              <Text style={s.totalPointsValue}>{Math.round(data.total_points)}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Grid — Dark Navy */}
        <View style={s.statsGrid}>
          <View style={s.statOuter}>
            <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.statCard}>
              <Ionicons name="calendar" size={24} color={colors.info} />
              <Text style={s.statValue}>{data.matchdays_played}</Text>
              <Text style={s.statLabel}>Giornate</Text>
            </LinearGradient>
          </View>
          <View style={s.statOuter}>
            <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.statCard}>
              <Ionicons name="trophy" size={24} color={colors.accent} />
              <Text style={s.statValue}>{Math.round(data.total_base_points)}</Text>
              <Text style={s.statLabel}>Punti Base</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Tiebreak Stats Section */}
        <View style={s.tiebreakSection}>
          <Text style={s.tiebreakTitle}>Statistiche Spareggio</Text>
          <View style={s.tiebreakGrid}>
            <View style={s.tiebreakItem}>
              <Text style={s.tiebreakValue} data-testid="stat-indovinati">{data.total_correct_predictions ?? 0}</Text>
              <Text style={s.tiebreakLabel}>Indovinati</Text>
            </View>
            <View style={[s.tiebreakItem, s.tiebreakItemBorder]}>
              <Text style={s.tiebreakValue} data-testid="stat-esatti">{data.exact_score_hits ?? 0}</Text>
              <Text style={s.tiebreakLabel}>Risultati esatti</Text>
            </View>
            <View style={s.tiebreakItem}>
              <Text style={s.tiebreakValue} data-testid="stat-1x2">{data.one_x_two_hits ?? 0}</Text>
              <Text style={s.tiebreakLabel}>1X2 indovinati</Text>
            </View>
          </View>
          <Text style={s.tiebreakNote}>Ordine spareggio: Punti {'>'} Indovinati {'>'} Esatti {'>'} 1X2</Text>
        </View>

        {/* Current Week Highlight */}
        {data.current_week_points > 0 && data.current_matchday && (
          <View style={s.currentWeekCard}>
            <View style={s.currentWeekInfo}>
              <Text style={s.currentWeekLabel}>Giornata {data.current_matchday}</Text>
              <Text style={s.currentWeekPoints}>+{Math.round(data.current_week_points)} pts</Text>
            </View>
            {data.last_matchday_id && (
              <TouchableOpacity 
                onPress={() => viewMatchdayPredictions(data.last_matchday_id!)}
                style={s.viewBtn}
                data-testid="view-current-week-btn"
              >
                <Text style={s.viewBtnText}>Vedi</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Matchday Breakdown */}
        <View style={s.breakdownSection}>
          <Text style={s.sectionTitle}>Storico Giornate</Text>
          
          {data.matchday_breakdown.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={s.emptyText}>Nessuna giornata giocata</Text>
            </View>
          ) : (
            data.matchday_breakdown.map((md) => {
              const statusStyle = getStatusBadge(md.status);
              return (
                <TouchableOpacity
                  key={md.matchday_id}
                  onPress={() => viewMatchdayPredictions(md.matchday_id)}
                  style={s.breakdownRow}
                  activeOpacity={0.7}
                  data-testid={`breakdown-${md.matchday_id}`}
                >
                  <View style={s.breakdownLeft}>
                    <Text style={s.breakdownLabel}>{md.matchday_label}</Text>
                    <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[s.statusText, { color: statusStyle.text }]}>{md.status}</Text>
                    </View>
                  </View>
                  <View style={s.breakdownRight}>
                    <Text style={s.breakdownPointsValue}>{Math.round(md.total_points)}</Text>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
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
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { ...typography.titleL, color: colors.textPrimary },
  headerSub: { ...typography.meta, color: colors.textSecondary, marginTop: 2 },
  errorText: { ...typography.bodyM, color: colors.error, textAlign: 'center', marginHorizontal: 32 },
  
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  
  // Rank Card — Dark Navy
  rankOuter: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: spacing.lg,
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  rankCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: borderRadius.xl, 
    padding: spacing.xl,
    gap: 20,
    overflow: 'hidden',
  },
  rankBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  rankPointsWrap: { flex: 1 },
  totalPointsLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  totalPointsValue: { fontSize: 36, fontWeight: '900', color: colors.accent, marginTop: 4 },
  
  // Stats Grid — Dark Navy
  statsGrid: { 
    flexDirection: 'row', 
    gap: 10,
    marginBottom: spacing.lg,
  },

  // Tiebreak Stats
  tiebreakSection: {
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  tiebreakTitle: {
    ...typography.meta,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  tiebreakGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tiebreakItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tiebreakItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tiebreakValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
  },
  tiebreakLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
    textAlign: 'center',
  },
  tiebreakNote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  statOuter: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  statCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  
  // Current Week
  currentWeekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginBottom: spacing.xl,
  },
  currentWeekInfo: { flex: 1 },
  currentWeekLabel: { ...typography.meta, color: 'rgba(255,255,255,0.5)' },
  currentWeekPoints: { fontSize: 18, fontWeight: '800', color: colors.success, marginTop: 2 },
  viewBtn: { 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.sm, 
    borderWidth: 1, borderColor: colors.accent,
  },
  viewBtnText: { ...typography.bodyM, color: colors.accent, fontWeight: '600' },
  
  // Breakdown Section
  breakdownSection: { marginTop: 4 },
  sectionTitle: { ...typography.titleM, color: colors.textPrimary, marginBottom: spacing.md },
  
  emptyCard: {
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyText: { ...typography.bodyM, color: 'rgba(255,255,255,0.4)' },
  
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  breakdownLeft: { flex: 1, gap: 6 },
  breakdownLabel: { ...typography.bodyM, color: '#FFFFFF', fontWeight: '600' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  
  breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownPointsValue: { fontSize: 18, fontWeight: '800', color: colors.accent },
});
