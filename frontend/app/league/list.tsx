import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Share, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { Ionicons } from '@expo/vector-icons';

export default function LeagueListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { leagues, activeLeague, setActiveLeague, refreshLeagues, loading } = useLeague();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token) refreshLeagues(token);
  }, [token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (token) await refreshLeagues(token);
    setRefreshing(false);
  };

  const shareCode = async (code: string, name: string) => {
    try {
      await Share.share({
        message: `${t('league_share_message')} ${name}\n${t('invite_code')}: ${code}`,
      });
    } catch (e) { /* ignore */ }
  };

  if (loading && leagues.length === 0) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('my_leagues')}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        {leagues.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="shield-outline" size={48} color={colors.textSecondary} />
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>{t('no_leagues')}</Text>
            <TouchableOpacity
              testID="empty-create-btn"
              style={[s.emptyBtn, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/league/create')}
            >
              <Text style={[s.emptyBtnText, { color: colors.background }]}>{t('create_league')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          leagues.map(league => {
            const isActive = activeLeague?.id === league.id;
            return (
              <TouchableOpacity
                key={league.id}
                testID={`league-item-${league.id}`}
                style={[
                  s.leagueCard,
                  { backgroundColor: colors.card, borderColor: isActive ? colors.accent : colors.border },
                  isActive && { borderWidth: 2 },
                ]}
                onPress={() => setActiveLeague(league)}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View style={[s.typeIcon, { backgroundColor: league.league_type === 'national' ? 'rgba(245,166,35,0.15)' : 'rgba(59,130,246,0.12)' }]}>
                    <Ionicons
                      name={league.league_type === 'national' ? 'globe' : 'shield'}
                      size={24}
                      color={league.league_type === 'national' ? colors.accent : colors.info}
                    />
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={[s.leagueName, { color: colors.text }]}>{league.name}</Text>
                    <View style={s.metaRow}>
                      <Ionicons name="people" size={14} color={colors.textSecondary} />
                      <Text style={[s.metaText, { color: colors.textSecondary }]}>{league.member_count} {t('members')}</Text>
                      <View style={[s.typeBadge, { backgroundColor: league.league_type === 'national' ? 'rgba(245,166,35,0.12)' : 'rgba(59,130,246,0.08)' }]}>
                        <Text style={[s.typeText, { color: league.league_type === 'national' ? colors.accent : colors.info }]}>
                          {league.league_type === 'national' ? t('national') : t('private')}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {isActive && (
                    <View style={[s.activeBadge, { backgroundColor: colors.accent }]}>
                      <Text style={s.activeText}>{t('active')}</Text>
                    </View>
                  )}
                </View>

                {/* Invite code for private leagues */}
                {league.invite_code && (
                  <View style={[s.codeRow, { borderTopColor: colors.border }]}>
                    <View>
                      <Text style={[s.codeLabel, { color: colors.textSecondary }]}>{t('invite_code')}</Text>
                      <Text style={[s.codeValue, { color: colors.accent }]}>{league.invite_code}</Text>
                    </View>
                    <TouchableOpacity
                      testID={`share-code-${league.id}`}
                      style={[s.shareBtn, { borderColor: colors.accent }]}
                      onPress={() => shareCode(league.invite_code!, league.name)}
                    >
                      <Ionicons name="share-outline" size={16} color={colors.accent} />
                      <Text style={[s.shareBtnText, { color: colors.accent }]}>{t('share')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[s.bottom, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          testID="list-create-league-btn"
          style={[s.actionBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/league/create')}
        >
          <Ionicons name="add-circle" size={20} color={colors.background} />
          <Text style={[s.actionBtnText, { color: colors.background }]}>{t('create_league')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="list-join-league-btn"
          style={[s.actionBtn, { borderColor: colors.accent, borderWidth: 1, backgroundColor: 'transparent' }]}
          onPress={() => router.push('/league/join-private')}
        >
          <Ionicons name="enter" size={20} color={colors.accent} />
          <Text style={[s.actionBtnText, { color: colors.accent }]}>{t('join_league')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 120 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '500' },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },
  leagueCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  typeIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  leagueName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  typeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  activeText: { color: '#0F172A', fontSize: 11, fontWeight: '700' },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  codeLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  codeValue: { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  shareBtnText: { fontSize: 13, fontWeight: '600' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
});
