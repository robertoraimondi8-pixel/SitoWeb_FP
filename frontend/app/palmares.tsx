import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall, isAuthError } from '../src/api/client';
import { useTranslation } from 'react-i18next';

const ACCENT = '#F5A623';



type CategoryDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  subtitleKey: string;
  color: string;
  gradColors: readonly [string, string, string];
  items: { labelKey: string; countKey: string; icon: keyof typeof Ionicons.glyphMap }[];
};

const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'league',
    icon: 'trophy',
    titleKey: 'palmares.league_title',
    subtitleKey: 'palmares.league_subtitle',
    color: ACCENT,
    gradColors: ['#2C5FA8', '#1F4C8F', '#162F5C'] as const,
    items: [
      { labelKey: 'palmares.league_champion', countKey: 'league_champion', icon: 'trophy' },
      { labelKey: 'palmares.league_second', countKey: 'league_second', icon: 'medal' },
      { labelKey: 'palmares.league_third', countKey: 'league_third', icon: 'ribbon' },
    ],
  },
  {
    key: 'tournament',
    icon: 'flash',
    titleKey: 'palmares.tournament_title',
    subtitleKey: 'palmares.tournament_subtitle',
    color: '#22c55e',
    gradColors: ['#166534', '#15803d', '#166534'] as const,
    items: [
      { labelKey: 'palmares.tournament_champion', countKey: 'tournament_champion', icon: 'trophy' },
      { labelKey: 'palmares.tournament_finalist', countKey: 'tournament_finalist', icon: 'medal' },
      { labelKey: 'palmares.tournament_semifinalist', countKey: 'tournament_semifinalist', icon: 'ribbon' },
    ],
  },
  {
    key: 'weekly',
    icon: 'calendar',
    titleKey: 'palmares.weekly_title',
    subtitleKey: 'palmares.weekly_subtitle',
    color: '#8B5CF6',
    gradColors: ['#5B21B6', '#6D28D9', '#4C1D95'] as const,
    items: [
      { labelKey: 'palmares.weekly_best', countKey: 'weekly_best', icon: 'star' },
      { labelKey: 'palmares.weekly_perfect', countKey: 'weekly_perfect', icon: 'diamond' },
      { labelKey: 'palmares.weekly_streak', countKey: 'weekly_streak', icon: 'flame' },
    ],
  },
];

