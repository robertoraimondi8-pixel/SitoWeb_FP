/**
 * Live 1v1 Matchup View — Tornei FantaPronostic
 * Mostra la sfida tra due giocatori con pronostici e punteggi live.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors } from '../../src/theme/designSystem';

type MatchDetail = {
  match: {
    id: string; home_team: string; away_team: string;
    home_score: number | null; away_score: number | null;
    status: string; start_time?: string;
  };
  user_a_prediction: string | null;
  user_a_market: string | null;
  user_a_points: number;
  user_b_prediction: string | null;
  user_b_market: string | null;
  user_b_points: number;
};

type LiveData = {
  matchup: {
    id: string;
    user_a_id: string; user_b_id: string;
    user_a_username: string; user_b_username: string;
    result: string; status: string;
  };
  round: { label: string; status: string };
  user_a_total: number;
  user_b_total: number;
  matches: MatchDetail[];
};

export default function MatchupLiveScreen() {
  const { tournamentId, matchupId } = useLocalSearchParams<{ tournamentId: string; matchupId: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLive = useCallback(async () => {
    if (!token || !tournamentId || !matchupId) return;
    try {
      const res = await apiCall<LiveData>(`/tournaments/${tournamentId}/matchup/${matchupId}/live`, { token });
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tournamentId, matchupId]);

  useEffect(() => {
    fetchLive();
    intervalRef.current = setInterval(fetchLive, 30000); // Auto-refresh every 30s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLive]);

  if (loading || !data) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  const { matchup: mu, user_a_total, user_b_total, matches } = data;
  const isLive = data.round.status === 'OPEN' || matches.some(m => m.match.status === 'live');
  const isMe = (uid: string) => uid === user?.id;
  const aIsWinning = user_a_total > user_b_total;
  const bIsWinning = user_b_total > user_a_total;
  const isDraw = user_a_total === user_b_total;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="matchup-back-btn">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerLabel}>{data.round.label}</Text>
          {isLive && (
            <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveText}>LIVE</Text></View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Score banner */}
      <View style={s.scoreBanner} data-testid="matchup-score-banner">
        <View style={s.playerCol}>
          <View style={[s.avatar, isMe(mu.user_a_id) && s.avatarMe]}>
            <Text style={s.avatarText}>{mu.user_a_username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[s.playerName, isMe(mu.user_a_id) && s.playerNameMe]} numberOfLines={1}>
            {mu.user_a_username}
          </Text>
          {isMe(mu.user_a_id) && <Text style={s.youLabel}>TU</Text>}
        </View>

        <View style={s.scoreCenter}>
          <View style={s.scoreRow}>
            <Text style={[s.scoreNum, aIsWinning && s.scoreWin]}>{user_a_total.toFixed(1)}</Text>
            <Text style={s.scoreSep}>-</Text>
            <Text style={[s.scoreNum, bIsWinning && s.scoreWin]}>{user_b_total.toFixed(1)}</Text>
          </View>
          {mu.status === 'completed' && (
            <Text style={s.resultLabel}>
              {mu.result === 'draw' ? 'Pareggio' : mu.result === 'user_a_win' ? `${mu.user_a_username} vince` : `${mu.user_b_username} vince`}
            </Text>
          )}
          {isDraw && mu.status !== 'completed' && <Text style={s.resultLabel}>Parita</Text>}
        </View>

        <View style={s.playerCol}>
          <View style={[s.avatar, isMe(mu.user_b_id) && s.avatarMe]}>
            <Text style={s.avatarText}>{mu.user_b_username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[s.playerName, isMe(mu.user_b_id) && s.playerNameMe]} numberOfLines={1}>
            {mu.user_b_username}
          </Text>
          {isMe(mu.user_b_id) && <Text style={s.youLabel}>TU</Text>}
        </View>
      </View>

      {/* Matches list */}
      <ScrollView
        contentContainerStyle={s.matchesList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLive(); }} tintColor={colors.accent} />}
      >
        <Text style={s.matchesTitle}>PARTITE ({matches.length})</Text>
        {matches.map((md, idx) => {
          const m = md.match;
          const isFinished = m.status === 'finished';
          const isMatchLive = m.status === 'live';
          const showPreds = isFinished || isMatchLive;
          return (
            <View key={m.id || idx} style={s.matchCard} data-testid={`matchup-match-${idx}`}>
              {/* Match info */}
              <View style={s.matchHeader}>
                <Text style={s.matchTeams} numberOfLines={1}>{m.home_team} vs {m.away_team}</Text>
                {isMatchLive && <View style={s.matchLiveDot} />}
                {isFinished && <Ionicons name="checkmark-circle" size={14} color="#22c55e" />}
              </View>
              <Text style={s.matchResult}>
                {m.home_score !== null ? `${m.home_score} - ${m.away_score}` : 'Da giocare'}
              </Text>

              {/* Predictions comparison */}
              <View style={s.predsRow}>
                <View style={[s.predBox, md.user_a_points > 0 && s.predBoxCorrect, md.user_a_points === 0 && showPreds && s.predBoxWrong]}>
                  <Text style={s.predLabel}>{mu.user_a_username.slice(0, 8)}</Text>
                  <Text style={s.predValue}>{showPreds ? (md.user_a_prediction || '-') : '?'}</Text>
                  <Text style={[s.predPts, md.user_a_points > 0 && { color: '#22c55e' }]}>
                    {showPreds ? `+${md.user_a_points.toFixed(1)}` : ''}
                  </Text>
                </View>
                <View style={s.predVs}><Text style={s.predVsText}>VS</Text></View>
                <View style={[s.predBox, md.user_b_points > 0 && s.predBoxCorrect, md.user_b_points === 0 && showPreds && s.predBoxWrong]}>
                  <Text style={s.predLabel}>{mu.user_b_username.slice(0, 8)}</Text>
                  <Text style={s.predValue}>{showPreds ? (md.user_b_prediction || '-') : '?'}</Text>
                  <Text style={[s.predPts, md.user_b_points > 0 && { color: '#22c55e' }]}>
                    {showPreds ? `+${md.user_b_points.toFixed(1)}` : ''}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surfaceDark },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ef444420', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#ef4444' },

  // Score banner
  scoreBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 24, backgroundColor: colors.surfaceNavy },
  playerCol: { alignItems: 'center', gap: 6, width: 90 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarMe: { borderWidth: 2, borderColor: colors.accent },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  playerName: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  playerNameMe: { color: colors.accent },
  youLabel: { fontSize: 9, fontWeight: '800', color: colors.accent, backgroundColor: colors.accent + '25', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  scoreCenter: { alignItems: 'center', gap: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scoreNum: { fontSize: 32, fontWeight: '900', color: 'rgba(255,255,255,0.7)' },
  scoreWin: { color: '#fff' },
  scoreSep: { fontSize: 24, fontWeight: '300', color: 'rgba(255,255,255,0.4)' },
  resultLabel: { fontSize: 11, fontWeight: '700', color: colors.accent },

  // Matches
  matchesList: { padding: 16, gap: 10, paddingBottom: 40 },
  matchesTitle: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  matchCard: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  matchTeams: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  matchLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  matchResult: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },

  // Predictions row
  predsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 0 },
  predBox: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, backgroundColor: colors.background, borderRadius: 8, gap: 2 },
  predBoxCorrect: { backgroundColor: '#22c55e10', borderWidth: 1, borderColor: '#22c55e30' },
  predBoxWrong: { backgroundColor: '#ef444410', borderWidth: 1, borderColor: '#ef444430' },
  predLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  predValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  predPts: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  predVs: { alignItems: 'center', justifyContent: 'center', width: 30 },
  predVsText: { fontSize: 9, fontWeight: '800', color: colors.textMuted },
});
