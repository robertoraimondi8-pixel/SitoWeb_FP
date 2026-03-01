import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  ActivityIndicator, Modal, FlatList, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

// Design System
import { League, Matchday, StandingsData, getErrorMessage } from '../../src/types/api';

import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { StatusBadge, AnimatedSweep } from '../../src/components/ui';

// Podium medal colors
const PODIUM_COLORS = [colors.gold, colors.silver, colors.bronze];
const PODIUM_ICONS: Array<React.ComponentProps<typeof Ionicons>['name']> = ['trophy', 'medal-outline', 'medal-outline'];

interface StandingEntry {
  user_id: string;
  username: string;
  rank: number;
  total_points?: number;
  matchday_points?: number;
  current_week_points?: number;
  matchdays_played?: number;
  jolly_used?: number;
  exact_correct?: number;
  total_correct?: number;
  '1x2_correct'?: number;
  jolly_active?: boolean;
  is_current_user: boolean;
}

export default function RankingsScreen() {
  const { t } = useTranslation();
  const { token, user, handleAuthError } = useAuth();
  const { activeLeague } = useLeague();
  const params = useLocalSearchParams<{ tab?: string; matchdayId?: string; leagueId?: string }>();
  const [tab, setTab] = useState<'total' | 'weekly'>('total');
  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiveMatchday, setIsLiveMatchday] = useState(false);
  
  // Weekly specific
  const [matchdays, setMatchdays] = useState<League[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<StandingsData | null>(null);
  const [showMatchdayPicker, setShowMatchdayPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle incoming navigation params (from Home LIVE button)
  useEffect(() => {
    if (params.tab === 'weekly') {
      setTab('weekly');
    }
  }, [params.tab]);

  // Auto-select matchday from params once matchdays are loaded
  useEffect(() => {
    if (params.matchdayId && matchdays.length > 0) {
      const targetMd = matchdays.find((m: any) => m.id === params.matchdayId);
      if (targetMd) {
        setSelectedMatchday(targetMd);
      }
    }
  }, [params.matchdayId, matchdays]);

  // Load matchdays when activeLeague changes
  useEffect(() => {
    if (!activeLeague?.id || !token) return;
    setStandings(null);
    setMatchdays([]);
    setSelectedMatchday(null);
    setLoading(true);
    (async () => {
      try {
        const mds = await apiCall(`/standings/matchdays?league_id=${activeLeague.id}`, { token });
        setMatchdays(mds);
        if (mds.length > 0) setSelectedMatchday(mds[0]);
      } catch (e: unknown) { 
        if (isAuthError(e)) {
          const didLogout = await handleAuthError(e);
          if (didLogout) router.replace('/(auth)/login');
          return;
        }
        console.error(e); 
      }
    })();
  }, [activeLeague?.id, token, handleAuthError]);

  const fetchStandings = useCallback(async () => {
    if (!activeLeague?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      let url: string;
      if (tab === 'total') {
        url = `/standings/total?league_id=${activeLeague.id}`;
      } else {
        if (!selectedMatchday) { setLoading(false); return; }
        url = `/standings/weekly/${selectedMatchday.id}?league_id=${activeLeague.id}`;
      }
      const res = await apiCall(url, { token });
      setStandings(res);
      // Track if viewing a LIVE matchday
      setIsLiveMatchday(tab === 'weekly' && (res?.matchday_status === 'LIVE' || selectedMatchday?.status === 'LIVE'));
    } catch (e: unknown) { 
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error(e); 
    }
    finally { setLoading(false); }
  }, [token, tab, activeLeague?.id, selectedMatchday, handleAuthError]);

  useEffect(() => { fetchStandings(); }, [fetchStandings]);

  const viewUserPredictions = (userId: string) => {
    if (!selectedMatchday) return;
    router.push({
      pathname: '/user-predictions',
      params: { userId, matchdayId: selectedMatchday.id, leagueId: activeLeague?.id || '' }
    });
  };

  const viewUserProfile = (userId: string) => {
    router.push({
      pathname: '/user-detail',
      params: { userId, leagueId: activeLeague?.id || '' }
    });
  };

  const formatPoints = (n: number) => n.toFixed(1);

  // Frontend-only search filter (no API calls, no ranking changes)
  const filteredEntries = useMemo(() => {
    const entries = standings?.entries || [];
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e: StandingEntry) => e.username.toLowerCase().includes(q));
  }, [standings?.entries, searchQuery]);

  const renderEntry = (entry: StandingEntry, index: number) => {
    const isTop3 = index < 3;
    const isCurrentUser = entry.user_id === user?.id;
    const points = tab === 'total' ? entry.total_points : entry.matchday_points;
    const podiumColor = isTop3 ? PODIUM_COLORS[index] : undefined;
    
    return (
      <TouchableOpacity
        key={entry.user_id}
        testID={`rank-${index}`}
        onPress={() => tab === 'total' ? viewUserProfile(entry.user_id) : viewUserPredictions(entry.user_id)}
        style={[
          styles.entryRow,
          isTop3 && styles.entryRowTop3,
          isCurrentUser && styles.entryRowCurrent,
        ]}
      >
        {isCurrentUser && <View style={styles.currentUserAccent} />}
        
        <View style={[
          styles.rankBadge,
          isTop3 && styles.rankBadgeTop3,
          { backgroundColor: isTop3 ? podiumColor : colors.background }
        ]}>
          {isTop3 ? (
            <Ionicons name={PODIUM_ICONS[index]} size={index === 0 ? 18 : 16} color={colors.textInverse} />
          ) : (
            <Text style={styles.rankText}>{entry.rank}</Text>
          )}
        </View>
        
        <View style={styles.entryInfo}>
          <Text style={[styles.entryName, isCurrentUser && styles.entryNameBold]}>
            {entry.username}
            {isCurrentUser && ' (Tu)'}
          </Text>
          {isTop3 && (
            <Text style={[styles.entryMeta, { color: podiumColor }]}>
              {index === 0 ? 'Primo' : index === 1 ? 'Secondo' : 'Terzo'}
              {tab === 'total' && entry.matchdays_played ? ` · ${entry.matchdays_played} giornate` : ''}
            </Text>
          )}
        </View>
        
        <View style={styles.pointsContainer}>
          <Text style={[
            styles.pointsText,
            isTop3 && styles.pointsTextLarge,
            isTop3 && { color: podiumColor },
          ]}>
            {formatPoints(points || 0)}
          </Text>
          {tab === 'total' && entry.current_week_points !== undefined && entry.current_week_points > 0 && (
            <Text style={styles.weekBonus}>+{formatPoints(entry.current_week_points)}</Text>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#F5F6F8', '#ECEFF3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('rankings.title')}</Text>
        <View style={styles.accentLine} />
      </View>

      {/* League Header - single active league from context */}
      {activeLeague && (
        <View style={styles.singleLeagueHeader}>
          <Ionicons name="trophy" size={16} color={colors.accent} />
          <Text style={styles.singleLeagueText}>
            {activeLeague.name}
          </Text>
        </View>
      )}

      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <View style={styles.tabRow}>
          <TouchableOpacity 
            testID="tab-total"
            onPress={() => setTab('total')} 
            style={[styles.tabBtn, tab === 'total' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'total' && styles.tabTextActive]}>
              {t('rankings.tab_total')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            testID="tab-weekly"
            onPress={() => setTab('weekly')} 
            style={[styles.tabBtn, tab === 'weekly' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>
              {t('rankings.tab_weekly')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Matchday Selector */}
      {tab === 'weekly' && (
        <View>
          <TouchableOpacity 
            testID="matchday-selector"
            onPress={() => setShowMatchdayPicker(true)}
            style={[
              styles.matchdaySelector,
              isLiveMatchday && styles.matchdaySelectorLive,
            ]}
          >
            <Ionicons name={isLiveMatchday ? "pulse" : "calendar-outline"} size={18} color={isLiveMatchday ? colors.success : colors.primary} />
            <Text style={styles.matchdaySelectorText}>
              {selectedMatchday ? `Giornata ${selectedMatchday.number}` : 'Seleziona giornata'}
            </Text>
            <View style={[
              styles.matchdaySelectorBadge,
              isLiveMatchday && { backgroundColor: 'rgba(34,197,94,0.15)' },
            ]}>
              <Text style={[
                styles.matchdaySelectorBadgeText,
                isLiveMatchday && { color: colors.success },
              ]}>
                {selectedMatchday?.status || ''}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          {isLiveMatchday && (
            <View style={styles.liveBanner} data-testid="live-standings-banner">
              <View style={styles.liveBannerDot} />
              <Text style={styles.liveBannerText}>Classifica in tempo reale</Text>
            </View>
          )}
        </View>
      )}

      {/* Standings List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Search Bar */}
          <View style={styles.searchContainer} data-testid="search-bar">
            <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca utente..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              data-testid="search-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} data-testid="search-clear">
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.listCardOuter}>
            <LinearGradient
              colors={['#2C5FA8', '#1F4C8F', '#162F5C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.listCard}
            >
              <AnimatedSweep />
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry: StandingEntry, i: number) => renderEntry(entry, i))
            ) : (
              <View style={styles.emptySearch} data-testid="no-results">
                <Ionicons name="person-outline" size={32} color="rgba(255,255,255,0.4)" />
                <Text style={styles.emptySearchText}>Nessun utente trovato</Text>
              </View>
            )}
            </LinearGradient>
          </View>

          {standings?.my_position && !standings.entries?.find((e: StandingEntry) => e.is_current_user) && (
            <View style={styles.myPositionCard}>
              <Ionicons name="person-outline" size={18} color={colors.accent} />
              <Text style={styles.myPositionText}>
                La tua posizione: #{standings.my_position.rank}
              </Text>
              <Text style={styles.myPositionPoints}>
                {formatPoints(standings.my_position.total_points || standings.my_position.matchday_points || 0)} pts
              </Text>
            </View>
          )}

          {(!standings?.entries || standings.entries.length === 0) && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>In attesa del kickoff</Text>
              <Text style={styles.emptySubtitle}>
                La classifica sarà disponibile dopo l'inizio delle partite
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Matchday Picker Modal */}
      <Modal
        visible={showMatchdayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMatchdayPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMatchdayPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona Giornata</Text>
              <TouchableOpacity onPress={() => setShowMatchdayPicker(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={matchdays}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.matchdayItem,
                    selectedMatchday?.id === item.id && styles.matchdayItemActive
                  ]}
                  onPress={() => {
                    setSelectedMatchday(item);
                    setShowMatchdayPicker(false);
                  }}
                >
                  <Text style={styles.matchdayItemText}>
                    Giornata {item.number}
                  </Text>
                  <StatusBadge status={item.status} />
                  {selectedMatchday?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  // Header
  header: { 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.lg,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: { 
    ...typography.titleL,
    color: colors.textPrimary,
  },
  accentLine: {
    width: 32,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
    borderRadius: 2,
  },
  
  // League selector
  singleLeagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  singleLeagueText: {
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  
  // Tab toggle
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  tabRow: { 
    flexDirection: 'row', 
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl, 
    padding: spacing.xs,
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.lg, 
    alignItems: 'center' 
  },
  tabBtnActive: {
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  tabText: { 
    ...typography.bodyM,
    color: 'rgba(255,255,255,0.55)',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  
  // League header (blue box with league name)
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  leagueHeaderText: {
    ...typography.bodyM,
    color: colors.textInverse,
    fontWeight: '700',
  },
  
  // Matchday selector
  matchdaySelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: spacing.lg, 
    marginTop: spacing.md, 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.xl, 
    backgroundColor: '#1F4C8F',
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    gap: spacing.sm,
  },
  matchdaySelectorLive: {
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  matchdaySelectorText: { 
    flex: 1, 
    ...typography.bodyM,
    color: '#FFFFFF',
  },
  matchdaySelectorBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.infoLight,
  },
  matchdaySelectorBadgeText: {
    ...typography.metaSmall,
    color: colors.info,
    fontWeight: '600',
  },
  
  // LIVE banner
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  liveBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // List
  scrollContent: { 
    padding: spacing.lg, 
    paddingBottom: 100 
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: '#FFFFFF',
    height: '100%',
    paddingVertical: 0,
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptySearchText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.5)',
  },
  listCardOuter: {
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.accent,
    overflow: 'hidden',
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  listCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  
  // Entry row
  entryRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: spacing.md,
  },
  entryRowTop3: {
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  entryRowCurrent: {
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  currentUserAccent: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop3: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  rankText: {
    ...typography.bodyM,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
  },
  rankTextTop3: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
  },
  
  entryInfo: { 
    flex: 1 
  },
  entryName: { 
    ...typography.bodyM,
    color: '#FFFFFF',
  },
  entryNameBold: {
    fontWeight: '700',
  },
  entryMeta: { 
    ...typography.metaSmall,
    color: 'rgba(255,255,255,0.45)',
    marginTop: spacing.xs,
  },
  
  pointsContainer: { 
    alignItems: 'flex-end',
    marginRight: spacing.xs,
  },
  pointsText: { 
    ...typography.statMedium,
    color: colors.accent,
  },
  pointsTextLarge: {
    fontSize: 20,
    fontWeight: '800',
  },
  weekBonus: { 
    ...typography.metaSmall,
    color: colors.success,
    marginTop: spacing.xs,
  },
  
  jollyBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 2, 
    paddingHorizontal: spacing.sm, 
    paddingVertical: 2, 
    borderRadius: borderRadius.sm, 
    backgroundColor: colors.accentLight,
    marginTop: spacing.xs,
  },
  jollyText: { 
    ...typography.metaSmall,
    color: colors.accent,
    fontWeight: '700',
  },
  
  // My position
  myPositionCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.md, 
    padding: spacing.lg, 
    borderRadius: borderRadius.lg, 
    backgroundColor: colors.cardHighlight,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: spacing.lg,
  },
  myPositionText: { 
    flex: 1, 
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  myPositionPoints: { 
    ...typography.statMedium,
    color: colors.accent,
  },
  
  // Empty state
  emptyState: { 
    alignItems: 'center', 
    marginTop: 60,
    padding: spacing.xxl,
  },
  emptyTitle: { 
    ...typography.titleM,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: { 
    ...typography.bodyS,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  
  // Modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl, 
    borderTopRightRadius: borderRadius.xl, 
    maxHeight: '60%', 
    paddingBottom: 34,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: spacing.lg, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderLight,
  },
  modalTitle: { 
    ...typography.titleM,
    color: colors.textPrimary,
  },
  matchdayItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.lg, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  matchdayItemActive: {
    backgroundColor: colors.accentLight,
  },
  matchdayItemText: { 
    flex: 1, 
    ...typography.bodyM,
    color: colors.textPrimary,
  },
});
