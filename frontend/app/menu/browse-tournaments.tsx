import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, borderRadius } from '../../src/theme/designSystem';
import { useTranslation } from 'react-i18next';

type Tournament = {
  id: string;
  name: string;
  status: string;
  max_participants: number;
  registered_count: number;
  spots_left: number;
  is_registered: boolean;
  my_status: string | null;
  groups_count: number;
  players_per_group: number;
  duration_rounds: number;
  entry_fee: number;
  current_round: number;
};

const STATUS_CONFIG_KEYS: Record<string, { labelKey: string; color: string; icon: string }> = {
  registration: { labelKey: 'browseTournaments.status_registration', color: '#22c55e', icon: 'person-add' },
  groups: { labelKey: 'browseTournaments.status_groups', color: '#3b82f6', icon: 'grid' },
  knockout: { labelKey: 'browseTournaments.status_knockout', color: '#f59e0b', icon: 'flash' },
  completed: { labelKey: 'browseTournaments.status_completed', color: '#6b7280', icon: 'checkmark-circle' },
};

export default function BrowseTournaments() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);

  const fetchTournaments = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiCall<Tournament[]>('/tournaments', { token });
      setTournaments(data);
    } catch (_) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const handleRegister = async (tournamentId: string) => {
    if (!token) return;
    setRegistering(tournamentId);
    try {
      await apiCall(`/tournaments/${tournamentId}/register`, { method: 'POST', token });
      fetchTournaments();
    } catch (e: any) {
      alert(e.message || t('browseTournaments.register_error'));
    } finally {
      setRegistering(null);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="browse-tournaments-back">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('browseTournaments.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTournaments(); }} tintColor={colors.accent} />}
      >
        {tournaments.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>{t('browseTournaments.empty_title')}</Text>
            <Text style={s.emptyText}>{t('browseTournaments.empty_text')}</Text>
          </View>
        ) : (
          tournaments.map(tn => {
            const cfg = STATUS_CONFIG_KEYS[tn.status] || STATUS_CONFIG_KEYS.completed;
            const spotsPercent = Math.round((tn.registered_count / tn.max_participants) * 100);
            const isOpen = tn.status === 'registration';
            const isFull = tn.spots_left <= 0;

            return (
              <TouchableOpacity
                key={tn.id}
                style={s.card}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/(tabs)/home', params: { tournament_id: tn.id, tournament_name: tn.name } } as any)}
                data-testid={`tournament-card-${tn.id}`}
              >
                {/* Header */}
                <View style={s.cardHeader}>
                  <Text style={s.cardName} numberOfLines={1}>{tn.name}</Text>
                  <View style={[s.statusBadge, { backgroundColor: cfg.color + '20' }]}>
                    <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                    <Text style={[s.statusText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
                  </View>
                </View>

                {/* Info Grid */}
                <View style={s.infoGrid}>
                  <View style={s.infoItem}>
                    <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                    <Text style={s.infoValue}>{tn.max_participants}</Text>
                    <Text style={s.infoLabel}>{t('browseTournaments.participants')}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Ionicons name="grid-outline" size={16} color={colors.textMuted} />
                    <Text style={s.infoValue}>{tn.groups_count}x{tn.players_per_group}</Text>
                    <Text style={s.infoLabel}>{t('browseTournaments.groups')}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={s.infoValue}>{tn.duration_rounds}</Text>
                    <Text style={s.infoLabel}>{t('browseTournaments.matchdays')}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Ionicons name="cash-outline" size={16} color={colors.textMuted} />
                    <Text style={s.infoValue}>{tn.entry_fee === 0 ? t('browseTournaments.free') : `${tn.entry_fee}$`}</Text>
                    <Text style={s.infoLabel}>{t('browseTournaments.entry_fee')}</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={s.progressSection}>
                  <View style={s.progressHeader}>
                    <Text style={s.progressLabel}>{t('browseTournaments.registered')}</Text>
                    <Text style={s.progressCount}>{tn.registered_count}/{tn.max_participants}</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${spotsPercent}%`, backgroundColor: isFull ? '#ef4444' : cfg.color }]} />
                  </View>
                  {isOpen && !isFull && (
                    <Text style={[s.spotsText, { color: cfg.color }]}>
                      {tn.spots_left} {tn.spots_left === 1 ? t('browseTournaments.spot_remaining') : t('browseTournaments.spots_remaining')}
                    </Text>
                  )}
                </View>

                {/* Action */}
                {isOpen && !tn.is_registered && !isFull ? (
                  <TouchableOpacity
                    style={s.registerBtn}
                    onPress={() => handleRegister(tn.id)}
                    disabled={registering === tn.id}
                    data-testid={`register-btn-${tn.id}`}
                  >
                    {registering === tn.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={18} color="#fff" />
                        <Text style={s.registerBtnText}>{t('browseTournaments.register')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : tn.is_registered ? (
                  <View style={s.registeredBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                    <Text style={s.registeredText}>{t('browseTournaments.registered_badge')}</Text>
                  </View>
                ) : isFull && isOpen ? (
                  <View style={s.fullBadge}>
                    <Text style={s.fullText}>{t('browseTournaments.full_badge')}</Text>
                  </View>
                ) : null}
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
  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textMuted },
  card: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: 18, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardName: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, flex: 1, marginRight: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  infoItem: { alignItems: 'center', gap: 2 },
  infoValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  infoLabel: { fontSize: 10, color: colors.textMuted },
  progressSection: { marginBottom: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  progressCount: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  progressTrack: { height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  spotsText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1F4C8F', paddingVertical: 12, borderRadius: borderRadius.md },
  registerBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  registeredBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: '#22c55e15', borderRadius: borderRadius.md },
  registeredText: { fontSize: 14, fontWeight: '600', color: '#22c55e' },
  fullBadge: { alignItems: 'center', paddingVertical: 10, backgroundColor: '#ef444415', borderRadius: borderRadius.md },
  fullText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
});
