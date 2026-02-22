import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, KeyboardAvoidingView, Platform,
  ActivityIndicator, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

const MATCHDAY_OPTIONS = Array.from({ length: 38 }, (_, i) => i + 1);
const DEADLINE_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60];

const DEFAULT_SCORING: Record<string, { enabled: boolean; points: number; label: string; desc: string }> = {
  '1x2':         { enabled: true,  points: 1.0,  label: '1X2',            desc: 'Risultato finale (1/X/2)' },
  'over_under':  { enabled: true,  points: 0.5,  label: 'Over/Under 2.5', desc: 'Totale goal superiore o inferiore a 2.5' },
  'goal_no_goal':{ enabled: true,  points: 0.5,  label: 'Goal/No Goal',   desc: 'Entrambe le squadre segnano (Goal) oppure almeno una non segna (No Goal).' },
  'exact_score': { enabled: true,  points: 4.0,  label: 'Risultato Esatto', desc: 'Punteggio finale preciso' },
};

export default function CreateLeagueScreen() {
  const { colors } = useTheme();
  const { token, handleAuthError } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();

  const [seasons, setSeasons]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [created, setCreated]     = useState<CreatedLeague | null>(null);
  const [error, setError]         = useState('');

  // Form fields
  const [name, setName]             = useState('');
  const [startMD, setStartMD]       = useState(1);
  const [endMD, setEndMD]           = useState(38);
  const [deadline, setDeadline]     = useState(0);
  const [sourceType, setSourceType] = useState<'national' | 'custom' | 'api'>('national');
  const [scoring, setScoring]       = useState(DEFAULT_SCORING);

  // Dropdown open state
  const [showStart, setShowStart]     = useState(false);
  const [showEnd, setShowEnd]         = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiCall('/leagues/seasons', { token }).then(setSeasons).catch(() => {});
  }, [token]);

  const toggleMarket = (key: string) => {
    setScoring(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  };

  const handleCreate = async () => {
    setError('');
    if (!name.trim() || name.trim().length < 3) { setError('Il nome deve avere almeno 3 caratteri'); return; }
    if (endMD < startMD) { setError('La giornata finale deve essere ≥ giornata iniziale'); return; }
    const seasonId = seasons[0]?.id;
    if (!seasonId) { setError('Nessuna stagione attiva trovata'); return; }

    const scoringConfig: Record<string, { enabled: boolean; points: number }> = {};
    Object.entries(scoring).forEach(([k, v]) => {
      scoringConfig[k] = { enabled: v.enabled, points: v.points };
    });

    setLoading(true);
    try {
      const res = await apiCall('/leagues', {
        method: 'POST',
        token,
        body: {
          name: name.trim(),
          season_id: seasonId,
          start_matchday: startMD,
          end_matchday: endMD,
          bet_deadline_minutes: deadline,
          match_source_type: sourceType,
          scoring_config: scoringConfig,
          include_championship_predictions: false,
        },
      });
      if (token) await refreshLeagues(token);
      setCreated(res);
    } catch (e: unknown) {
      if (isAuthError(e)) { const d = await handleAuthError(e); if (d) router.replace('/(auth)/login'); return; }
      setError(e.message || 'Errore nella creazione');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!created?.invite_code) return;
    try {
      await Share.share({
        message: `Unisciti alla mia lega FantaPronostic "${created.name}"!\nCodice invito: ${created.invite_code}`,
      });
    } catch (_) {}
  };

  const s = makeStyles(colors);

  // ── SUCCESS STATE ───────────────────────────────────────────────────────────
  if (created) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.successContent}>
          <View style={[s.successIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={[s.successTitle, { color: colors.text }]}>Lega Creata!</Text>
          <Text style={[s.successDesc, { color: colors.textSecondary }]}>
            Condividi il codice con i tuoi amici per invitarli.
          </Text>

          <View style={[s.codeCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
            <Text style={[s.codeLabel, { color: colors.textSecondary }]}>CODICE INVITO</Text>
            <Text style={[s.codeValue, { color: colors.accent }]}>{created.invite_code}</Text>
          </View>

          <View style={[s.rulesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.rulesTitle, { color: colors.text }]}>Regole configurate</Text>
            <Text style={[s.rulesRow, { color: colors.textSecondary }]}>📅 Giornate: {created.start_matchday} → {created.end_matchday}</Text>
            <Text style={[s.rulesRow, { color: colors.textSecondary }]}>⏱ Termine giocata: {created.bet_deadline_minutes} min prima</Text>
            <Text style={[s.rulesRow, { color: colors.textSecondary }]}>🎯 Partite: {created.match_source_type === 'national' ? 'Lega Nazionale' : 'Scelte dal creatore'}</Text>
          </View>

          <TouchableOpacity style={[s.shareBtn, { backgroundColor: colors.accent }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={colors.background} />
            <Text style={[s.shareBtnText, { color: colors.background }]}>Condividi codice</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.homeBtn, { borderColor: colors.border }]} onPress={() => router.replace('/(tabs)/home')}>
            <Text style={[s.homeBtnText, { color: colors.text }]}>Vai alla Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── FORM ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Crea Nuova Lega</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Nome */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>NOME LEGA *</Text>
          <View style={[s.inputWrap, { borderColor: name.length >= 3 ? colors.accent : colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="create-outline" size={18} color={colors.accent} />
            <TextInput
              style={[s.input, { color: colors.text }]}
              placeholder="Es. Champions Friends"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              maxLength={40}
            />
            <Text style={[s.charCount, { color: colors.textSecondary }]}>{name.length}/40</Text>
          </View>

          {/* Giornate */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>GIORNATE</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.text }]}>Inizio</Text>
              <TouchableOpacity
                style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowStart(!showStart); setShowEnd(false); setShowDeadline(false); }}
              >
                <Text style={[s.dropdownText, { color: colors.text }]}>Giornata {startMD}</Text>
                <Ionicons name={showStart ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              {showStart && (
                <ScrollView style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]} nestedScrollEnabled>
                  {MATCHDAY_OPTIONS.map(n => (
                    <TouchableOpacity key={n} style={[s.dropdownItem, startMD === n && { backgroundColor: colors.accent + '22' }]}
                      onPress={() => { setStartMD(n); setShowStart(false); if (endMD < n) setEndMD(n); }}>
                      <Text style={[s.dropdownItemText, { color: startMD === n ? colors.accent : colors.text }]}>Giornata {n}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.text }]}>Fine</Text>
              <TouchableOpacity
                style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowEnd(!showEnd); setShowStart(false); setShowDeadline(false); }}
              >
                <Text style={[s.dropdownText, { color: colors.text }]}>Giornata {endMD}</Text>
                <Ionicons name={showEnd ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              {showEnd && (
                <ScrollView style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]} nestedScrollEnabled>
                  {MATCHDAY_OPTIONS.filter(n => n >= startMD).map(n => (
                    <TouchableOpacity key={n} style={[s.dropdownItem, endMD === n && { backgroundColor: colors.accent + '22' }]}
                      onPress={() => { setEndMD(n); setShowEnd(false); }}>
                      <Text style={[s.dropdownItemText, { color: endMD === n ? colors.accent : colors.text }]}>Giornata {n}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>

          {/* Deadline */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>TERMINE ULTIMO GIOCATA</Text>
          <TouchableOpacity
            style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { setShowDeadline(!showDeadline); setShowStart(false); setShowEnd(false); }}
          >
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <Text style={[s.dropdownText, { color: colors.text }]}>
              {deadline === 0 ? 'Nessun limite (fino al fischio)' : `${deadline} minuti prima del fischio`}
            </Text>
            <Ionicons name={showDeadline ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {showDeadline && (
            <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {DEADLINE_OPTIONS.map(d => (
                <TouchableOpacity key={d} style={[s.dropdownItem, deadline === d && { backgroundColor: colors.accent + '22' }]}
                  onPress={() => { setDeadline(d); setShowDeadline(false); }}>
                  <Text style={[s.dropdownItemText, { color: deadline === d ? colors.accent : colors.text }]}>
                    {d === 0 ? 'Nessun limite' : `${d} minuti prima`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Source Type */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>PARTITE DA PRONOSTICARE</Text>
          <View style={s.row}>
            {(['national', 'api', 'custom'] as const).map(type => {
              const config = {
                national: { icon: 'flag-outline' as const, label: 'Lega Nazionale', desc: 'Partite uguali alla Lega Nazionale' },
                api: { icon: 'football-outline' as const, label: 'Partite da API', desc: 'Importa partite reali da API Football' },
                custom: { icon: 'person-outline' as const, label: 'Scelte dal creatore', desc: 'Il creatore inserisce le partite manualmente' },
              };
              const c = config[type];
              return (
              <TouchableOpacity
                key={type}
                style={[s.sourceOption, { borderColor: sourceType === type ? colors.accent : colors.border, backgroundColor: sourceType === type ? colors.accent + '18' : colors.card }]}
                onPress={() => setSourceType(type)}
                data-testid={`source-type-${type}`}
              >
                <Ionicons name={c.icon} size={22} color={sourceType === type ? colors.accent : colors.textSecondary} />
                <Text style={[s.sourceLabel, { color: sourceType === type ? colors.accent : colors.text }]}>
                  {c.label}
                </Text>
                <Text style={[s.sourceDesc, { color: colors.textSecondary }]}>
                  {c.desc}
                </Text>
              </TouchableOpacity>
              );
            })}
          </View>

          {/* Scoring Config */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>SISTEMA PUNTI</Text>
          <View style={[s.scoringCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {Object.entries(scoring).map(([key, mkt]) => (
              <View key={key} style={s.marketRow}>
                <Switch
                  value={mkt.enabled}
                  onValueChange={() => toggleMarket(key)}
                  trackColor={{ false: colors.border, true: colors.accent + '88' }}
                  thumbColor={mkt.enabled ? colors.accent : colors.textSecondary}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.marketLabel, { color: mkt.enabled ? colors.text : colors.textSecondary }]}>{mkt.label}</Text>
                  <Text style={[s.marketDesc, { color: colors.textSecondary }]}>{mkt.desc}</Text>
                </View>
                <View style={[s.ptsBadge, { backgroundColor: mkt.enabled ? colors.accent + '18' : colors.border + '40', borderColor: mkt.enabled ? colors.accent + '55' : 'transparent' }]}>
                  <Text style={[s.ptsBadgeText, { color: mkt.enabled ? colors.accent : colors.textSecondary }]}>{mkt.points} pt</Text>
                </View>
              </View>
            ))}
          </View>

          {error ? <Text style={[s.errorText, { color: colors.error || '#EF4444' }]}>{error}</Text> : null}

          {/* Submit */}
          <TouchableOpacity
            testID="create-league-submit-btn"
            style={[s.btn, { backgroundColor: name.trim().length >= 3 ? colors.accent : colors.border }]}
            onPress={handleCreate}
            disabled={loading || name.trim().length < 3}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[s.btnText, { color: colors.background }]}>CREA LEGA</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: typeof import("../../src/theme/designSystem").colors) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 52, gap: 10, marginBottom: 4 },
  input: { flex: 1, fontSize: 16 },
  charCount: { fontSize: 11 },
  row: { flexDirection: 'row', marginBottom: 4 },
  dropdown: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, gap: 8, marginBottom: 4 },
  dropdownText: { flex: 1, fontSize: 15 },
  dropdownList: { borderWidth: 1, borderRadius: 12, marginBottom: 8, maxHeight: 200, overflow: 'scroll' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16 },
  dropdownItemText: { fontSize: 14, fontWeight: '500' },
  sourceOption: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  sourceLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  sourceDesc: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  scoringCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4, marginBottom: 4 },
  marketRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  marketLabel: { fontSize: 14, fontWeight: '600' },
  marketDesc: { fontSize: 11, marginTop: 2 },
  ptsBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  ptsBadgeText: { fontSize: 13, fontWeight: '700' },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 12, marginBottom: 4 },
  btn: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  // Success
  successContent: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
  successDesc: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  codeCard: { width: '100%', padding: 20, borderRadius: 16, borderWidth: 2, alignItems: 'center', marginBottom: 20 },
  codeLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  codeValue: { fontSize: 34, fontWeight: '900', letterSpacing: 4 },
  rulesCard: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, marginBottom: 20 },
  rulesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  rulesRow: { fontSize: 13 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 54, borderRadius: 14, marginBottom: 12 },
  shareBtnText: { fontSize: 16, fontWeight: '700' },
  homeBtn: { width: '100%', height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { fontSize: 15, fontWeight: '600' },
});
