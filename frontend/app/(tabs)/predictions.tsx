import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

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

export default function PredictionsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preds, setPreds] = useState<Record<string, MatchPred>>({});
  const [jokerMatchId, setJokerMatchId] = useState<string | null>(null);
  const [jokerLocked, setJokerLocked] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const home = await apiCall('/home', { token });
      if (!home.matchday) { setLoading(false); return; }
      const res = await apiCall(`/predictions/${home.matchday.id}`, { token });
      setData(res);

      // Check joker lock time
      if (res.matchday) {
        const kickoff = new Date(res.matchday.first_kickoff).getTime();
        const lockTime = kickoff - 60000;
        // We use the matchday status to determine lock - server controls this
        // But for UI hint we estimate from client time
        setJokerLocked(res.matchday.status !== 'OPEN' || Date.now() >= lockTime);
      }

      // Load existing predictions
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
        if (p.is_joker) setJokerMatchId(mid);
      });
      if (res.joker?.match_id) setJokerMatchId(res.joker.match_id);
      setPreds(predMap);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

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

  const handleJoker = async (matchId: string) => {
    if (!data?.matchday) return;
    try {
      if (jokerMatchId === matchId) {
        await apiCall(`/predictions/${data.matchday.id}/joker`, { method: 'DELETE', token });
        setJokerMatchId(null);
      } else {
        await apiCall(`/predictions/${data.matchday.id}/joker`, {
          method: 'POST', token,
          body: { matchday_id: data.matchday.id, match_id: matchId },
        });
        setJokerMatchId(matchId);
      }
    } catch (e: any) { Alert.alert(t('error'), e.message); }
  };

  if (loading) return <View style={[s.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (!data?.matchday) return <View style={[s.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.textSecondary }}>{t('no_data')}</Text></View>;

  const predCount = Object.values(preds).filter(p => p.value).length;
  const totalMatches = data.predictions?.length || 0;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.headerTitle, { color: colors.text }]}>{data.matchday.label || `${t('matchday')} ${data.matchday.number}`}</Text>
          <Text style={[s.predCounter, { color: colors.textSecondary }]}>{predCount}/{totalMatches} {t('matches')}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: data.matchday.status === 'OPEN' ? colors.info : colors.warning }]}>
          <Text style={s.statusText}>{data.matchday.status}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {data.predictions?.map((item: any, idx: number) => {
            const m = item.match;
            const isLocked = item.is_locked;
            const pred = preds[m.id];
            const selectedMarket = pred?.market || '';
            const selectedValue = pred?.value || '';
            const isJoker = jokerMatchId === m.id;

            return (
              <View
                key={m.id}
                testID={`match-card-${idx}`}
                style={[
                  s.matchCard,
                  { backgroundColor: colors.card, borderColor: isJoker ? colors.accent : colors.border },
                  isJoker && { borderWidth: 2 },
                  isLocked && { opacity: 0.7 },
                ]}
              >
                {/* Match Header */}
                <View style={s.matchHeader}>
                  <Text style={[s.matchNum, { color: colors.textSecondary }]}>{idx + 1}</Text>
                  <Text style={[s.competition, { color: colors.textSecondary }]}>{m.competition}</Text>
                  {isLocked && (
                    <View style={[s.lockBadge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                      <Ionicons name="lock-closed" size={12} color={colors.error} />
                      <Text style={[s.lockText, { color: colors.error }]}>LOCKED</Text>
                    </View>
                  )}
                  {isJoker && (
                    <View style={[s.jokerBadge, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
                      <Ionicons name="star" size={12} color={colors.accent} />
                      <Text style={[s.jokerBadgeText, { color: colors.accent }]}>JOLLY x2</Text>
                    </View>
                  )}
                </View>

                {/* Teams */}
                <View style={s.teamsRow}>
                  <Text style={[s.teamName, { color: colors.text }]}>{m.home_team}</Text>
                  <Text style={[s.vs, { color: colors.textSecondary }]}>vs</Text>
                  <Text style={[s.teamName, { color: colors.text }]}>{m.away_team}</Text>
                </View>

                {isLocked ? (
                  /* Locked state: show saved prediction if any */
                  <View style={[s.lockedArea, { backgroundColor: 'rgba(239,68,68,0.06)' }]}>
                    {selectedValue ? (
                      <Text style={[s.lockedPred, { color: colors.text }]}>
                        {selectedMarket.replace('_', '/')} → <Text style={{ fontWeight: '800', color: colors.accent }}>{selectedValue}</Text>
                      </Text>
                    ) : (
                      <Text style={[s.lockedEmpty, { color: colors.textSecondary }]}>{t('no_predictions')}</Text>
                    )}
                  </View>
                ) : (
                  <>
                    {/* Market Selector */}
                    <View style={s.marketRow}>
                      {MARKETS.map(mk => (
                        <TouchableOpacity
                          key={mk.key}
                          testID={`market-${idx}-${mk.key}`}
                          onPress={() => setMarket(m.id, mk.key)}
                          style={[
                            s.marketPill,
                            { borderColor: colors.border },
                            selectedMarket === mk.key && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                        >
                          <Text style={[s.marketLabel, { color: selectedMarket === mk.key ? colors.background : colors.text }]}>{mk.label}</Text>
                          <Text style={[s.marketPts, { color: selectedMarket === mk.key ? 'rgba(15,23,42,0.6)' : colors.textSecondary }]}>{mk.pts}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Value Input (based on selected market) */}
                    {selectedMarket && selectedMarket !== 'EXACT_SCORE' && (
                      <View style={s.valueRow}>
                        {VALUE_OPTIONS[selectedMarket]?.map(opt => (
                          <TouchableOpacity
                            key={opt}
                            testID={`value-${idx}-${opt}`}
                            onPress={() => setValue(m.id, opt)}
                            style={[
                              s.valueBtn,
                              { borderColor: colors.border, backgroundColor: colors.background },
                              selectedValue === opt && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                          >
                            <Text style={[s.valueBtnText, { color: selectedValue === opt ? '#fff' : colors.text }]}>{opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {selectedMarket === 'EXACT_SCORE' && (
                      <View style={s.exactRow}>
                        <TextInput
                          testID={`exact-home-${idx}`}
                          style={[s.exactInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          keyboardType="numeric" maxLength={2}
                          value={pred?.exactHome || ''}
                          onChangeText={v => setExact(m.id, 'home', v.replace(/[^0-9]/g, ''))}
                          placeholder="0" placeholderTextColor={colors.textSecondary}
                        />
                        <Text style={[s.exactDash, { color: colors.accent }]}>-</Text>
                        <TextInput
                          testID={`exact-away-${idx}`}
                          style={[s.exactInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          keyboardType="numeric" maxLength={2}
                          value={pred?.exactAway || ''}
                          onChangeText={v => setExact(m.id, 'away', v.replace(/[^0-9]/g, ''))}
                          placeholder="0" placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                    )}

                    {/* Joker Toggle */}
                    <TouchableOpacity
                      testID={`joker-${idx}`}
                      onPress={() => handleJoker(m.id)}
                      disabled={jokerLocked && !isJoker}
                      style={[
                        s.jokerToggle,
                        isJoker && { backgroundColor: 'rgba(245,166,35,0.12)' },
                        jokerLocked && !isJoker && { opacity: 0.4 },
                      ]}
                    >
                      <Ionicons name="star" size={16} color={isJoker ? colors.accent : colors.textSecondary} />
                      <Text style={[s.jokerToggleText, { color: isJoker ? colors.accent : colors.textSecondary }]}>
                        {isJoker ? t('joker_active') : t('joker')}
                      </Text>
                      {jokerLocked && !isJoker && (
                        <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={[s.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {saved && (
          <View style={[s.savedBanner, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[s.savedText, { color: colors.success }]}>{t('save_success')}</Text>
          </View>
        )}
        <TouchableOpacity
          testID="save-predictions-btn"
          style={[s.saveBtn, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={colors.background} /> : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={colors.background} />
              <Text style={[s.saveBtnText, { color: colors.background }]}>{t('save_predictions')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  predCounter: { fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 140 },
  matchCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  matchNum: { fontSize: 11, fontWeight: '700', width: 20, textAlign: 'center' },
  competition: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  lockText: { fontSize: 10, fontWeight: '700' },
  jokerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  jokerBadgeText: { fontSize: 10, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  teamName: { fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  vs: { fontSize: 12, fontWeight: '400' },
  lockedArea: { padding: 12, borderRadius: 10, alignItems: 'center' },
  lockedPred: { fontSize: 14 },
  lockedEmpty: { fontSize: 13 },
  marketRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  marketPill: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  marketLabel: { fontSize: 13, fontWeight: '700' },
  marketPts: { fontSize: 10, marginTop: 1 },
  valueRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  valueBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  valueBtnText: { fontSize: 15, fontWeight: '800' },
  exactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 4 },
  exactInput: { width: 60, height: 52, borderRadius: 12, borderWidth: 1.5, textAlign: 'center', fontSize: 22, fontWeight: '800' },
  exactDash: { fontSize: 28, fontWeight: '300' },
  jokerToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
  jokerToggleText: { fontSize: 12, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8 },
  savedText: { fontSize: 13, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
