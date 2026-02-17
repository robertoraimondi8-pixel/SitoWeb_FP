import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

// Design System
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { StatusBadge, PrimaryButton } from '../../src/components/ui';

const MARKETS = [
  { key: '1X2', label: '1X2', pts: '1 pt' },
  { key: 'GOAL_NOGOL', label: 'GNG', pts: '0.5 pt' },
  { key: 'OVER_UNDER_25', label: 'O/U', pts: '0.5 pt' },
  { key: 'EXACT_SCORE', label: 'ES', pts: '4 pt' },
];

const VALUE_OPTIONS: Record<string, string[]> = {
  '1X2': ['1', 'X', '2'],
  'GOAL_NOGOL': ['GOAL', 'NOGOL'],
  'OVER_UNDER_25': ['OVER', 'UNDER'],
};

interface MatchPred {
  matchId: string;
  market: string;
  value: string;
  exactHome: string;
  exactAway: string;
}

interface JokerState {
  is_active: boolean;
  is_locked: boolean;
  used_other_matchday: boolean;
  half: number;
}

export default function PredictionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, handleAuthError } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preds, setPreds] = useState<Record<string, MatchPred>>({});
  const [joker, setJoker] = useState<JokerState>({ is_active: false, is_locked: false, used_other_matchday: false, half: 1 });
  const [jokerLoading, setJokerLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const home = await apiCall('/home', { token });
      if (!home.matchday) { setLoading(false); return; }
      const res = await apiCall(`/predictions/${home.matchday.id}`, { token });
      setData(res);

      if (res.joker) {
        setJoker({
          is_active: res.joker.is_active || false,
          is_locked: res.joker.is_locked || false,
          used_other_matchday: res.joker.used_other_matchday || false,
          half: res.joker.half || 1,
        });
      }

      const predMap: Record<string, MatchPred> = {};
      res.predictions?.forEach((p: any) => {
        const mid = p.match.id;
        if (p.prediction) {
          const mt = p.prediction.market_type || p.match.market_type || '1X2';
          const val = p.prediction.prediction_value;
          let eh = '', ea = '';
          if (mt === 'EXACT_SCORE' && val.includes('-')) {
            const parts = val.split('-');
            eh = parts[0]; ea = parts[1];
          }
          predMap[mid] = { matchId: mid, market: mt, value: val, exactHome: eh, exactAway: ea };
        }
      });
      setPreds(predMap);
    } catch (e: any) { 
      if (isAuthError(e)) {
        await handleAuthError(e);
        router.replace('/(auth)/login');
        return;
      }
      console.error(e); 
    }
    finally { setLoading(false); }
  }, [token, handleAuthError, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setMarket = (matchId: string, market: string) => {
    setPreds(prev => ({
      ...prev,
      [matchId]: { matchId, market, value: '', exactHome: '', exactAway: '' },
    }));
    setSaved(false);
  };

  const setValue = (matchId: string, value: string) => {
    setPreds(prev => {
      const cur = prev[matchId];
      if (!cur) return prev;
      return { ...prev, [matchId]: { ...cur, value } };
    });
    setSaved(false);
  };

  const setExact = (matchId: string, side: 'home' | 'away', val: string) => {
    setPreds(prev => {
      const cur = prev[matchId] || { matchId, market: 'EXACT_SCORE', value: '', exactHome: '', exactAway: '' };
      const updated = { ...cur, [side === 'home' ? 'exactHome' : 'exactAway']: val };
      if (updated.exactHome !== '' && updated.exactAway !== '') {
        updated.value = `${updated.exactHome}-${updated.exactAway}`;
      }
      return { ...prev, [matchId]: updated };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!data?.matchday) return;
    setSaving(true);
    setSaved(false);
    try {
      const predictions = Object.values(preds)
        .filter(p => p.value)
        .map(p => ({ match_id: p.matchId, market_type: p.market, prediction_value: p.value }));

      if (predictions.length === 0) {
        Alert.alert(t('error'), 'Inserisci almeno un pronostico');
        setSaving(false);
        return;
      }

      const res = await apiCall(`/predictions/${data.matchday.id}`, {
        method: 'POST', token, body: { predictions },
      });

      if (res.errors?.length > 0) {
        const lockErrors = res.errors.filter((e: any) => e.error.includes('locked'));
        if (lockErrors.length > 0) {
          Alert.alert('Info', `${res.saved_count} salvati. ${lockErrors.length} match già iniziati.`);
        }
      }
      setSaved(true);
    } catch (e: any) { Alert.alert(t('error'), e.message); }
    finally { setSaving(false); }
  };

  const handleJollyToggle = async () => {
    if (!data?.matchday) return;
    if (joker.is_locked) {
      Alert.alert(t('error'), 'Jolly bloccato - tempo scaduto');
      return;
    }
    if (joker.used_other_matchday) {
      Alert.alert(t('error'), `Jolly già usato in un'altra giornata (${joker.half === 1 ? 'Andata' : 'Ritorno'})`);
      return;
    }

    setJokerLoading(true);
    try {
      if (joker.is_active) {
        await apiCall(`/predictions/${data.matchday.id}/joker`, { method: 'DELETE', token });
        setJoker(prev => ({ ...prev, is_active: false }));
      } else {
        await apiCall(`/predictions/${data.matchday.id}/joker`, { method: 'POST', token });
        setJoker(prev => ({ ...prev, is_active: true }));
      }
    } catch (e: any) { 
      Alert.alert(t('error'), e.message); 
    }
    finally { setJokerLoading(false); }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!data?.matchday) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>{t('no_data')}</Text>
      </View>
    );
  }

  const predCount = Object.values(preds).filter(p => p.value).length;
  const totalMatches = data.predictions?.length || 0;
  
  // Get status info
  const matchdayStatus = data.matchday?.status || 'OPEN';
  const isOpen = matchdayStatus === 'OPEN';
  const isLocked = matchdayStatus === 'LOCKED';
  const isCompleted = matchdayStatus === 'COMPLETED';
  
  // Status label based on matchday status
  const getStatusLabel = () => {
    switch (matchdayStatus) {
      case 'OPEN': return 'Giornata Aperta';
      case 'LOCKED': return 'Giornata Chiusa';
      case 'COMPLETED': return 'Giornata Completata';
      case 'LIVE': return 'Giornata Live';
      default: return matchdayStatus;
    }
  };
  
  // Format match datetime
  const formatMatchTime = (startTime: string | null) => {
    if (!startTime) return null;
    try {
      const date = new Date(startTime);
      const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
      const day = days[date.getDay()];
      const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      return `${day} ${time}`;
    } catch {
      return null;
    }
  };

  const jollyDisabled = joker.is_locked || joker.used_other_matchday || isCompleted;
  const jollyStatusText = joker.is_locked 
    ? 'BLOCCATO' 
    : joker.used_other_matchday 
      ? `USATO (${joker.half === 1 ? 'And.' : 'Rit.'})` 
      : joker.is_active 
        ? 'ATTIVO x2' 
        : 'Attiva Jolly';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            {data.matchday.label || `${t('matchday')} ${data.matchday.number}`}
          </Text>
          <Text style={styles.predCounter}>{predCount}/{totalMatches} {t('matches')}</Text>
        </View>
        <StatusBadge status={matchdayStatus} label={getStatusLabel()} />
      </View>

      {/* Jolly Banner */}
      <View style={[
        styles.jollyContainer, 
        joker.is_active && styles.jollyContainerActive
      ]}>
        <View style={styles.jollyInfo}>
          <View style={[styles.jollyIcon, joker.is_active && styles.jollyIconActive]}>
            <Ionicons name="star" size={20} color={joker.is_active ? colors.textInverse : colors.accent} />
          </View>
          <View style={styles.jollyTextContainer}>
            <Text style={[styles.jollyTitle, joker.is_active && styles.jollyTitleActive]}>
              JOLLY GIORNATA
            </Text>
            <Text style={styles.jollySubtitle}>
              {joker.half === 1 ? 'Andata' : 'Ritorno'} • Raddoppia tutti i punti
            </Text>
          </View>
        </View>
        <TouchableOpacity
          testID="jolly-matchday-toggle"
          onPress={handleJollyToggle}
          disabled={jollyDisabled || jokerLoading}
          style={[
            styles.jollyToggleBtn,
            joker.is_active && styles.jollyToggleBtnActive,
            jollyDisabled && styles.jollyToggleBtnDisabled,
          ]}
        >
          {jokerLoading ? (
            <ActivityIndicator size="small" color={joker.is_active ? colors.accent : colors.textSecondary} />
          ) : (
            <>
              {joker.is_locked && <Ionicons name="lock-closed" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />}
              <Text style={[
                styles.jollyToggleText, 
                joker.is_active && styles.jollyToggleTextActive,
                jollyDisabled && styles.jollyToggleTextDisabled,
              ]}>
                {jollyStatusText}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {data.predictions?.map((item: any, idx: number) => {
            const m = item.match;
            const isLocked = item.is_locked;
            const pred = preds[m.id];
            const selectedMarket = pred?.market || '';
            const selectedValue = pred?.value || '';

            return (
              <View
                key={m.id}
                testID={`match-card-${idx}`}
                style={[
                  styles.matchCard,
                  isLocked && styles.matchCardLocked,
                ]}
              >
                {/* Match Header */}
                <View style={styles.matchHeader}>
                  <View style={styles.matchNumBadge}>
                    <Text style={styles.matchNum}>{idx + 1}</Text>
                  </View>
                  <View style={styles.matchMeta}>
                    <Text style={styles.competition}>{m.competition}</Text>
                    {m.start_time && (
                      <Text style={styles.matchTime}>{formatMatchTime(m.start_time)}</Text>
                    )}
                  </View>
                  {item.is_locked && (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={12} color={colors.error} />
                      <Text style={styles.lockText}>LOCKED</Text>
                    </View>
                  )}
                </View>

                {/* Teams */}
                <View style={styles.teamsRow}>
                  <Text style={styles.teamName}>{m.home_team}</Text>
                  <View style={styles.vsContainer}>
                    <Text style={styles.vs}>vs</Text>
                  </View>
                  <Text style={styles.teamName}>{m.away_team}</Text>
                </View>

                {isLocked ? (
                  <View style={styles.lockedArea}>
                    {selectedValue ? (
                      <View style={styles.lockedPredContainer}>
                        <View style={styles.lockedMarketBadge}>
                          <Text style={styles.lockedMarketText}>{selectedMarket.replace('_', '/')}</Text>
                        </View>
                        <Text style={styles.lockedPredValue}>{selectedValue}</Text>
                      </View>
                    ) : (
                      <Text style={styles.lockedEmpty}>{t('no_predictions')}</Text>
                    )}
                  </View>
                ) : (
                  <>
                    {/* Market Selector */}
                    <View style={styles.marketRow}>
                      {MARKETS.map(mk => (
                        <TouchableOpacity
                          key={mk.key}
                          testID={`market-${idx}-${mk.key}`}
                          onPress={() => setMarket(m.id, mk.key)}
                          style={[
                            styles.marketPill,
                            selectedMarket === mk.key && styles.marketPillActive,
                          ]}
                        >
                          <Text style={[
                            styles.marketLabel, 
                            selectedMarket === mk.key && styles.marketLabelActive
                          ]}>
                            {mk.label}
                          </Text>
                          <Text style={[
                            styles.marketPts, 
                            selectedMarket === mk.key && styles.marketPtsActive
                          ]}>
                            {mk.pts}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Value Input */}
                    {selectedMarket && selectedMarket !== 'EXACT_SCORE' && (
                      <View style={styles.valueRow}>
                        {VALUE_OPTIONS[selectedMarket]?.map(opt => (
                          <TouchableOpacity
                            key={opt}
                            testID={`value-${idx}-${opt}`}
                            onPress={() => setValue(m.id, opt)}
                            style={[
                              styles.valueBtn,
                              selectedValue === opt && styles.valueBtnActive,
                            ]}
                          >
                            <Text style={[
                              styles.valueBtnText, 
                              selectedValue === opt && styles.valueBtnTextActive
                            ]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {selectedMarket === 'EXACT_SCORE' && (
                      <View style={styles.exactRow}>
                        <TextInput
                          testID={`exact-home-${idx}`}
                          style={styles.exactInput}
                          keyboardType="numeric" 
                          maxLength={2}
                          value={pred?.exactHome || ''}
                          onChangeText={v => setExact(m.id, 'home', v.replace(/[^0-9]/g, ''))}
                          placeholder="0" 
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.exactDash}>-</Text>
                        <TextInput
                          testID={`exact-away-${idx}`}
                          style={styles.exactInput}
                          keyboardType="numeric" 
                          maxLength={2}
                          value={pred?.exactAway || ''}
                          onChangeText={v => setExact(m.id, 'away', v.replace(/[^0-9]/g, ''))}
                          placeholder="0" 
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        {saved && (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.savedText}>{t('save_success')}</Text>
          </View>
        )}
        <PrimaryButton
          title={t('save_predictions')}
          icon="checkmark-circle"
          onPress={handleSave}
          loading={saving}
          style={styles.saveBtn}
        />
      </View>
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
    gap: spacing.lg,
  },
  emptyText: {
    ...typography.bodyM,
    color: colors.textSecondary,
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLeft: {},
  headerTitle: { 
    ...typography.titleL,
    color: colors.textPrimary,
  },
  predCounter: { 
    ...typography.meta,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  
  // Jolly
  jollyContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg, 
    marginTop: spacing.lg,
    padding: spacing.lg, 
    borderRadius: borderRadius.lg, 
    backgroundColor: colors.card,
    ...shadows.card,
  },
  jollyContainerActive: {
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  jollyInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.md, 
    flex: 1,
  },
  jollyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jollyIconActive: {
    backgroundColor: colors.accent,
  },
  jollyTextContainer: { flex: 1 },
  jollyTitle: { 
    ...typography.meta,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  jollyTitleActive: {
    color: colors.accent,
  },
  jollySubtitle: { 
    ...typography.metaSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  jollyToggleBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.md, 
    backgroundColor: colors.background,
  },
  jollyToggleBtnActive: {
    backgroundColor: colors.accent,
  },
  jollyToggleBtnDisabled: {
    backgroundColor: colors.border,
  },
  jollyToggleText: { 
    ...typography.meta,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  jollyToggleTextActive: {
    color: colors.textInverse,
  },
  jollyToggleTextDisabled: {
    color: colors.textMuted,
  },
  
  // Scroll
  scrollContent: { 
    padding: spacing.lg, 
    paddingBottom: 140,
  },
  
  // Match Card
  matchCard: { 
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl, 
    padding: spacing.lg, 
    marginBottom: spacing.md, 
    ...shadows.card,
  },
  matchCardLocked: {
    opacity: 0.75,
  },
  matchHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.sm, 
    marginBottom: spacing.md,
  },
  matchNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchNum: { 
    ...typography.metaSmall,
    color: colors.textInverse,
    fontWeight: '800',
  },
  matchMeta: {
    flex: 1,
  },
  competition: { 
    ...typography.metaSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchTime: {
    ...typography.metaSmall,
    color: colors.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  lockBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.xs, 
    paddingHorizontal: spacing.sm, 
    paddingVertical: spacing.xs, 
    borderRadius: borderRadius.sm,
    backgroundColor: colors.errorLight,
  },
  lockText: { 
    ...typography.metaSmall,
    color: colors.error,
    fontWeight: '700',
  },
  
  teamsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: spacing.md, 
    marginBottom: spacing.lg,
  },
  teamName: { 
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1, 
    textAlign: 'center',
  },
  vsContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vs: { 
    ...typography.metaSmall,
    color: colors.textMuted,
  },
  
  lockedArea: { 
    padding: spacing.lg, 
    borderRadius: borderRadius.md, 
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  lockedPredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  lockedMarketBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.infoLight,
  },
  lockedMarketText: {
    ...typography.metaSmall,
    color: colors.info,
    fontWeight: '600',
  },
  lockedPredValue: { 
    ...typography.statMedium,
    color: colors.accent,
  },
  lockedEmpty: { 
    ...typography.bodyS,
    color: colors.textMuted,
  },
  
  marketRow: { 
    flexDirection: 'row', 
    gap: spacing.sm, 
    marginBottom: spacing.md,
  },
  marketPill: { 
    flex: 1, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.md, 
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  marketPillActive: {
    backgroundColor: colors.accent,
  },
  marketLabel: { 
    ...typography.meta,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  marketLabelActive: {
    color: colors.textInverse,
  },
  marketPts: { 
    ...typography.metaSmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  marketPtsActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  
  valueRow: { 
    flexDirection: 'row', 
    gap: spacing.sm,
  },
  valueBtn: { 
    flex: 1, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.md, 
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  valueBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  valueBtnText: { 
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  valueBtnTextActive: {
    color: colors.textInverse,
  },
  
  exactRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: spacing.lg,
  },
  exactInput: { 
    width: 64, 
    height: 56, 
    borderRadius: borderRadius.md, 
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    textAlign: 'center', 
    fontSize: 24, 
    fontWeight: '800',
    color: colors.textPrimary,
  },
  exactDash: { 
    fontSize: 28, 
    fontWeight: '300',
    color: colors.textMuted,
  },
  
  // Footer
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  savedBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.sm, 
    paddingVertical: spacing.sm, 
    paddingHorizontal: spacing.md, 
    borderRadius: borderRadius.sm, 
    backgroundColor: colors.successLight,
    marginBottom: spacing.md,
  },
  savedText: { 
    ...typography.meta,
    color: colors.success,
    fontWeight: '600',
  },
  saveBtn: {
    height: 52,
  },
});
