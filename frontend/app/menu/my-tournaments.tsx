import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, borderRadius } from '../../src/theme/designSystem';

type Tournament = {
  id: string;
  name: string;
  status: string;
  max_participants: number;
  registered_count: number;
  is_registered: boolean;
  my_status: string | null;
  groups_count: number;
  players_per_group: number;
  current_round: number;
  duration_rounds: number;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  registration: { label: 'Iscrizioni aperte', color: '#22c55e', icon: 'person-add' },
  groups: { label: 'Fase a gironi', color: '#3b82f6', icon: 'grid' },
  knockout: { label: 'Eliminazione', color: '#f59e0b', icon: 'flash' },
  completed: { label: 'Concluso', color: '#6b7280', icon: 'checkmark-circle' },
};

export default function MyTournaments() {
  const { token } = useAuth();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    if (!token) return;
    try {
      const all = await apiCall<Tournament[]>('/tournaments', { token });
      setTournaments(all.filter(t => t.is_registered));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="my-tournaments-back">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>I miei tornei</Text>
        <TouchableOpacity onPress={() => router.push('/menu/browse-tournaments' as any)} style={s.addBtn} data-testid="browse-btn">
          <Ionicons name="add" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.accent} />}
      >
        {tournaments.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Nessun torneo</Text>
            <Text style={s.emptyText}>Non sei iscritto a nessun torneo</Text>
            <TouchableOpacity
              style={s.browseBtn}
              onPress={() => router.push('/menu/browse-tournaments' as any)}
              data-testid="empty-browse-btn"
            >
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={s.browseBtnText}>Cerca tornei</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tournaments.map(t => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.completed;
            const isEliminated = t.my_status === 'eliminated';

            return (
              <TouchableOpacity
                key={t.id}
                style={[s.card, isEliminated && s.cardEliminated]}
                activeOpacity={0.8}
                onPress={() => router.push(`/tournament/${t.id}` as any)}
                data-testid={`my-tournament-${t.id}`}
              >
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    <Text style={[s.cardName, isEliminated && { color: colors.textMuted }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <View style={[s.statusPill, { backgroundColor: cfg.color + '20' }]}>
                      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                      <Text style={[s.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>

                <View style={s.cardMeta}>
                  <View style={s.metaItem}>
                    <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                    <Text style={s.metaText}>{t.registered_count}/{t.max_participants}</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                    <Text style={s.metaText}>Giornata {t.current_round}/{t.duration_rounds}</Text>
                  </View>
                  {isEliminated && (
                    <View style={s.eliminatedBadge}>
                      <Text style={s.eliminatedText}>Eliminato</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
  browseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1F4C8F', paddingVertical: 12, paddingHorizontal: 24, borderRadius: borderRadius.md },
  browseBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardEliminated: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardLeft: { flex: 1, gap: 6 },
  cardName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  eliminatedBadge: { backgroundColor: '#ef444420', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  eliminatedText: { fontSize: 11, fontWeight: '700', color: '#ef4444' },
});
