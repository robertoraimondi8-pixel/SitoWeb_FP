import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { PredictionsData, Matchday, PredictionEntry, MatchItem, getErrorMessage } from '../../src/types/api';
import type { Href } from 'expo-router';

// Design System
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { StatusBadge, PrimaryButton } from '../../src/components/ui';

const ALL_MARKETS = [
  { key: '1X2',          configKey: '1x2',         label: '1X2', defaultPts: 1.0 },
  { key: 'GOAL_NOGOL',   configKey: 'goal_no_goal', label: 'GNG', defaultPts: 0.5 },
  { key: 'OVER_UNDER_25',configKey: 'over_under',   label: 'O/U', defaultPts: 0.5 },
  { key: 'EXACT_SCORE',  configKey: 'exact_score',  label: 'ES',  defaultPts: 4.0 },
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
  const { league_id: paramLeagueId, matchday_id: paramMatchdayId } = useLocalSearchParams<{ league_id?: string; matchday_id?: string }>();
  const [data, setData] = useState<PredictionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preds, setPreds] = useState<Record<string, MatchPred>>({});
  const [joker, setJoker] = useState<JokerState>({ is_active: false, is_locked: false, used_other_matchday: false, half: 1 });
  const [jokerLoading, setJokerLoading] = useState(false);
  // scoring_config dalla lega attiva (filtra mercati e punti)
  const [scoringConfig, setScoringConfig] = useState<Record<string, { enabled: boolean; points: number }> | null>(null);
  const [competitionName, setCompetitionName] = useState<string>('');
  // Info lega attiva per empty state
  const [leagueInfo, setLeagueInfo] = useState<{ id: string; isManual: boolean; isOwner: boolean } | null>(null);

  // Mercati visibili filtrati per scoring_config
  const MARKETS = scoringConfig
    ? ALL_MARKETS.filter(m => scoringConfig[m.configKey]?.enabled !== false).map(m => ({
        ...m,
        pts: `${scoringConfig[m.configKey]?.points ?? m.defaultPts} pt`,
      }))
    : ALL_MARKETS.map(m => ({ ...m, pts: `${m.defaultPts} pt` }));

  const fetchData = useCallback(async () => {
    try {
      const home = await apiCall('/home', { token });
      
      // === DIAGNOSTIC LOG 3: Frontend Predictions ===
      console.log('='.repeat(60));
      console.log('[DIAG-3] PREDICTIONS SCREEN');
      console.log('  home.league =', home.league);
      console.log('  home.league.id =', home.league?.id);
      console.log('  home.league.match_source_type =', home.league?.match_source_type);
      console.log('  home.league.is_owner =', home.league?.is_owner);
      console.log('  home.league.my_role =', home.league?.my_role);
      
      // Salva info lega per empty state
      const isManualLeague = home.league?.match_source_type === 'manual' || home.league?.match_source_type === 'custom';
      const isOwnerOrAdmin = home.league?.is_owner || ['owner', 'admin'].includes(home.league?.my_role);
      setLeagueInfo({
        id: home.league?.id || '',
        isManual: isManualLeague,
        isOwner: isOwnerOrAdmin,
      });
      
      if (!home.league?.id) { 
        console.log('  ERROR: No league.id, exiting');
        setLoading(false); 
        return; 
      }

      const leagueId = home.league.id;
      console.log('  Using leagueId =', leagueId);
      console.log('  paramMatchdayId =', paramMatchdayId);

      // Carica scoring_config dalla lega attiva
      try {
        const leagueDetail = await apiCall(`/leagues/${leagueId}`, { token });
        if (leagueDetail?.scoring_config) {
          setScoringConfig(leagueDetail.scoring_config);
        }
        if (leagueDetail?.competition_name) {
          setCompetitionName(leagueDetail.competition_name);
        } else {
          setCompetitionName(leagueDetail?.name || '');
        }
      } catch (_) { /* usa default se non disponibile */ }

      // PUNTO UNICO DI VERITÀ: usa /api/leagues/{league_id}/fixtures
      console.log('  Calling: /api/leagues/' + leagueId + '/fixtures');
      const fixturesRes = await apiCall(`/leagues/${leagueId}/fixtures`, { token });
      console.log('  fixturesRes.matchdays count =', fixturesRes.matchdays?.length);
      
      const matchdays = fixturesRes.matchdays || [];
      let activeMatchday = null;

      // Se passato matchday_id via route params, usalo direttamente
      if (paramMatchdayId) {
        activeMatchday = matchdays.find((md: Matchday) => md.id === paramMatchdayId);
        console.log('  Using paramMatchdayId:', paramMatchdayId, '-> found:', !!activeMatchday);
      }

      // Fallback: preferisci l'ultima OPEN per numero (la più recente),
      // poi LOCKED/LIVE più recente, poi l'ultima giornata
      if (!activeMatchday) {
        const openMatchdays = matchdays.filter((md: Matchday) => md.status === 'OPEN');
        if (openMatchdays.length > 0) {
          // Prendi quella con il numero più alto (la più recente)
          activeMatchday = openMatchdays.reduce((max: Matchday, md: Matchday) =>
            (md.number > max.number ? md : max), openMatchdays[0]);
        }
      }
      if (!activeMatchday) {
        const lockedLive = matchdays.filter((md: Matchday) => md.status === 'LOCKED' || md.status === 'LIVE');
        if (lockedLive.length > 0) {
          activeMatchday = lockedLive.reduce((max: Matchday, md: Matchday) =>
            (md.number > max.number ? md : max), lockedLive[0]);
        }
      }
      if (!activeMatchday && matchdays.length > 0) {
        activeMatchday = matchdays[matchdays.length - 1];
      }

      console.log('  activeMatchday =', activeMatchday?.id, activeMatchday?.label);
      console.log('  activeMatchday.matches count =', activeMatchday?.matches?.length);
      if (activeMatchday?.matches) {
        activeMatchday.matches.forEach((m: MatchItem, i: number) => {
          console.log(`    Match ${i}: ${m.home_team} vs ${m.away_team}, league_id=${m.league_id}`);
        });
      }

      if (!activeMatchday) {
        console.log('  ERROR: No activeMatchday found');
        setLoading(false);
        return;
      }

      // Carica predictions per questa giornata
      console.log('  Calling: /api/predictions/' + activeMatchday.id + '?league_id=' + leagueId);
      const predsRes = await apiCall(`/predictions/${activeMatchday.id}?league_id=${leagueId}`, { token });
      console.log('  predsRes.predictions count =', predsRes.predictions?.length);
      console.log('='.repeat(60));
      
      // Combina matchday info con matches dalla fixtures response
      const matchesForMatchday = activeMatchday.matches || [];
      
      setData({
        matchday: {
          ...activeMatchday,
          ...predsRes.matchday,
        },
        predictions: matchesForMatchday.map((m: MatchItem) => {
          const predForMatch = predsRes.predictions?.find((p: { match?: { id: string } }) => p.match?.id === m.id);
          return {
            match: m,
            prediction: predForMatch?.prediction || null,
            is_locked: predForMatch?.is_locked || false,
          };
        }),
        joker: predsRes.joker,
      });

      if (predsRes.joker) {
        setJoker({
          is_active: predsRes.joker.is_active || false,
          is_locked: predsRes.joker.is_locked || false,
          used_other_matchday: predsRes.joker.used_other_matchday || false,
          half: predsRes.joker.half || 1,
        });
      }

      const predMap: Record<string, MatchPred> = {};
      predsRes.predictions?.forEach((p: { match?: { id: string } }) => {
        const mid = p.match?.id;
        if (mid && p.prediction) {
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
    } catch (e: unknown) { 
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error(e); 
    }
    finally { setLoading(false); }
  }, [token, handleAuthError, router, paramMatchdayId]);

  // useFocusEffect: rifetch ogni volta che la schermata Pronostici ottiene il focus
  // (risolve lo stale state quando si naviga da Home dopo aver creato una nuova giornata)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setPreds({});
      fetchData();
    }, [fetchData])
  );

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

    // Validate completeness before saving
    const editableItems = data.predictions?.filter((item: PredictionEntry) => !item.is_locked) || [];
    const editableCount = editableItems.length;
    const completedCount = editableItems.filter((item: PredictionEntry) => {
      const pred = preds[item.match.id];
      return pred && pred.value;
    }).length;

    if (isOpen && completedCount < editableCount) {
      Alert.alert(
        t('predictions.title'),
        t('predictions.completed_of', { done: completedCount, total: editableCount })
      );
      return;
    }

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
        method: 'POST', token, body: { predictions, league_id: leagueInfo?.id },
      });

      if (res.errors?.length > 0) {
        const lockErrors = res.errors.filter((e: { error: string }) => e.error.includes('locked'));
        if (lockErrors.length > 0) {
          Alert.alert('Info', `${res.saved_count} salvati. ${lockErrors.length} match già iniziati.`);
        }
      }
      setSaved(true);
    } catch (e: unknown) { Alert.alert(t('error'), e.message); }
    finally { setSaving(false); }
  };

  const handleJollyToggle = async () => {
    if (!data?.matchday) return;
    if (joker.is_locked) {
      Alert.alert(t('error'), t('predictions.match_locked'));
      return;
    }
    if (joker.used_other_matchday) {
      Alert.alert(t('error'), `t('predictions.joker_already_used') (${joker.half === 1 ? 'Andata' : 'Ritorno'})`);
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
    } catch (e: unknown) { 
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { fontWeight: '700', fontSize: 16, textAlign: 'center' }]}>
            Nessuna giornata disponibile per questa lega
          </Text>
          {leagueInfo?.isOwner ? (
            <TouchableOpacity
              data-testid="crea-giornata-btn"
              style={[styles.saveBtn, { marginTop: 20, width: 240, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}
              onPress={() => router.push(`/league/${leagueInfo.id}/manage` as Href)}
            >
              <Text style={[styles.saveBtnText, { color: '#fff', fontWeight: '700' }]}>Crea la prima giornata</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }]}>
              Chiedi all'admin di creare una giornata
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const predCount = Object.values(preds).filter(p => p.value).length;
  const totalMatches = data.predictions?.length || 0;

  // Completamento pronostici: solo partite ancora modificabili (non locked individualmente)
  const editableItems = data.predictions?.filter((item: PredictionEntry) => !item.is_locked) || [];
  const editableCount = editableItems.length;
  const completedEditableCount = editableItems.filter((item: PredictionEntry) => {
    const pred = preds[item.match.id];
    return pred && pred.value;
  }).length;
  const allComplete = editableCount > 0 && completedEditableCount === editableCount;

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
        : t('predictions.set_joker');

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
          {/* Sort matches by start_time */}
          {[...(data.predictions || [])].sort((a: PredictionEntry, b: PredictionEntry) => {
            const ta = a.match?.start_time ? new Date(a.match.start_time).getTime() : 0;
            const tb = b.match?.start_time ? new Date(b.match.start_time).getTime() : 0;
            return ta - tb;
          }).map((item: PredictionEntry, idx: number) => {
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
                    <Text style={styles.competition}>{m.competition || m.league_name}</Text>
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
                  <View style={styles.teamWithLogo}>
                    {m.home_logo && <Image source={{ uri: m.home_logo }} style={styles.teamLogo} />}
                    <Text style={styles.teamName}>{m.home_team}</Text>
                  </View>
                  <View style={styles.vsContainer}>
                    <Text style={styles.vs}>vs</Text>
                  </View>
                  <View style={[styles.teamWithLogo, { justifyContent: 'flex-end' }]}>
                    <Text style={styles.teamName}>{m.away_team}</Text>
                    {m.away_logo && <Image source={{ uri: m.away_logo }} style={styles.teamLogo} />}
                  </View>
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

      {/* Footer - only show save when not completed */}
      {!isCompleted && (
        <View style={styles.footer}>
          {saved && (
            <View style={styles.savedBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.savedText}>{t('save_success')}</Text>
            </View>
          )}
          {/* Progress indicator: mostra completamento solo in modalità OPEN */}
          {isOpen && (
            <View style={styles.progressRow}>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: editableCount > 0
                        ? `${(completedEditableCount / editableCount) * 100}%` as string
                        : '0%',
                      backgroundColor: allComplete ? colors.success : colors.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressLabel, allComplete && styles.progressLabelComplete]}>
                {completedEditableCount}/{editableCount} partite
              </Text>
            </View>
          )}
          <PrimaryButton
            testID="confirm-predictions-btn"
            title={allComplete || !isOpen ? t('save_predictions') : `${t('predictions.save_button')}`}
            icon={allComplete || !isOpen ? 'checkmark-circle' : 'alert-circle'}
            onPress={handleSave}
            loading={saving}
            disabled={saving || (isOpen && !allComplete)}
            style={styles.saveBtn}
          />
        </View>
      )}
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
  teamWithLogo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
  // Progress bar
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    ...typography.meta,
    color: colors.textSecondary,
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'right',
  },
  progressLabelComplete: {
    color: colors.success,
  },
});
