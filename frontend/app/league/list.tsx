import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Share, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/theme/designSystem';

export default function LeagueListScreen() {
  const { t } = useTranslation();
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
      <View style={s.center}>
        <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={['#F5F6F8', '#ECEFF3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('my_leagues')}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        {leagues.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="shield-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyText}>{t('no_leagues')}</Text>
            <TouchableOpacity
              testID="empty-create-btn"
              style={s.emptyBtn}
              onPress={() => router.push('/league/create')}
            >
              <Text style={s.emptyBtnText}>{t('create_league')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          leagues.map(league => {
            const isActive = activeLeague?.id === league.id;
            return (
              <TouchableOpacity
                key={league.id}
                testID={`league-item-${league.id}`}
                style={[s.leagueCard, isActive && s.leagueCardActive]}
                onPress={() => setActiveLeague(league)}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View style={[s.typeIcon, { backgroundColor: league.league_type === 'national' ? 'rgba(245,166,35,0.2)' : 'rgba(59,130,246,0.2)' }]}>
                    <Ionicons
                      name={league.league_type === 'national' ? 'globe' : 'shield'}
                      size={24}
                      color={league.league_type === 'national' ? colors.accent : colors.info}
                    />
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.leagueName}>{league.name}</Text>
                    <View style={s.metaRow}>
                      <Ionicons name="people" size={14} color="rgba(255,255,255,0.45)" />
                      <Text style={s.metaText}>{league.member_count} {t('members')}</Text>
                      <View style={[s.typeBadge, { backgroundColor: league.league_type === 'national' ? 'rgba(245,166,35,0.2)' : 'rgba(59,130,246,0.15)' }]}>
                        <Text style={[s.typeText, { color: league.league_type === 'national' ? colors.accent : colors.info }]}>
                          {league.league_type === 'national' ? t('national') : t('private')}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {isActive && (
                    <View style={s.activeBadge}>
                      <Text style={s.activeText}>{t('active')}</Text>
                    </View>
                  )}
                </View>

                {league.invite_code && (
                  <View style={s.codeRow}>
                    <View>
                      <Text style={s.codeLabel}>{t('invite_code')}</Text>
                      <Text style={s.codeValue}>{league.invite_code}</Text>
                    </View>
                    <TouchableOpacity
                      testID={`share-code-${league.id}`}
                      style={s.shareBtn}
                      onPress={() => shareCode(league.invite_code!, league.name)}
                    >
                      <Ionicons name="share-outline" size={16} color={colors.accent} />
                      <Text style={s.shareBtnText}>{t('share')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={s.bottom}>
        <TouchableOpacity
          testID="list-create-league-btn"
          style={s.actionBtnPrimary}
          onPress={() => router.push('/league/create')}
        >
          <Ionicons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={s.actionBtnPrimaryText}>{t('create_league')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="list-join-league-btn"
          style={s.actionBtnOutline}
          onPress={() => router.push('/league/join-private')}
        >
          <Ionicons name="enter" size={20} color={colors.accent} />
          <Text style={s.actionBtnOutlineText}>{t('join_league')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
    backgroundColor: '#F3F4F6',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.titleL, color: colors.textPrimary },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { ...typography.bodyM, color: colors.textSecondary },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: borderRadius.lg, marginTop: 8, backgroundColor: colors.accent },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  
  // League Card — Dark Navy
  leagueCard: { 
    backgroundColor: '#1F4C8F',
    borderRadius: borderRadius.xl, 
    borderWidth: 1.5, 
    borderColor: colors.accent,
    marginBottom: spacing.md, 
    overflow: 'hidden',
    shadowColor: '#162F5C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
  leagueCardActive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: 14 },
  typeIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  leagueName: { ...typography.bodyM, color: '#FFFFFF', fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...typography.meta, color: 'rgba(255,255,255,0.45)' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
  typeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.accent },
  activeText: { color: '#0F172A', fontSize: 11, fontWeight: '700' },
  codeRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, 
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  codeLabel: { ...typography.metaSmall, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  codeValue: { fontSize: 18, fontWeight: '800', letterSpacing: 2, color: colors.accent },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  shareBtnText: { ...typography.meta, color: colors.accent, fontWeight: '600' },
  
  // Bottom Actions
  bottom: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    flexDirection: 'row', gap: 10, padding: spacing.lg, 
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)',
  },
  actionBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: borderRadius.lg, backgroundColor: colors.accent },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  actionBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.accent },
  actionBtnOutlineText: { fontSize: 14, fontWeight: '700', color: colors.accent },
});