export default function PalmaresScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { token, handleAuthError } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});
  const [recentTrophies, setRecentTrophies] = useState<any[]>([]);

  const fetchTrophies = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiCall('/trophies/my', { token });
      setTotal(data.total || 0);
      setCounts(data.counts || {});
      setRecentTrophies((data.trophies || []).slice(0, 10));
    } catch (err: any) {
      if (isAuthError(err)) handleAuthError();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchTrophies(); }, [fetchTrophies]);
  const onRefresh = () => { setRefreshing(true); fetchTrophies(); };

  const getCount = (category: string, key: string) => counts[category]?.[key] ?? 0;
  const getCatTotal = (catKey: string) => {
    const cat = counts[catKey];
    if (!cat) return 0;
    return Object.values(cat).reduce((sum, v) => sum + v, 0);
  };

  const getTrophyLabel = (type: string) => {
    const map: Record<string, string> = {
      weekly_best: t('palmares.weekly_best_short'),
      weekly_perfect: t('palmares.weekly_perfect_short'),
      weekly_streak: t('palmares.weekly_streak_short'),
      league_champion: t('palmares.league_champion'),
      league_second: t('palmares.league_second_short'),
      league_third: t('palmares.league_third_short'),
      tournament_champion: t('palmares.tournament_champion'),
      tournament_finalist: t('palmares.tournament_finalist'),
      tournament_semifinalist: t('palmares.tournament_semifinalist'),
    };
    return map[type] || type;
  };

  const getTrophyColor = (type: string) => {
    if (type.startsWith('league')) return ACCENT;
    if (type.startsWith('tournament')) return '#22c55e';
    return '#8B5CF6';
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0B1D3A', '#162F5C', '#1F4C8F']} style={s.full}>
        <SafeAreaView style={s.full}>
          <ActivityIndicator size="large" color={ACCENT} style={{ flex: 1 }} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0B1D3A', '#162F5C', '#1F4C8F']} style={s.full}>
      <SafeAreaView style={s.full} edges={['top']}>
        {/* Header */}
        <View style={s.header} data-testid="palmares-header">
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="palmares-back-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Palmares</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        >
          {/* Trophy Summary */}
          <View style={s.summaryCard} data-testid="palmares-summary">
            <LinearGradient
              colors={['rgba(245,166,35,0.12)', 'rgba(245,166,35,0.04)']}
              style={s.summaryGrad}
            >
              <View style={s.summaryIcon}>
                <Ionicons name="medal" size={36} color={ACCENT} />
              </View>
              <Text style={s.summaryCount}>{total}</Text>
              <Text style={s.summaryLabel}>{t('palmares.total_trophies')}</Text>
              <View style={s.summaryDivider} />
              <View style={s.summaryRow}>
                {CATEGORY_DEFS.map((cat) => (
                  <View key={cat.key} style={s.summaryCol}>
                    <Ionicons name={cat.icon} size={18} color={cat.color} />
                    <Text style={[s.summaryColCount, { color: cat.color }]}>{getCatTotal(cat.key)}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>

          {/* Trophy Categories */}
          {CATEGORY_DEFS.map((cat) => (
            <View key={cat.key} style={s.categoryCard} data-testid={`trophy-category-${cat.key}`}>
              <LinearGradient
                colors={cat.gradColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.categoryGrad}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.08)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.catHeader}>
                  <View style={[s.catIconWrap, { borderColor: `${cat.color}40` }]}>
                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.catTitle}>{t(cat.titleKey)}</Text>
                    <Text style={s.catSub}>{t(cat.subtitleKey)}</Text>
                  </View>
                </View>
                {cat.items.map((item, idx) => {
                  const count = getCount(cat.key, item.countKey);
                  return (
                    <View key={item.countKey}>
                      {idx > 0 && <View style={s.itemDivider} />}
                      <View style={s.trophyItem}>
                        <View style={[s.trophyIconCircle, {
                          backgroundColor: count > 0 ? `${cat.color}25` : `${cat.color}10`,
                          borderColor: count > 0 ? `${cat.color}50` : `${cat.color}20`,
                        }]}>
                          <Ionicons name={item.icon} size={16} color={count > 0 ? cat.color : `${cat.color}60`} />
                        </View>
                        <Text style={[s.trophyLabel, count > 0 && { color: '#fff', fontWeight: '600' }]}>{t(item.labelKey)}</Text>
                        <View style={[s.trophyCountWrap, count > 0 && { backgroundColor: `${cat.color}20` }]}>
                          <Text style={[s.trophyCount, count > 0 && { color: cat.color }]}>{count}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </LinearGradient>
            </View>
          ))}

          {/* Recent Trophies */}
          {recentTrophies.length > 0 && (
            <View style={s.recentSection} data-testid="recent-trophies">
              <Text style={s.recentTitle}>{t('palmares.recent_trophies')}</Text>
              {recentTrophies.map((t) => (
                <View key={t.id} style={s.recentItem}>
                  <View style={[s.recentDot, { backgroundColor: getTrophyColor(t.type) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentLabel}>{getTrophyLabel(t.type)}</Text>
                    <Text style={s.recentContext}>
                      {t.context?.league_name || t.context?.tournament_name || ''}
                      {t.context?.matchday_label ? ` · ${t.context.matchday_label}` : ''}
                      {t.context?.points ? ` · ${t.context.points} pt` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {total === 0 && (
            <View style={s.emptyMsg} data-testid="palmares-empty-message">
              <Ionicons name="sparkles-outline" size={20} color="rgba(255,255,255,0.3)" />
              <Text style={s.emptyText}>
                {t('palmares.empty_msg')}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  full: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, gap: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  summaryCard: { marginBottom: 20, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)' },
  summaryGrad: { padding: 24, alignItems: 'center' },
  summaryIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(245,166,35,0.1)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  summaryCount: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryDivider: { width: 48, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  summaryRow: { flexDirection: 'row', gap: 32 },
  summaryCol: { alignItems: 'center', gap: 4 },
  summaryColCount: { fontSize: 16, fontWeight: '700' },
  categoryCard: { marginBottom: 14, borderRadius: 18, overflow: 'hidden' },
  categoryGrad: { padding: 16, borderRadius: 18 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  catIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  catTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  catSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  itemDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 2 },
  trophyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  trophyIconCircle: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  trophyLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  trophyCountWrap: {
    minWidth: 32, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  trophyCount: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.25)' },
  recentSection: { marginTop: 8, marginBottom: 12 },
  recentTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 10 },
  recentItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 4,
  },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  recentContext: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  emptyMsg: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginTop: 4,
  },
  emptyText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17 },
});
