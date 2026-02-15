import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function LiveScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<any>(null);

  const fetchLive = useCallback(async () => {
    try {
      const res = await apiCall(`/live/matchday/${id}`, { token });
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id, token]);

  useEffect(() => {
    fetchLive();
    // Polling every 60s
    pollRef.current = setInterval(fetchLive, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLive]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'live': return { icon: 'radio-button-on' as const, color: colors.success };
      case 'finished': return { icon: 'checkmark-circle' as const, color: colors.textSecondary };
      case 'void': case 'postponed': return { icon: 'close-circle' as const, color: colors.error };
      default: return { icon: 'time' as const, color: colors.textSecondary };
    }
  };

  if (loading) return <View style={[s.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.accent} /></View>;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t('matchday')} {data?.matchday_number}</Text>
          <View style={[s.liveBadge, { backgroundColor: data?.status === 'LIVE' ? colors.success : colors.info }]}>
            {data?.status === 'LIVE' && <View style={s.liveDot} />}
            <Text style={s.liveText}>{data?.status}</Text>
          </View>
        </View>
      </View>

      {/* Total Points */}
      <View style={[s.totalCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
        <Text style={[s.totalLabel, { color: colors.textSecondary }]}>{t('provisional_points')}</Text>
        <Text style={[s.totalPoints, { color: colors.accent }]}>{data?.total_provisional_points?.toFixed(1) || '0.0'}</Text>
        {data?.joker_applied && (
          <View style={s.jokerBadge}>
            <Ionicons name="star" size={14} color={colors.accent} />
            <Text style={[s.jokerLabel, { color: colors.accent }]}>{t('joker_active')}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        {data?.matches?.map((m: any, i: number) => {
          const si = statusIcon(m.status);
          return (
            <View key={m.match_id} testID={`live-match-${i}`} style={[s.matchCard, { backgroundColor: colors.card, borderColor: m.is_joker ? colors.accent : colors.border, borderWidth: m.is_joker ? 2 : 1 }]}>
              <View style={s.matchTop}>
                <Ionicons name={si.icon} size={16} color={si.color} />
                <Text style={[s.matchStatus, { color: si.color }]}>{m.status.toUpperCase()}</Text>
                {m.is_joker && <View style={[s.jokerTag, { backgroundColor: colors.accent }]}><Text style={s.jokerTagText}>JOLLY x2</Text></View>}
              </View>
              <View style={s.scoreRow}>
                <Text style={[s.teamLive, { color: colors.text }]}>{m.home_team}</Text>
                <View style={[s.scoreBubble, { backgroundColor: colors.background }]}>
                  <Text style={[s.scoreText, { color: colors.accent }]}>
                    {m.home_score !== null ? `${m.home_score} - ${m.away_score}` : '- : -'}
                  </Text>
                </View>
                <Text style={[s.teamLive, { color: colors.text }]}>{m.away_team}</Text>
              </View>
              <View style={s.predRow}>
                <Text style={[s.predLabel, { color: colors.textSecondary }]}>
                  {m.my_prediction ? `${t('predictions')}: ${m.my_prediction}` : t('no_predictions')}
                </Text>
                <Text style={[s.predPts, { color: m.points > 0 ? colors.success : colors.textSecondary }]}>
                  {m.status !== 'scheduled' ? `+${m.points.toFixed(1)}` : '-'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  totalCard: { marginHorizontal: 16, padding: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  totalPoints: { fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  jokerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  jokerLabel: { fontSize: 12, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  matchCard: { borderRadius: 12, padding: 12, marginBottom: 10 },
  matchTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  matchStatus: { fontSize: 11, fontWeight: '700', flex: 1 },
  jokerTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  jokerTagText: { color: '#0F172A', fontSize: 10, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  teamLive: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'center' },
  scoreBubble: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  scoreText: { fontSize: 18, fontWeight: '800' },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  predLabel: { fontSize: 12 },
  predPts: { fontSize: 16, fontWeight: '800' },
});
