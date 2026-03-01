import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

type ScoringItem = { enabled: boolean; points: number } | number;

function getPoints(val: ScoringItem | undefined): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val.enabled) return val.points;
  return null;
}

function isEnabled(val: ScoringItem | undefined): boolean {
  if (val == null) return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'object') return val.enabled;
  return false;
}

const SCORING_LABELS: { key: string; label: string }[] = [
  { key: '1x2', label: 'Esito corretto (1X2)' },
  { key: 'exact_score', label: 'Risultato esatto' },
  { key: 'over_under', label: 'Under/Over' },
  { key: 'goal_no_goal', label: 'Goal/NoGoal' },
];

export default function RulesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { activeLeague } = useLeague();
  const [league, setLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLeague || !token) return;
    (async () => {
      try {
        const data = await apiCall(`/leagues/${activeLeague.id}`, { token });
        setLeague(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLeague, token]);

  const sc = league?.scoring_config || {};

  const matchSourceLabel = () => {
    const type = league?.league_type || league?.match_source_type;
    if (type === 'national') return 'Lega Nazionale';
    return 'Partite personalizzate';
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Regolamento</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : league ? (
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.leagueName}>{league.name}</Text>

          {/* Scoring Rules — only show enabled ones */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Punteggi</Text>
            {SCORING_LABELS.map(({ key, label }) => {
              if (!isEnabled(sc[key])) return null;
              const pts = getPoints(sc[key]);
              return (
                <RuleRow key={key} label={label} value={`${pts} pts`} />
              );
            })}
          </View>

          {/* League Settings */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Impostazioni Lega</Text>
            <RuleRow label="Partite da pronosticare" value={matchSourceLabel()} />
            <RuleRow label="Giornata iniziale" value={league.start_matchday || 1} />
            <RuleRow label="Giornata finale" value={league.end_matchday || 38} />
          </View>
        </ScrollView>
      ) : (
        <Text style={s.empty}>Nessuna lega selezionata</Text>
      )}
    </SafeAreaView>
  );
}

function RuleRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.ruleRow}>
      <Text style={s.ruleLabel}>{label}</Text>
      <Text style={s.ruleValue}>{String(value)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  leagueName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  card: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  ruleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ruleLabel: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  ruleValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
});
