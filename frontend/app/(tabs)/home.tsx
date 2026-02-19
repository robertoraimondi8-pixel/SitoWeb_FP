import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Design System
import { colors, typography, spacing, borderRadius, shadows, getStatusColor, getPerformanceColor } from '../../src/theme/designSystem';
import { SectionCard, StatusBadge, PrimaryButton, StatBlock, LastFiveIndicator } from '../../src/components/ui';
import { BrandLogo } from '../../src/components/BrandLogo';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { token, user, handleAuthError } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Fade animation
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (token) refreshLeagues(token);
  }, [token]);

  const fetchHome = useCallback(async () => {
    // Usa token da React state O da AsyncStorage (evita race condition dopo login)
    const authToken = token || await AsyncStorage.getItem('access_token');
    if (!authToken) {
      setLoading(false);
      return;
    }
    
    try {
      const res = await apiCall('/home', { token: authToken });
      setData(res);
      if (res.matchday?.countdown_seconds) setCountdown(res.matchday.countdown_seconds);
      
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (e: any) {
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error('Home fetch error:', e.message);
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, handleAuthError, router, fadeAnim]);

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

  const formatPoints = (n: any) => {
    const num = typeof n === 'number' ? n : Number(n || 0);
    return num.toFixed(1);
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN': return 'Aperta';
      case 'LIVE': return 'Live';
      case 'LOCKED': return 'Chiusa';
      case 'COMPLETED': return 'Completata';
      default: return status;
    }
  };

  const getCtaConfig = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN':
        return { icon: 'create-outline' as const, label: 'INSERISCI PRONOSTICI', route: '/(tabs)/predictions' };
      case 'LIVE':
        return { icon: 'pulse' as const, label: 'SEGUI LIVE', route: `/live/${data?.matchday?.id}` };
      case 'COMPLETED':
        return { icon: 'checkmark-circle' as const, label: 'VEDI RISULTATI', route: `/live/${data?.matchday?.id}` };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const ctaConfig = data?.matchday ? getCtaConfig(data.matchday.status) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Ciao, {user?.username}</Text>
          <View style={styles.logoSpacing}>
            <BrandLogo variant="wordmark" size="lg" />
          </View>
        </View>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => router.push('/league/list')}
        >
          <Ionicons name="people-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView 
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent} 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => { setRefreshing(true); fetchHome(); }} 
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* MATCHDAY CARD */}
        {data?.matchday && (
          <View style={styles.matchdayCard}>
            <View style={styles.matchdayHeader}>
              <Text style={styles.sectionLabel}>GIORNATA</Text>
              <StatusBadge status={data.matchday.status} label={getStatusLabel(data.matchday.status)} />
            </View>
            
            <Text style={styles.matchdayTitle}>
              {data.matchday.label || `Giornata ${data.matchday.number}`}
            </Text>
            
            <Text style={styles.matchdayMeta}>
              {data.matchday.my_predictions_count}/{Math.max(data.matchday.total_matches, 11)} partite
            </Text>

            {data.matchday.status === 'OPEN' && countdown > 0 && (
              <View style={styles.countdownContainer}>
                <Ionicons name="time-outline" size={18} color={colors.accent} />
                <Text style={styles.countdownText}>{formatCountdown(countdown)}</Text>
              </View>
            )}

            {ctaConfig && (
              <PrimaryButton
                title={ctaConfig.label}
                icon={ctaConfig.icon}
                onPress={() => router.push(ctaConfig.route as any)}
                style={styles.ctaButton}
              />
            )}
          </View>
        )}

        {/* USER SUMMARY */}
        {data?.user_summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionLabel}>LA TUA LEGA · SINTESI</Text>
            
            <View style={styles.statsRow}>
              <StatBlock 
                label="Posizione" 
                value={data.user_summary.rank ? `${data.user_summary.rank}°` : '-'}
                accent
              />
              <View style={styles.statDivider} />
              <StatBlock 
                label="Punti" 
                value={formatPoints(data.user_summary.points)}
              />
              <View style={styles.statDivider} />
              <StatBlock 
                label="Giornate" 
                value={data.user_summary.matchdays_played ?? 0}
              />
              <View style={styles.statDivider} />
              <StatBlock 
                label="Totali" 
                value={formatPoints(data.user_summary.total_points)}
                accent
              />
            </View>
          </View>
        )}

        {/* LAST 5 PERFORMANCE */}
        {Array.isArray(data?.last_5_performance) && data.last_5_performance.length > 0 && (
          <SectionCard title="ULTIMI 5">
            <LastFiveIndicator data={data.last_5_performance} />
          </SectionCard>
        )}

        {/* LIVE PREVIEW */}
        {data?.live && (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <StatusBadge status={data.matchday?.status || 'LIVE'} label={data.matchday?.status === 'COMPLETED' ? 'COMPLETATA' : 'LIVE'} />
            </View>
            <Text style={styles.liveScore}>{formatPoints(data.live.total_provisional)} pts</Text>
            <Text style={styles.liveMeta}>
              {data.matchday?.status === 'COMPLETED' ? 'Punti ufficiali' : 'Punti provvisori'}
            </Text>
          </View>
        )}

        {/* RANKINGS PREVIEW */}
        {data?.rankings_preview && (
          <View style={styles.rankingsCard}>
            <View style={styles.rankingsHeader}>
              <Text style={styles.sectionLabel}>CLASSIFICHE</Text>
              <TouchableOpacity 
                style={styles.rankingsMore}
                onPress={() => router.push('/(tabs)/rankings')}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.leagueName}>{data.rankings_preview.league_name}</Text>
            
            {data.rankings_preview.top?.map((entry: any, i: number) => {
              const isCurrentUser = entry.user_id === user?.id;
              return (
                <View 
                  key={entry.user_id || i} 
                  style={[
                    styles.rankRow,
                    isCurrentUser && styles.rankRowHighlight,
                  ]}
                >
                  {isCurrentUser && <View style={styles.rankRowAccent} />}
                  <Text style={[
                    styles.rankPosition,
                    i < 3 && styles.rankPositionTop3,
                  ]}>
                    {entry.rank}
                  </Text>
                  <Text style={[styles.rankName, isCurrentUser && styles.rankNameBold]}>
                    {entry.username}
                  </Text>
                  <Text style={styles.rankPoints}>{formatPoints(entry.total_points)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* MY LEAGUES */}
        {data?.user_leagues?.length > 0 && (
          <SectionCard title="LE MIE LEGHE">
            {data.user_leagues.map((league: any) => (
              <View key={league.id} style={styles.leagueRow}>
                <Ionicons 
                  name={league.league_type === 'national' ? 'globe-outline' : 'shield-outline'} 
                  size={20} 
                  color={colors.primary} 
                />
                <Text style={styles.leagueText}>{league.name}</Text>
              </View>
            ))}
            
            <View style={styles.leagueActions}>
              <PrimaryButton
                title="Crea Lega"
                variant="outline"
                size="small"
                onPress={() => router.push('/league/create')}
                style={styles.leagueBtn}
              />
              <PrimaryButton
                title="Unisciti"
                variant="outline"
                size="small"
                onPress={() => router.push('/league/join')}
                style={styles.leagueBtn}
              />
            </View>
          </SectionCard>
        )}

        {/* STATS PLACEHOLDER */}
        <SectionCard title="STATISTICHE">
          <View style={styles.statsPlaceholder}>
            <Ionicons name="stats-chart-outline" size={32} color={colors.textMuted} />
            <Text style={styles.statsPlaceholderText}>Prossimamente</Text>
          </View>
        </SectionCard>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    ...typography.bodyS,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  logoSpacing: {
    marginTop: 0,
    marginBottom: 0,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
  },
  
  // Matchday Card
  matchdayCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  matchdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  matchdayTitle: {
    ...typography.titleL,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  matchdayMeta: {
    ...typography.bodyS,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  countdownText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  ctaButton: {
    marginTop: spacing.sm,
  },
  
  // Summary Card
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  
  // Live Card
  liveCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  liveHeader: {
    marginBottom: spacing.md,
  },
  liveScore: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.success,
  },
  liveMeta: {
    ...typography.bodyS,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  
  // Rankings Card
  rankingsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  rankingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rankingsMore: {
    padding: spacing.xs,
  },
  leagueName: {
    ...typography.titleM,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  rankRowHighlight: {
    backgroundColor: colors.cardHighlight,
    marginLeft: -spacing.sm,
    marginRight: -spacing.sm,
    paddingLeft: spacing.lg,
  },
  rankRowAccent: {
    position: 'absolute',
    left: 0,
    top: spacing.xs,
    bottom: spacing.xs,
    width: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  rankPosition: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rankPositionTop3: {
    color: colors.accent,
  },
  rankName: {
    flex: 1,
    ...typography.bodyM,
    color: colors.textPrimary,
  },
  rankNameBold: {
    fontWeight: '700',
  },
  rankPoints: {
    ...typography.statMedium,
    color: colors.accent,
  },
  
  // Leagues
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  leagueText: {
    ...typography.bodyM,
    color: colors.textPrimary,
  },
  leagueActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  leagueBtn: {
    flex: 1,
  },
  
  // Stats Placeholder
  statsPlaceholder: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  statsPlaceholderText: {
    ...typography.bodyS,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
