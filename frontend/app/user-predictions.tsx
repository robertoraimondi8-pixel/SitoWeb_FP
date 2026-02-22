import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  ActivityIndicator, TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { UserPredictionsData, getErrorMessage } from '../src/types/api';
import { apiCall, isAuthError } from '../src/api/client';
import { Ionicons } from '@expo/vector-icons';

interface Prediction {
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  market_type: string | null;
  prediction_value: string | null;
  outcome: 'correct' | 'wrong' | 'pending' | 'no_prediction';
  points: number;
  is_special?: boolean;
  multiplier?: number;
}

export default function UserPredictionsScreen() {
  const { colors } = useTheme();
  const { token, handleAuthError } = useAuth();
  const params = useLocalSearchParams<{ userId: string; matchdayId: string; leagueId?: string }>();
  
  const [data, setData] = useState<UserPredictionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        let url = `/predictions/user/${params.userId}/${params.matchdayId}`;
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
  }, [params.userId, params.matchdayId, params.leagueId, token, handleAuthError]);

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'correct': return colors.success;
      case 'wrong': return colors.error;
      case 'pending': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const getOutcomeIcon = (outcome: string): string => {
    switch (outcome) {
      case 'correct': return 'checkmark-circle';
      case 'wrong': return 'close-circle';
      case 'pending': return 'time';
      default: return 'remove-circle-outline';
    }
  };

  const formatMarket = (market: string | null) => {
    if (!market) return '-';
    switch (market) {
      case '1X2': return '1X2';
      case 'GOAL_NOGOL': return 'GNG';
      case 'OVER_UNDER_25': return 'O/U';
      case 'EXACT_SCORE': return 'Esatto';
      default: return market;
    }
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

  if (error) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Pronostici</Text>
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
          <Text style={[s.headerTitle, { color: colors.text }]}>{data?.username}</Text>
          <Text style={[s.headerSub, { color: colors.textSecondary }]}>
            {data?.matchday_label}
          </Text>
        </View>
      </View>

      {/* Summary */}
      <View style={[s.summaryCard, { backgroundColor: colors.card }]}>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Punti Base</Text>
            <Text style={[s.summaryValue, { color: colors.text }]}>
              {(data?.base_points || 0).toFixed(1)}
            </Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>Totale</Text>
            <Text style={[s.summaryValueBig, { color: colors.accent }]}>
              {(data?.total_points || 0).toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Predictions List */}
      <ScrollView contentContainerStyle={s.scrollContent}>
        {data?.predictions?.length === 0 || data?.predictions?.every((p: Prediction) => !p.prediction_value) ? (
          <View style={s.noPredictions} data-testid="no-predictions-message">
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
            <Text style={[s.noPredTitle, { color: colors.text }]}>Nessun pronostico</Text>
            <Text style={[s.noPredSub, { color: colors.textSecondary }]}>
              {data?.username} non ha inserito pronostici per questa giornata
            </Text>
          </View>
        ) : (
        data?.predictions?.map((pred: Prediction, idx: number) => (
          <View 
            key={pred.match_id} 
            style={[
              s.predCard, 
              { backgroundColor: colors.card, borderColor: colors.border },
              pred.is_special && { borderColor: colors.accent, borderWidth: 2 }
            ]}
          >
            {/* Match Info */}
            <View style={s.matchHeader}>
              <Text style={[s.matchNum, { color: pred.is_special ? colors.accent : colors.textSecondary }]}>{idx + 1}</Text>
              <Text style={[s.competition, { color: colors.textSecondary }]}>
                {pred.competition}
              </Text>
              {pred.is_special && (
                <View style={{ backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>X3</Text>
                </View>
              )}
              {pred.match_status === 'live' && (
                <View style={[s.liveBadge, { backgroundColor: colors.error }]}>
                  <Text style={s.liveText}>LIVE</Text>
                </View>
              )}
            </View>

            {/* Teams & Score */}
            <View style={s.teamsRow}>
              <View style={s.teamCol}>
                <Text style={[s.teamName, { color: colors.text }]}>{pred.home_team}</Text>
              </View>
              <View style={s.scoreCol}>
                {pred.home_score !== null ? (
                  <Text style={[s.score, { color: colors.text }]}>
                    {pred.home_score} - {pred.away_score}
                  </Text>
                ) : (
                  <Text style={[s.vs, { color: colors.textSecondary }]}>vs</Text>
                )}
              </View>
              <View style={s.teamCol}>
                <Text style={[s.teamName, { color: colors.text }, { textAlign: 'right' }]}>
                  {pred.away_team}
                </Text>
              </View>
            </View>

            {/* Prediction */}
            <View style={[s.predRow, { borderTopColor: colors.border }]}>
              <View style={s.predInfo}>
                <Text style={[s.predLabel, { color: colors.textSecondary }]}>Pronostico:</Text>
                {pred.prediction_value ? (
                  <View style={s.predValueRow}>
                    <View style={[s.marketBadge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                      <Text style={[s.marketText, { color: colors.info }]}>
                        {formatMarket(pred.market_type)}
                      </Text>
                    </View>
                    <Text style={[s.predValue, { color: colors.text }]}>
                      {pred.prediction_value}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.noPred, { color: colors.textSecondary }]}>
                    Non inserito
                  </Text>
                )}
              </View>

              {/* Outcome */}
              <View style={s.outcomeCol}>
                <Ionicons 
                  name={getOutcomeIcon(pred.outcome)} 
                  size={24} 
                  color={getOutcomeColor(pred.outcome)} 
                />
                {pred.outcome !== 'no_prediction' && pred.outcome !== 'pending' && (
                  <Text style={[s.pointsText, { color: getOutcomeColor(pred.outcome) }]}>
                    {pred.outcome === 'correct' ? `+${pred.points.toFixed(1)}` : '0'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ))}
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
  
  // Jolly banner
  jollyBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    marginHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 10 
  },
  jollyBannerText: { fontSize: 14, fontWeight: '700' },
  
  // Summary
  summaryCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase' },
  summaryValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  summaryValueBig: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  
  // List
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  // Prediction card
  predCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  matchNum: { fontSize: 11, fontWeight: '700', width: 20, textAlign: 'center' },
  competition: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  
  // Teams
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  teamCol: { flex: 1 },
  teamName: { fontSize: 14, fontWeight: '600' },
  scoreCol: { paddingHorizontal: 12 },
  score: { fontSize: 18, fontWeight: '800' },
  vs: { fontSize: 12 },
  
  // Prediction row
  predRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingTop: 10, 
    borderTopWidth: 1 
  },
  predInfo: { flex: 1 },
  predLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  predValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  marketText: { fontSize: 11, fontWeight: '700' },
  predValue: { fontSize: 16, fontWeight: '700' },
  noPred: { fontSize: 13, fontStyle: 'italic' },
  
  // Outcome
  outcomeCol: { alignItems: 'center', gap: 2 },
  pointsText: { fontSize: 12, fontWeight: '700' },
});
