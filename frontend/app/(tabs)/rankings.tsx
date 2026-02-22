import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  ActivityIndicator, Modal, FlatList 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Design System
import { League, Matchday, StandingsData, getErrorMessage } from '../../src/types/api';

import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { StatusBadge } from '../../src/components/ui';

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
  const [tab, setTab] = useState<'total' | 'weekly'>('total');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Weekly specific
  const [matchdays, setMatchdays] = useState<League[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<StandingsData | null>(null);
  const [showMatchdayPicker, setShowMatchdayPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ls = await apiCall('/leagues', { token });
        setLeagues(ls);
        if (ls.length > 0) {
          const firstLeagueId = ls[0].id;
          setSelectedLeague(firstLeagueId);
          // Carica matchdays filtrati per la lega
          const mds = await apiCall(`/standings/matchdays?league_id=${firstLeagueId}`, { token });
          setMatchdays(mds);
          if (mds.length > 0) setSelectedMatchday(mds[0]);
        }
      } catch (e: unknown) { 
        if (isAuthError(e)) {
          const didLogout = await handleAuthError(e);
          if (didLogout) router.replace('/(auth)/login');
          return;
        }
        console.error(e); 
      }
    })();
  }, [token, handleAuthError]);

  // Ricarica matchdays quando cambia la lega selezionata
  useEffect(() => {
    if (!selectedLeague) return;
    (async () => {
      try {
        const mds = await apiCall(`/standings/matchdays?league_id=${selectedLeague}`, { token });
        setMatchdays(mds);
        if (mds.length > 0) setSelectedMatchday(mds[0]);
        else setSelectedMatchday(null);
      } catch (e: unknown) { console.error(e); }
    })();
  }, [selectedLeague, token]);

  const fetchStandings = useCallback(async () => {
    if (!selectedLeague) { setLoading(false); return; }
    setLoading(true);
    try {
      let url: string;
      if (tab === 'total') {
        url = `/standings/total?league_id=${selectedLeague}`;
      } else {
        if (!selectedMatchday) { setLoading(false); return; }
        url = `/standings/weekly/${selectedMatchday.id}?league_id=${selectedLeague}`;
      }
      const res = await apiCall(url, { token });
      setStandings(res);
    } catch (e: unknown) { 
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error(e); 
    }
    finally { setLoading(false); }
  }, [token, tab, selectedLeague, selectedMatchday, handleAuthError]);

  useEffect(() => { fetchStandings(); }, [fetchStandings]);

  const viewUserPredictions = (userId: string) => {
    if (!selectedMatchday) return;
    router.push({
      pathname: '/user-predictions',
      params: { userId, matchdayId: selectedMatchday.id, leagueId: selectedLeague }
    });
  };

  const viewUserProfile = (userId: string) => {
    router.push({
      pathname: '/user-detail',
      params: { userId, leagueId: selectedLeague }
    });
  };

  const formatPoints = (n: number) => n.toFixed(1);

  const renderEntry = (entry: StandingEntry, index: number) => {
    const isTop3 = index < 3;
    const isCurrentUser = entry.user_id === user?.id;
    const points = tab === 'total' ? entry.total_points : entry.matchday_points;
    
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
          { backgroundColor: isTop3 ? colors.accent : colors.background }
        ]}>
          <Text style={[
            styles.rankText,
            isTop3 && styles.rankTextTop3,
          ]}>
            {entry.rank}
          </Text>
        </View>
        
        <View style={styles.entryInfo}>
          <Text style={[styles.entryName, isCurrentUser && styles.entryNameBold]}>
            {entry.username}
            {isCurrentUser && ' (Tu)'}
          </Text>
          {isTop3 && tab === 'total' && (
            <Text style={styles.entryMeta}>
              {entry.matchdays_played || 0} giornate • {entry.jolly_used || 0} jolly
            </Text>
          )}
        </View>
        
        <View style={styles.pointsContainer}>
          <Text style={[styles.pointsText, isTop3 && styles.pointsTextLarge]}>
            {formatPoints(points || 0)}
          </Text>
          {tab === 'total' && entry.current_week_points !== undefined && entry.current_week_points > 0 && (
            <Text style={styles.weekBonus}>+{formatPoints(entry.current_week_points)}</Text>
          )}
          {tab === 'weekly' && entry.jolly_active && (
            <View style={styles.jollyBadge}>
              <Ionicons name="star" size={10} color={colors.accent} />
              <Text style={styles.jollyText}>x2</Text>
            </View>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('rankings.title')}</Text>
        <View style={styles.accentLine} />
      </View>

      {/* League Header - show league name, selector only if multiple leagues */}
      {leagues.length > 1 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.leagueScroll} 
          contentContainerStyle={styles.leagueContent}
        >
          {leagues.map(l => (
            <TouchableOpacity 
              key={l.id} 
              testID={`league-filter-${l.id}`} 
              onPress={() => setSelectedLeague(l.id)} 
              style={[
                styles.leagueChip, 
                selectedLeague === l.id && styles.leagueChipActive
              ]}
            >
              <Text style={[
                styles.leagueChipText, 
                selectedLeague === l.id && styles.leagueChipTextActive
              ]}>
                {l.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : leagues.length === 1 ? (
        <View style={styles.singleLeagueHeader}>
          <Ionicons name="trophy" size={16} color={colors.accent} />
          <Text style={styles.singleLeagueText}>
            {leagues[0].name}
          </Text>
        </View>
      ) : null}

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
        <TouchableOpacity 
          testID="matchday-selector"
          onPress={() => setShowMatchdayPicker(true)}
          style={styles.matchdaySelector}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.matchdaySelectorText}>
            {selectedMatchday ? `Giornata ${selectedMatchday.number}` : 'Seleziona giornata'}
          </Text>
          <View style={styles.matchdaySelectorBadge}>
            <Text style={styles.matchdaySelectorBadgeText}>
              {selectedMatchday?.status || ''}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Standings List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.listCard}>
            {standings?.entries?.map((entry: StandingEntry, i: number) => renderEntry(entry, i))}
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
              <Text style={styles.emptyTitle}>Nessun dato disponibile</Text>
              <Text style={styles.emptySubtitle}>
                La classifica sarà disponibile dopo la prima giornata
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
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
  leagueScroll: { 
    maxHeight: 52,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  leagueContent: { 
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md,
    gap: spacing.md, 
    flexDirection: 'row' 
  },
  leagueChip: { 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.pill, 
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leagueChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  leagueChipText: { 
    ...typography.meta,
    color: colors.textSecondary,
  },
  leagueChipTextActive: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  singleLeagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
    backgroundColor: colors.card,
  },
  tabRow: { 
    flexDirection: 'row', 
    backgroundColor: colors.background,
    borderRadius: borderRadius.md, 
    padding: spacing.xs,
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.sm, 
    alignItems: 'center' 
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    ...shadows.card,
  },
  tabText: { 
    ...typography.bodyM,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
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
    borderRadius: borderRadius.lg, 
    backgroundColor: colors.card,
    ...shadows.card,
    gap: spacing.sm,
  },
  matchdaySelectorText: { 
    flex: 1, 
    ...typography.bodyM,
    color: colors.textPrimary,
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
  
  // List
  scrollContent: { 
    padding: spacing.lg, 
    paddingBottom: 100 
  },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    ...shadows.card,
    overflow: 'hidden',
  },
  
  // Entry row
  entryRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  entryRowTop3: {
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  entryRowCurrent: {
    backgroundColor: colors.cardHighlight,
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
    color: colors.textSecondary,
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
    color: colors.textPrimary,
  },
  entryNameBold: {
    fontWeight: '700',
  },
  entryMeta: { 
    ...typography.metaSmall,
    color: colors.textMuted,
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
