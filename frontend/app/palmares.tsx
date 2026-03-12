import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const ACCENT = '#F5A623';

type TrophyCategory = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  gradColors: readonly [string, string, string];
  items: { label: string; count: number; icon: keyof typeof Ionicons.glyphMap }[];
};

const CATEGORIES: TrophyCategory[] = [
  {
    key: 'league',
    icon: 'trophy',
    title: 'Trofei Lega',
    subtitle: 'Vittorie nelle leghe di campionato',
    color: ACCENT,
    gradColors: ['#2C5FA8', '#1F4C8F', '#162F5C'] as const,
    items: [
      { label: 'Campione di Lega', count: 0, icon: 'trophy' },
      { label: 'Secondo classificato', count: 0, icon: 'medal' },
      { label: 'Terzo classificato', count: 0, icon: 'ribbon' },
    ],
  },
  {
    key: 'tournament',
    icon: 'flash',
    title: 'Trofei Tornei',
    subtitle: 'Vittorie nei tornei ad eliminazione',
    color: '#22c55e',
    gradColors: ['#166534', '#15803d', '#166534'] as const,
    items: [
      { label: 'Campione Torneo', count: 0, icon: 'trophy' },
      { label: 'Finalista', count: 0, icon: 'medal' },
      { label: 'Semifinalista', count: 0, icon: 'ribbon' },
    ],
  },
  {
    key: 'weekly',
    icon: 'calendar',
    title: 'Trofei Settimanali',
    subtitle: 'Record nelle singole giornate',
    color: '#8B5CF6',
    gradColors: ['#5B21B6', '#6D28D9', '#4C1D95'] as const,
    items: [
      { label: 'Miglior punteggio giornata', count: 0, icon: 'star' },
      { label: 'Punteggio perfetto', count: 0, icon: 'diamond' },
      { label: 'Serie positiva (5+)', count: 0, icon: 'flame' },
    ],
  },
];

export default function PalmaresScreen() {
  const router = useRouter();

  const totalTrophies = CATEGORIES.reduce(
    (sum, cat) => sum + cat.items.reduce((s, it) => s + it.count, 0), 0
  );

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

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Trophy Summary */}
          <View style={s.summaryCard} data-testid="palmares-summary">
            <LinearGradient
              colors={['rgba(245,166,35,0.12)', 'rgba(245,166,35,0.04)']}
              style={s.summaryGrad}
            >
              <View style={s.summaryIcon}>
                <Ionicons name="medal" size={36} color={ACCENT} />
              </View>
              <Text style={s.summaryCount}>{totalTrophies}</Text>
              <Text style={s.summaryLabel}>Trofei totali</Text>
              <View style={s.summaryDivider} />
              <View style={s.summaryRow}>
                {CATEGORIES.map((cat) => {
                  const catTotal = cat.items.reduce((s, it) => s + it.count, 0);
                  return (
                    <View key={cat.key} style={s.summaryCol}>
                      <Ionicons name={cat.icon} size={18} color={cat.color} />
                      <Text style={[s.summaryColCount, { color: cat.color }]}>{catTotal}</Text>
                    </View>
                  );
                })}
              </View>
            </LinearGradient>
          </View>

          {/* Trophy Categories */}
          {CATEGORIES.map((cat) => (
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
                {/* Category Header */}
                <View style={s.catHeader}>
                  <View style={[s.catIconWrap, { borderColor: `${cat.color}40` }]}>
                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.catTitle}>{cat.title}</Text>
                    <Text style={s.catSub}>{cat.subtitle}</Text>
                  </View>
                </View>

                {/* Trophy Items */}
                {cat.items.map((item, idx) => (
                  <View key={item.label}>
                    {idx > 0 && <View style={s.itemDivider} />}
                    <View style={s.trophyItem}>
                      <View style={[s.trophyIconCircle, { backgroundColor: `${cat.color}15`, borderColor: `${cat.color}30` }]}>
                        <Ionicons name={item.icon} size={16} color={cat.color} />
                      </View>
                      <Text style={s.trophyLabel}>{item.label}</Text>
                      <View style={s.trophyCountWrap}>
                        <Text style={[s.trophyCount, item.count > 0 && { color: cat.color }]}>
                          {item.count}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </LinearGradient>
            </View>
          ))}

          {/* Empty State Message */}
          <View style={s.emptyMsg} data-testid="palmares-empty-message">
            <Ionicons name="sparkles-outline" size={20} color="rgba(255,255,255,0.3)" />
            <Text style={s.emptyText}>
              I trofei verranno assegnati al termine di ogni competizione. Gioca e conquista il tuo primo trofeo!
            </Text>
          </View>
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

  // Summary
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

  // Category Card
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

  // Trophy Items
  itemDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 2 },
  trophyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  trophyIconCircle: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  trophyLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  trophyCountWrap: {
    minWidth: 32, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  trophyCount: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },

  // Empty
  emptyMsg: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginTop: 4,
  },
  emptyText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17 },
});
