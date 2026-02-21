import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Animated, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { LiveScreenData, getErrorMessage } from '../../src/types/api';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

const POLLING_INTERVAL = 60000; // 60 seconds

interface LiveMatch {
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  my_prediction: string | null;
  my_market: string | null;
  points: number;
  outcome: string;
}

export default function LiveScreen() {
  const { colors } = useTheme();
  const { token, handleAuthError } = useAuth();
  const params = useLocalSearchParams<{ id: string; league_id?: string }>();
  
  const [data, setData] = useState<LiveScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(60);
  
  // Animation for score changes
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevScoresRef = useRef<Record<string, string>>({});

  const fetchLiveData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const leagueParam = params.league_id ? `?league_id=${params.league_id}` : '';
      const res = await apiCall(`/live/${params.id}${leagueParam}`, { token });
      
      // Check for score changes and trigger animation
      if (data?.matches) {
        const newScores: Record<string, string> = {};
        res.matches.forEach((m: LiveMatch) => {
          const scoreKey = `${m.home_score}-${m.away_score}`;
          newScores[m.match_id] = scoreKey;
          
          const prevScore = prevScoresRef.current[m.match_id];
          if (prevScore && prevScore !== scoreKey) {
            // Score changed! Trigger animation
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

  // Initial load
  useEffect(() => { fetchLiveData(); }, []);

  // Polling every 60 seconds
  useEffect(() => {
    if (!data || data.matchday_status !== 'LIVE') return;
    
    const interval = setInterval(() => {
      fetchLiveData();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [data?.matchday_status, fetchLiveData]);

  // Countdown timer
  useEffect(() => {
    if (!data || data.matchday_status !== 'LIVE') return;
    
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return 60;
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [data?.matchday_status]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return colors.success;
      case 'finished': return colors.textSecondary;
      case 'scheduled': return colors.info;
      default: return colors.textSecondary;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'correct': return colors.success;
      case 'wrong': return colors.error;
      default: return colors.textSecondary;
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
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.loadingText, { color: colors.textSecondary }]}>
            Caricamento Live...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLive = data?.matchday_status === 'LIVE';
  const isCompleted = data?.matchday_status === 'COMPLETED';
  const isLocked = data?.matchday_status === 'LOCKED';
  
  // DEBUG - remove after fix
  console.log('[LiveScreen] matchday_status:', data?.matchday_status, 'isCompleted:', isCompleted);
  
  // Determine points label based on status
  const getPointsLabel = () => {
    console.log('[getPointsLabel] isCompleted:', isCompleted, 'isLive:', isLive, 'isLocked:', isLocked);
    if (isCompleted) return 'Punti Ufficiali';
    if (isLive || isLocked) return 'Punti Provvisori';
    return 'Punti';
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {data?.matchday_label || `Giornata ${data?.matchday_number}`}
          </Text>
          <View style={s.headerMeta}>
            {isLive && (
              <View style={[s.liveBadge, { backgroundColor: colors.success }]}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
            )}
            <Text style={[s.lastUpdateText, { color: colors.textSecondary }]}>
              Agg. {lastUpdate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        {isLive && (
          <View style={[s.countdownBadge, { backgroundColor: colors.card }]}>
            <Ionicons name="refresh" size={14} color={colors.textSecondary} />
            <Text style={[s.countdownText, { color: colors.textSecondary }]}>{countdown}s</Text>
          </View>
        )}
      </View>

      {/* Points Summary */}
      <Animated.View style={[
        s.pointsCard, 
        { backgroundColor: colors.card, transform: [{ scale: pulseAnim }] }
      ]}>
        <View style={s.pointsRow}>
          <View style={s.pointsItem}>
            <Text style={[s.pointsLabel, { color: colors.textSecondary }]}>Punti Base</Text>
            <Text style={[s.pointsValue, { color: colors.text }]}>
              {(data?.base_points || 0).toFixed(1)}
            </Text>
          </View>
          
          {data?.jolly_active && (
            <View style={s.pointsItem}>
              <Text style={[s.pointsLabel, { color: colors.textSecondary }]}>Bonus Jolly</Text>
              <Text style={[s.pointsValue, { color: colors.success }]}>
                +{(data?.joker_bonus || 0).toFixed(1)}
              </Text>
            </View>
          )}
          
          <View style={s.pointsItem}>
            <Text style={[s.pointsLabel, { color: colors.textSecondary }]}>
              {data?.matchday_status === 'COMPLETED' ? 'Punti Ufficiali' : 'Punti Provvisori'}
            </Text>
            <Text style={[s.pointsValueBig, { color: colors.accent }]}>
              {(data?.total_live_points || 0).toFixed(1)}
            </Text>
          </View>
        </View>
        
        {data?.jolly_active && (
          <View style={[s.jollyBanner, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
            <Ionicons name="star" size={16} color={colors.accent} />
            <Text style={[s.jollyText, { color: colors.accent }]}>JOLLY ATTIVO - x2</Text>
          </View>
        )}
      </Animated.View>

      {/* Matches List */}
      <ScrollView 
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchLiveData(true)} 
            tintColor={colors.accent}
          />
        }
      >
        {data?.matches?.map((match: LiveMatch, idx: number) => (
          <View 
            key={match.match_id} 
            style={[
              s.matchCard, 
              { backgroundColor: colors.card, borderColor: colors.border },
              match.status === 'live' && { borderColor: colors.success, borderWidth: 2 }
            ]}
          >
            {/* Match Header */}
            <View style={s.matchHeader}>
              <Text style={[s.matchNum, { color: colors.textSecondary }]}>{idx + 1}</Text>
              <Text style={[s.competition, { color: colors.textSecondary }]}>
                {match.competition}
              </Text>
              <View style={[s.statusBadge, { backgroundColor: getStatusColor(match.status) }]}>
                {match.status === 'live' && <View style={s.liveDotSmall} />}
                <Text style={s.statusText}>
                  {match.status === 'live' ? 'LIVE' : match.status === 'finished' ? 'FT' : 'SCH'}
                </Text>
              </View>
            </View>

            {/* Teams & Score */}
            <View style={s.teamsRow}>
              <View style={s.teamCol}>
                <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>
                  {match.home_team}
                </Text>
              </View>
              <View style={s.scoreCol}>
                {match.home_score !== null ? (
                  <Text style={[
                    s.score, 
                    { color: match.status === 'live' ? colors.success : colors.text }
                  ]}>
                    {match.home_score} - {match.away_score}
                  </Text>
                ) : (
                  <Text style={[s.vs, { color: colors.textSecondary }]}>vs</Text>
                )}
              </View>
              <View style={s.teamCol}>
                <Text style={[s.teamName, { color: colors.text, textAlign: 'right' }]} numberOfLines={1}>
                  {match.away_team}
                </Text>
              </View>
            </View>

            {/* My Prediction */}
            <View style={[s.predRow, { borderTopColor: colors.border }]}>
              <View style={s.predInfo}>
                {match.my_prediction ? (
                  <View style={s.predValueRow}>
                    <View style={[s.marketBadge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                      <Text style={[s.marketText, { color: colors.info }]}>
                        {formatMarket(match.my_market)}
                      </Text>
                    </View>
                    <Text style={[s.predValue, { color: colors.text }]}>
                      {match.my_prediction}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.noPred, { color: colors.textSecondary }]}>
                    Nessun pronostico
                  </Text>
                )}
              </View>

              {/* Points */}
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
                  <Ionicons name="time" size={20} color={colors.textSecondary} />
                )}
              </View>
            </View>
          </View>
        ))}

        {/* Summary Footer */}
        <View style={[s.summaryFooter, { backgroundColor: colors.card }]}>
          <Text style={[s.summaryText, { color: colors.textSecondary }]}>
            {data?.valid_matches || 0} partite valide • {data?.void_matches || 0} annullate
          </Text>
          <Text style={[s.serverTime, { color: colors.textSecondary }]}>
            Server: {data?.server_time ? new Date(data.server_time).toLocaleTimeString('it-IT') : '-'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  lastUpdateText: { fontSize: 11 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  countdownText: { fontSize: 12, fontWeight: '600' },
  
  // Points Card
  pointsCard: { marginHorizontal: 16, padding: 16, borderRadius: 14, marginBottom: 8 },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  pointsItem: { alignItems: 'center' },
  pointsLabel: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
  pointsValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  pointsValueBig: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  jollyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8, borderRadius: 8 },
  jollyText: { fontSize: 13, fontWeight: '700' },
  
  // Matches List
  scrollContent: { padding: 16, paddingBottom: 100 },
  matchCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  matchNum: { fontSize: 11, fontWeight: '700', width: 20, textAlign: 'center' },
  competition: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveDotSmall: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  statusText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  
  // Teams
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  teamCol: { flex: 1 },
  teamName: { fontSize: 14, fontWeight: '600' },
  scoreCol: { paddingHorizontal: 12, minWidth: 70, alignItems: 'center' },
  score: { fontSize: 20, fontWeight: '800' },
  vs: { fontSize: 12 },
  
  // Prediction row
  predRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  predInfo: { flex: 1 },
  predValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marketBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  marketText: { fontSize: 10, fontWeight: '700' },
  predValue: { fontSize: 15, fontWeight: '700' },
  noPred: { fontSize: 12, fontStyle: 'italic' },
  pointsCol2: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchPoints: { fontSize: 14, fontWeight: '700' },
  
  // Footer
  summaryFooter: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  summaryText: { fontSize: 12 },
  serverTime: { fontSize: 10, marginTop: 4 },
});
