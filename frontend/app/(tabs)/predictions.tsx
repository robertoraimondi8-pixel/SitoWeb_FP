import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { TextInput } from 'react-native';

const MARKET_OPTIONS: Record<string, string[]> = {
  '1X2': ['1', 'X', '2'],
  'GOAL_NOGOL': ['GOAL', 'NOGOL'],
  'OVER_UNDER_25': ['OVER', 'UNDER'],
  'EXACT_SCORE': [],
};

export default function PredictionsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [exactScores, setExactScores] = useState<Record<string, { home: string; away: string }>>({});
  const [jokerMatchId, setJokerMatchId] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    try {
      const home = await apiCall('/home', { token });
      if (!home.matchday) { setLoading(false); return; }
      const res = await apiCall(`/predictions/${home.matchday.id}`, { token });
      setData(res);
      const sels: Record<string, string> = {};
      const exacts: Record<string, { home: string; away: string }> = {};
      res.predictions?.forEach((p: any) => {
        if (p.prediction) {
          sels[p.match.id] = p.prediction.prediction_value;
          if (p.match.market_type === 'EXACT_SCORE') {
            const parts = p.prediction.prediction_value.split('-');
            exacts[p.match.id] = { home: parts[0] || '', away: parts[1] || '' };
          }
        }
        if (p.is_joker) setJokerMatchId(p.match.id);
      });
      setSelections(sels);
      setExactScores(exacts);
      if (res.joker?.match_id) setJokerMatchId(res.joker.match_id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);

  const handleSelect = (matchId: string, value: string) => {
    setSelections(prev => ({ ...prev, [matchId]: value }));
  };

  const handleExact = (matchId: string, side: 'home' | 'away', val: string) => {
    setExactScores(prev => {
      const cur = prev[matchId] || { home: '', away: '' };
      const updated = { ...cur, [side]: val };
      if (updated.home && updated.away) {
        setSelections(s => ({ ...s, [matchId]: `${updated.home}-${updated.away}` }));
      }
      return { ...prev, [matchId]: updated };
    });
  };

  const handleSave = async () => {
    if (!data?.matchday) return;
    setSaving(true);
    try {
      const predictions = Object.entries(selections).map(([match_id, prediction_value]) => ({ match_id, prediction_value }));
      await apiCall(`/predictions/${data.matchday.id}`, { method: 'POST', token, body: { predictions } });
      Alert.alert(t('save_success'));
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
        await apiCall(`/predictions/${data.matchday.id}/joker`, { method: 'POST', token, body: { matchday_id: data.matchday.id, match_id: matchId } });
        setJokerMatchId(matchId);
      }
    } catch (e: any) { Alert.alert(t('error'), e.message); }
  };

  if (loading) return <View style={[s.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (!data?.matchday) return <View style={[s.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.textSecondary }}>{t('no_data')}</Text></View>;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>{data.matchday.label || `${t('matchday')} ${data.matchday.number}`}</Text>
        <View style={[s.badge, { backgroundColor: data.matchday.status === 'OPEN' ? colors.info : colors.warning }]}>
          <Text style={s.badgeText}>{data.matchday.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        {data.predictions?.map((item: any, idx: number) => {
          const m = item.match;
          const isLocked = item.is_locked;
          const isJoker = jokerMatchId === m.id;
          const selected = selections[m.id];

          return (
            <View key={m.id} testID={`match-card-${idx}`} style={[s.matchCard, { backgroundColor: colors.card, borderColor: isJoker ? colors.accent : colors.border, borderWidth: isJoker ? 2 : 1 }]}>
              <View style={s.matchHeader}>
                <Text style={[s.competition, { color: colors.textSecondary }]}>{m.competition}</Text>
                <Text style={[s.marketType, { color: colors.accent }]}>{m.market_type.replace('_', '/')}</Text>
              </View>

              <View style={s.teamsRow}>
                <Text style={[s.teamName, { color: colors.text }]}>{m.home_team}</Text>
                <Text style={[s.vs, { color: colors.textSecondary }]}>vs</Text>
                <Text style={[s.teamName, { color: colors.text }]}>{m.away_team}</Text>
              </View>

              {isLocked ? (
                <View style={[s.lockedBanner, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                  <Ionicons name="lock-closed" size={14} color={colors.error} />
                  <Text style={[s.lockedText, { color: colors.error }]}>{t('match_locked')}</Text>
                  {selected && <Text style={[s.lockedPred, { color: colors.text }]}>{selected}</Text>}
                </View>
              ) : m.market_type === 'EXACT_SCORE' ? (
                <View style={s.exactRow}>
                  <TextInput testID={`exact-home-${idx}`} style={[s.exactInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} keyboardType="numeric" maxLength={2} value={exactScores[m.id]?.home || ''} onChangeText={v => handleExact(m.id, 'home', v)} placeholder="0" placeholderTextColor={colors.textSecondary} />
                  <Text style={[s.exactDash, { color: colors.textSecondary }]}>-</Text>
                  <TextInput testID={`exact-away-${idx}`} style={[s.exactInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} keyboardType="numeric" maxLength={2} value={exactScores[m.id]?.away || ''} onChangeText={v => handleExact(m.id, 'away', v)} placeholder="0" placeholderTextColor={colors.textSecondary} />
                </View>
              ) : (
                <View style={s.optionsRow}>
                  {MARKET_OPTIONS[m.market_type]?.map(opt => (
                    <TouchableOpacity key={opt} testID={`pred-${idx}-${opt}`} onPress={() => handleSelect(m.id, opt)} style={[s.optionBtn, { borderColor: colors.border }, selected === opt && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                      <Text style={[s.optionText, { color: selected === opt ? colors.background : colors.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!isLocked && (
                <TouchableOpacity testID={`joker-${idx}`} onPress={() => handleJoker(m.id)} style={[s.jokerBtn, isJoker && { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
                  <Ionicons name="star" size={16} color={isJoker ? colors.accent : colors.textSecondary} />
                  <Text style={[s.jokerText, { color: isJoker ? colors.accent : colors.textSecondary }]}>{isJoker ? t('joker_active') : t('joker')}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[s.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity testID="save-predictions-btn" style={[s.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSave} disabled={saving}>
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
  headerTitle: { fontSize: 20, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  matchCard: { borderRadius: 14, padding: 14, marginBottom: 12 },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  competition: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  marketType: { fontSize: 11, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  teamName: { fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  vs: { fontSize: 12 },
  optionsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  optionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  optionText: { fontSize: 15, fontWeight: '700' },
  exactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  exactInput: { width: 56, height: 48, borderRadius: 10, borderWidth: 1, textAlign: 'center', fontSize: 20, fontWeight: '700' },
  exactDash: { fontSize: 24, fontWeight: '300' },
  lockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8 },
  lockedText: { fontSize: 12, fontWeight: '600' },
  lockedPred: { marginLeft: 'auto', fontSize: 14, fontWeight: '700' },
  jokerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
  jokerText: { fontSize: 12, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn: { flexDirection: 'row', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
