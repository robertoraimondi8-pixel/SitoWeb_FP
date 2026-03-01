import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  ActivityIndicator, TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/contexts/AuthContext';
import { UserPredictionsData, getErrorMessage } from '../src/types/api';
import { apiCall, isAuthError } from '../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../src/theme/designSystem';
import { AnimatedSweep } from '../src/components/ui';

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
      default: return 'rgba(255,255,255,0.4)';
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
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="back-btn">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pronostici</Text>
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
          <Text style={s.headerTitle} data-testid="username-header">{data?.username}</Text>
          <Text style={s.headerSub}>{data?.matchday_label}</Text>
        </View>
      </View>

      {/* Summary Card — Dark Navy */}
      <View style={s.summaryOuter}>
        <LinearGradient colors={['#1A2F4D', '#0E1A2B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.summaryCard}>
          <AnimatedSweep />
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Punti Base</Text>
              <Text style={s.summaryValue}>{(data?.base_points || 0).toFixed(1)}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Totale</Text>
              <Text style={s.summaryValueBig}>{(data?.total_points || 0).toFixed(1)}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Predictions List */}
      <ScrollView contentContainerStyle={s.scrollContent}>
        {data?.predictions?.length === 0 || data?.predictions?.every((p: Prediction) => !p.prediction_value) ? (
          <View style={s.noPredictions} data-testid="no-predictions-message">
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={s.noPredTitle}>Nessun pronostico</Text>
            <Text style={s.noPredSub}>
              {data?.username} non ha inserito pronostici per questa giornata
            </Text>
          </View>
        ) : (
        data?.predictions?.map((pred: Prediction, idx: number) => (
          <View 
            key={pred.match_id} 
            style={[s.predCard, pred.is_special && s.predCardSpecial]}
            data-testid={`prediction-card-${idx}`}
          >
            <AnimatedSweep />
            {/* Match Info */}
            <View style={s.matchHeader}>
              <View style={[s.matchNumBadge, pred.is_special && { backgroundColor: colors.accent }]}>
                <Text style={s.matchNum}>{idx + 1}</Text>
              </View>
              <Text style={s.competition}>{pred.competition}</Text>
              {pred.is_special && (
                <View style={s.specialBadge}>
                  <Text style={s.specialText}>X3</Text>
                </View>
              )}
              {pred.match_status === 'live' && (
                <View style={s.liveBadge} data-testid={`live-badge-${idx}`}>
                  <Text style={s.liveText}>LIVE</Text>
                </View>
              )}
            </View>

            {/* Teams & Score — FIXED OVERLAP */}
            <View style={s.teamsRow}>
              <View style={s.teamCol}>
                <Text style={s.teamName} numberOfLines={1} ellipsizeMode="tail">{pred.home_team}</Text>
              </View>
              <View style={s.scoreCol}>
                {pred.home_score !== null ? (
                  <Text style={s.score}>{pred.home_score} - {pred.away_score}</Text>
                ) : (
                  <Text style={s.vs}>vs</Text>
                )}
              </View>
              <View style={[s.teamCol, { alignItems: 'flex-end' }]}>
                <Text style={[s.teamName, { textAlign: 'right' }]} numberOfLines={1} ellipsizeMode="tail">
                  {pred.away_team}
                </Text>
              </View>
            </View>

            {/* Prediction */}
            <View style={s.predRow}>
              <View style={s.predInfo}>
                <Text style={s.predLabel}>Pronostico:</Text>
                {pred.prediction_value ? (
                  <View style={s.predValueRow}>
                    <View style={s.marketBadge}>
                      <Text style={s.marketText}>{formatMarket(pred.market_type)}</Text>
                    </View>
                    <Text style={s.predValue}>{pred.prediction_value}</Text>
                  </View>
                ) : (
                  <Text style={s.noPred}>Non inserito</Text>
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
        ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  
  // Header — gray
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md, 
    gap: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { ...typography.titleL, color: colors.textPrimary },
  headerSub: { ...typography.meta, color: colors.textSecondary, marginTop: 2 },
  errorText: { ...typography.bodyM, color: colors.error, textAlign: 'center', marginHorizontal: 32 },
  
  // Summary Card — Dark Navy
  summaryOuter: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#0E1A2B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  summaryCard: { 
    padding: spacing.xl, 
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
  summaryLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  summaryValue: { ...typography.statMedium, color: '#FFFFFF', marginTop: 4 },
  summaryValueBig: { fontSize: 28, fontWeight: '800', color: colors.accent, marginTop: 4 },
  
  // List
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  
  // Prediction card — Dark Navy
  predCard: { 
    backgroundColor: '#14263D',
    borderRadius: borderRadius.xl, 
    padding: spacing.lg, 
    marginBottom: spacing.md, 
    borderWidth: 1.5, 
    borderColor: colors.accent,
    overflow: 'hidden',
    shadowColor: '#0E1A2B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  predCardSpecial: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  matchNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchNum: { ...typography.metaSmall, color: '#FFFFFF', fontWeight: '800' },
  competition: { ...typography.metaSmall, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  specialBadge: { backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  specialText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  liveBadge: { backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  
  // Teams — OVERLAP FIX: scoreCol has fixed width, teamCol constrained with flex
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  teamCol: { flex: 1, flexShrink: 1 },
  teamName: { ...typography.bodyM, color: '#FFFFFF', fontWeight: '600', flexShrink: 1 },
  scoreCol: { width: 70, alignItems: 'center', flexShrink: 0 },
  score: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  vs: { ...typography.meta, color: 'rgba(255,255,255,0.4)' },
  
  // Prediction row
  predRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingTop: spacing.md, 
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  predInfo: { flex: 1 },
  predLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  predValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: 'rgba(59,130,246,0.2)' },
  marketText: { fontSize: 11, fontWeight: '700', color: '#60A5FA' },
  predValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  noPred: { fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.35)' },
  
  // Outcome
  outcomeCol: { alignItems: 'center', gap: 2 },
  pointsText: { fontSize: 12, fontWeight: '700' },

  // No predictions
  noPredictions: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  noPredTitle: { ...typography.titleM, color: colors.textSecondary },
  noPredSub: { ...typography.bodyS, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
