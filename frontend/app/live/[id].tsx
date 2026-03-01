import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Animated, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { LiveScreenData, getErrorMessage } from '../../src/types/api';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';
import { AnimatedSweep } from '../../src/components/ui';

const POLLING_INTERVAL = 60000;

interface LiveMatch {
  match_id: string;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  competition: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  elapsed: number | null;
  status: string;
  my_prediction: string | null;
  my_market: string | null;
  points: number;
  outcome: string;
  is_special?: boolean;
  multiplier?: number;
}

export default function LiveScreen() {
  const { token, handleAuthError } = useAuth();
  const params = useLocalSearchParams<{ id: string; league_id?: string }>();
  
  const [data, setData] = useState<LiveScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(60);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevScoresRef = useRef<Record<string, string>>({});

  const fetchLiveData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const leagueParam = params.league_id ? `?league_id=${params.league_id}` : '';
      const res = await apiCall(`/live/${params.id}${leagueParam}`, { token });
      
      if (data?.matches) {
        const newScores: Record<string, string> = {};
        res.matches.forEach((m: LiveMatch) => {
          const scoreKey = `${m.home_score}-${m.away_score}`;
          newScores[m.match_id] = scoreKey;
          const prevScore = prevScoresRef.current[m.match_id];
          if (prevScore && prevScore !== scoreKey) {
            Animated.sequence([
              Animated.timing(pulseAnim, { toValue: 1.1, duration: 150, useNativeDriver: true }),
              Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
            ]).start();
          }
        });
        prevScoresRef.current = newScores;
      }
      
      setData(res);
      setLastUpdate(new Date());
      setCountdown(60);
    } catch (e: unknown) { 
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error(e); 
    }
    finally { 
      setLoading(false); 
      setRefreshing(false);
    }
  }, [params.id, token, data?.matches, pulseAnim, handleAuthError]);

  useEffect(() => { fetchLiveData(); }, []);

  useEffect(() => {
    if (!data || data.matchday_status !== 'LIVE') return;
    const interval = setInterval(() => fetchLiveData(), POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [data?.matchday_status, fetchLiveData]);

  useEffect(() => {
    if (!data || data.matchday_status !== 'LIVE') return;
    const timer = setInterval(() => {
      setCountdown(c => c <= 1 ? 60 : c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.matchday_status]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return colors.success;
      case 'finished': return 'rgba(255,255,255,0.4)';
      case 'scheduled': return colors.info;
      default: return 'rgba(255,255,255,0.4)';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'correct': return colors.success;
      case 'wrong': return colors.error;
      default: return 'rgba(255,255,255,0.4)';
    }
  };

  const formatMarket = (market: string | null) => {
    if (!market) return '';
    switch (market) {
      case '1X2': return '1X2';
      case 'GOAL_NOGOL': return 'GNG';
      case 'OVER_UNDER_25': return 'O/U';
      case 'EXACT_SCORE': return 'ES';
      default: return market;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Caricamento Live...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLive = data?.matchday_status === 'LIVE';
  const isCompleted = data?.matchday_status === 'COMPLETED';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="live-back-btn" onPress={() => router.replace('/(tabs)/home' as any)} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>{data?.matchday_label || `Giornata ${data?.matchday_number}`}</Text>
          <View style={s.headerMeta}>
            {isLive && (
              <View style={s.liveBadgeHeader}>
                <View style={s.liveDot} />
                <Text style={s.liveBadgeText}>LIVE</Text>
              </View>
            )}
            <Text style={s.lastUpdateText}>
              Agg. {lastUpdate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        {isLive && (
          <View style={s.countdownBadge}>
            <Ionicons name="refresh" size={14} color={colors.textSecondary} />
            <Text style={s.countdownText}>{countdown}s</Text>
          </View>
        )}
      </View>

      {/* Points Summary — Dark Navy */}
      <View style={s.pointsOuter}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient colors={['#2C5FA8', '#1F4C8F', '#162F5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pointsCard}>
            <AnimatedSweep />
            <View style={s.pointsRow}>
              <View style={s.pointsItem}>
                <Text style={s.pointsLabel}>Punti Base</Text>
                <Text style={s.pointsValue}>{(data?.base_points || 0).toFixed(1)}</Text>
              </View>
              <View style={s.pointsDivider} />
              <View style={s.pointsItem}>
                <Text style={s.pointsLabel}>{isCompleted ? 'Punti Ufficiali' : 'Punti Provvisori'}</Text>
                <Text style={s.pointsValueBig}>{(data?.total_live_points || 0).toFixed(1)}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Matches List */}
      <ScrollView 
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchLiveData(true)} tintColor={colors.accent} />
        }
      >
        {data?.matches?.map((match: LiveMatch, idx: number) => (
          <View 
            key={match.match_id} 
            style={[
              s.matchCard,
              match.status === 'live' && s.matchCardLive,
              match.is_special && s.matchCardSpecial,
            ]}
            data-testid={`live-match-${idx}`}
          >
            <AnimatedSweep />
            {/* Match Header */}
            <View style={s.matchHeader}>
              <View style={[s.matchNumBadge, match.is_special && { backgroundColor: colors.accent }]}>
                <Text style={s.matchNum}>{idx + 1}</Text>
              </View>
              <Text style={s.competition}>{match.competition}</Text>
              {match.is_special && (
                <View style={s.specialBadge}>
                  <Text style={s.specialText}>X3</Text>
                </View>
              )}
              {match.status === 'live' && match.elapsed != null && (
                <View style={s.elapsedBadge}>
                  <Text style={s.elapsedText}>{match.elapsed}'</Text>
                </View>
              )}
              {match.status === 'scheduled' && match.start_time && (
                <Text style={s.kickoffTime}>
                  {new Date(match.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
              <View style={[s.statusBadge, { backgroundColor: getStatusColor(match.status) }]}>
                {match.status === 'live' && <View style={s.liveDotSmall} />}
                <Text style={s.statusText}>
                  {match.status === 'live' ? 'LIVE' : match.status === 'finished' ? 'FT' : match.status === 'scheduled' ? 'SCH' : match.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Teams & Score — FIXED OVERLAP */}
            <View style={s.teamsRow}>
              <View style={s.teamCol}>
                <View style={s.teamNameRow}>
                  {match.home_logo && <Image source={{ uri: match.home_logo }} style={s.teamLogo} />}
                  <Text style={s.teamName} numberOfLines={1} ellipsizeMode="tail">{match.home_team}</Text>
                </View>
              </View>
              <View style={s.scoreCol}>
                {match.home_score !== null ? (
                  <Text style={[s.score, match.status === 'live' && { color: colors.success }]}>
                    {match.home_score} - {match.away_score}
                  </Text>
                ) : match.status === 'scheduled' && match.start_time ? (
                  <Text style={s.schedTime}>
                    {new Date(match.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                ) : (
                  <Text style={s.vs}>vs</Text>
                )}
              </View>
              <View style={s.teamCol}>
                <View style={[s.teamNameRow, { justifyContent: 'flex-end' }]}>
                  <Text style={[s.teamName, { textAlign: 'right' }]} numberOfLines={1} ellipsizeMode="tail">
                    {match.away_team}
                  </Text>
                  {match.away_logo && <Image source={{ uri: match.away_logo }} style={s.teamLogo} />}
                </View>
              </View>
            </View>

            {/* My Prediction */}
            <View style={s.predRow}>
              <View style={s.predInfo}>
                {match.my_prediction ? (
                  <View style={s.predValueRow}>
                    <View style={s.marketBadge}>
                      <Text style={s.marketText}>{formatMarket(match.my_market)}</Text>
                    </View>
                    <Text style={s.predValue}>{match.my_prediction}</Text>
                  </View>
                ) : (
                  <Text style={s.noPred}>Nessun pronostico</Text>
                )}
              </View>
              <View style={s.pointsCol2}>
                {match.outcome !== 'pending' && match.outcome !== 'no_prediction' && (
                  <>
                    <Ionicons 
                      name={match.outcome === 'correct' ? 'checkmark-circle' : 'close-circle'} 
                      size={20} 
                      color={getOutcomeColor(match.outcome)} 
                    />
                    <Text style={[s.matchPoints, { color: getOutcomeColor(match.outcome) }]}>
                      {match.outcome === 'correct' ? `+${match.points.toFixed(1)}` : '0'}
                    </Text>
                  </>
                )}
                {match.outcome === 'pending' && match.my_prediction && (
                  <Ionicons name="time" size={20} color="rgba(255,255,255,0.4)" />
                )}
              </View>
            </View>
          </View>
        ))}

        {/* Summary Footer */}
        <View style={s.summaryFooter}>
          <Text style={s.summaryText}>
            {data?.valid_matches || 0} partite valide &bull; {data?.void_matches || 0} annullate
          </Text>
          <Text style={s.serverTime}>
            Server: {data?.server_time ? new Date(data.server_time).toLocaleTimeString('it-IT') : '-'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { ...typography.bodyS, color: colors.textSecondary },
  
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
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  liveBadgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.success },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  lastUpdateText: { ...typography.metaSmall, color: colors.textSecondary },
  countdownBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: borderRadius.sm, 
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  
  // Points Card — Dark Navy
  pointsOuter: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  pointsCard: { 
    padding: spacing.xl, 
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  pointsRow: { flexDirection: 'row', alignItems: 'center' },
  pointsItem: { flex: 1, alignItems: 'center' },
  pointsDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
  pointsLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  pointsValue: { ...typography.statMedium, color: '#FFFFFF', marginTop: 4 },
  pointsValueBig: { fontSize: 28, fontWeight: '800', color: colors.accent, marginTop: 4 },
  
  // Matches List
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  matchCard: { 
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl, 
    padding: spacing.lg, 
    marginBottom: spacing.md, 
    borderWidth: 1.5,
    borderColor: colors.accent,
    overflow: 'hidden',
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  matchCardLive: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  matchCardSpecial: {
    borderColor: colors.accent,
    borderWidth: 2,
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
  competition: { ...typography.metaSmall, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', flex: 1 },
  specialBadge: { backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  specialText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  elapsedBadge: { backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  elapsedText: { fontSize: 12, fontWeight: '700', color: colors.error },
  kickoffTime: { ...typography.meta, color: 'rgba(255,255,255,0.5)' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveDotSmall: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  
  // Teams — OVERLAP FIX
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  teamCol: { flex: 1, flexShrink: 1 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamLogo: { width: 22, height: 22, borderRadius: 11, flexShrink: 0 },
  teamName: { ...typography.bodyM, color: '#FFFFFF', fontWeight: '600', flex: 1, flexShrink: 1 },
  scoreCol: { width: 80, alignItems: 'center', flexShrink: 0 },
  score: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  vs: { ...typography.meta, color: 'rgba(255,255,255,0.4)' },
  schedTime: { ...typography.bodyM, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  
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
  predValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: 'rgba(59,130,246,0.2)' },
  marketText: { fontSize: 10, fontWeight: '700', color: '#60A5FA' },
  predValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  noPred: { fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.35)' },
  pointsCol2: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchPoints: { fontSize: 14, fontWeight: '700' },
  
  // Footer
  summaryFooter: { 
    padding: spacing.lg, 
    borderRadius: borderRadius.xl, 
    alignItems: 'center', 
    marginTop: spacing.sm,
    backgroundColor: '#1F4C8F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryText: { ...typography.meta, color: 'rgba(255,255,255,0.5)' },
  serverTime: { ...typography.metaSmall, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
});
