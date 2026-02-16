import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token, user, logout, handleAuthError } = useAuth();
  const { leagues, activeLeague, refreshLeagues } = useLeague();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (token) refreshLeagues(token);
  }, [token]);

  const fetchHome = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const res = await apiCall('/home', { token });
      setData(res);
      if (res.matchday?.countdown_seconds) setCountdown(res.matchday.countdown_seconds);
    } catch (e: any) {
      // Handle auth errors gracefully - redirect to login
      if (isAuthError(e)) {
        await handleAuthError(e);
        router.replace('/(auth)/login');
        return;
      }
      console.error('Home fetch error:', e.message);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, handleAuthError, router]);

  useEffect(() => { fetchHome(); }, [fetchHome]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return colors.info;
      case 'LOCKED': return colors.warning;
      case 'LIVE': return colors.success;
      case 'COMPLETED': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  if (loading) return <View style={[s.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.accent} /></View>;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={[s.greeting, { color: colors.textSecondary }]}>Ciao, {user?.username}</Text>
          <Text style={[s.headerTitle, { color: colors.accent }]}>FantaPronostic</Text>
        </View>
        <TouchableOpacity testID="leagues-btn" onPress={() => router.push('/league/list')} style={[s.iconBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="people" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHome(); }} tintColor={colors.accent} />}>
        {/* MATCHDAY CARD */}
        {data?.matchday && (
          <View testID="matchday-card" style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>{t('matchday')}</Text>
              <View style={[s.badge, { backgroundColor: statusColor(data.matchday.status) }]}>
                <Text style={s.badgeText}>{t(data.matchday.status.toLowerCase())}</Text>
              </View>
            </View>
            <Text style={[s.matchdayTitle, { color: colors.text }]}>{data.matchday.label || `${t('matchday')} ${data.matchday.number}`}</Text>
            {data.matchday.status === 'OPEN' && countdown > 0 && (
              <View style={s.countdownWrap}>
                <Ionicons name="time-outline" size={18} color={colors.accent} />
                <Text style={[s.countdownText, { color: colors.accent }]}>{formatCountdown(countdown)}</Text>
              </View>
            )}
            <Text style={[s.predCount, { color: colors.textSecondary }]}>
              {data.matchday.my_predictions_count}/{Math.max(data.matchday.total_matches, 11)} {t('matches')}
            </Text>
            {data.matchday.status === 'OPEN' && (
              <TouchableOpacity testID="insert-predictions-btn" style={[s.ctaBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/(tabs)/predictions')}>
                <Ionicons name="create-outline" size={20} color={colors.background} />
                <Text style={[s.ctaText, { color: colors.background }]}>{t('insert_predictions')}</Text>
              </TouchableOpacity>
            )}
            {data.matchday.status === 'LIVE' && (
              <TouchableOpacity testID="view-live-btn" style={[s.ctaBtn, { backgroundColor: colors.success }]} onPress={() => router.push(`/live/${data.matchday.id}`)}>
                <Ionicons name="pulse" size={20} color="#fff" />
                <Text style={[s.ctaText, { color: '#fff' }]}>{t('view_live')}</Text>
              </TouchableOpacity>
            )}
            {data.matchday.status === 'COMPLETED' && (
              <TouchableOpacity testID="view-results-btn" style={[s.ctaBtn, { backgroundColor: colors.textSecondary }]} onPress={() => router.push(`/live/${data.matchday.id}`)}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={[s.ctaText, { color: '#fff' }]}>{t('view_results') || 'Vedi Risultati'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* LIVE PREVIEW CARD */}
        {data?.live && (
          <View testID="live-preview-card" style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>LIVE</Text>
              <View style={[s.badge, { backgroundColor: colors.success }]}>
                <View style={s.liveDot} />
                <Text style={s.badgeText}>LIVE</Text>
              </View>
            </View>
            <Text style={[s.liveScore, { color: colors.accent }]}>{data.live.total_provisional.toFixed(1)} pts</Text>
            <Text style={[s.liveLabel, { color: colors.textSecondary }]}>{t('provisional_points')}</Text>
          </View>
        )}

        {/* RANKINGS PREVIEW */}
        {data?.rankings_preview && (
          <View testID="rankings-card" style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>{t('rankings')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/rankings')}>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[s.leagueName, { color: colors.text }]}>{data.rankings_preview.league_name}</Text>
            {data.rankings_preview.top?.map((entry: any, i: number) => (
              <View key={i} style={s.rankRow}>
                <Text style={[s.rankNum, { color: i < 3 ? colors.accent : colors.textSecondary }]}>{entry.rank}</Text>
                <Text style={[s.rankName, { color: colors.text }]}>{entry.username}</Text>
                <Text style={[s.rankPts, { color: colors.accent }]}>{entry.total_points.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* LEAGUES */}
        {data?.user_leagues?.length > 0 && (
          <View testID="leagues-card" style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.cardLabel, { color: colors.textSecondary }]}>{t('my_leagues')}</Text>
            {data.user_leagues.map((l: any) => (
              <View key={l.id} style={s.leagueRow}>
                <Ionicons name={l.league_type === 'national' ? 'globe' : 'shield'} size={18} color={colors.accent} />
                <Text style={[s.leagueText, { color: colors.text }]}>{l.name}</Text>
              </View>
            ))}
            <View style={s.leagueBtns}>
              <TouchableOpacity testID="create-league-btn" style={[s.smallBtn, { borderColor: colors.accent }]} onPress={() => router.push('/league/create')}>
                <Text style={[s.smallBtnText, { color: colors.accent }]}>{t('create_league')}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="join-league-btn" style={[s.smallBtn, { borderColor: colors.accent }]} onPress={() => router.push('/league/join')}>
                <Text style={[s.smallBtnText, { color: colors.accent }]}>{t('join_league')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STATS PLACEHOLDER */}
        <View testID="stats-card" style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.cardHeader}>
            <Text style={[s.cardLabel, { color: colors.textSecondary }]}>{t('stats')}</Text>
            <Ionicons name="stats-chart" size={20} color={colors.textSecondary} />
          </View>
          <Text style={[s.statsPlaceholder, { color: colors.textSecondary }]}>{t('stats_coming_soon')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  greeting: { fontSize: 13 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  matchdayTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  countdownWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  countdownText: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  predCount: { fontSize: 13, marginBottom: 12 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, gap: 8 },
  ctaText: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  liveScore: { fontSize: 36, fontWeight: '800', marginBottom: 2 },
  liveLabel: { fontSize: 13 },
  leagueName: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 12 },
  rankNum: { fontSize: 16, fontWeight: '800', width: 24, textAlign: 'center' },
  rankName: { flex: 1, fontSize: 14, fontWeight: '500' },
  rankPts: { fontSize: 14, fontWeight: '700' },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  leagueText: { fontSize: 14, fontWeight: '500' },
  leagueBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  smallBtnText: { fontSize: 12, fontWeight: '600' },
  statsPlaceholder: { fontSize: 14, paddingVertical: 20, textAlign: 'center' },
});
