import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

const MARKET_LABELS: Record<string, string> = {
  '1X2': 'Esito finale (1X2)',
  'EXACT_SCORE': 'Risultato esatto',
  'BOTH': '1X2 + Risultato esatto',
};

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

          {/* Scoring Rules */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Punteggi</Text>
            <RuleRow label="Esito corretto (1X2)" value={`${sc.correct_outcome ?? 3} pts`} />
            <RuleRow label="Risultato esatto" value={`${sc.exact_score ?? 5} pts`} />
            <RuleRow label="Differenza gol corretta" value={`${sc.correct_goal_difference ?? 1} pts`} />
            <RuleRow label="Gol casa corretti" value={`${sc.correct_home_goals ?? 0.5} pts`} />
            <RuleRow label="Gol trasferta corretti" value={`${sc.correct_away_goals ?? 0.5} pts`} />
          </View>

          {/* League Settings */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Impostazioni Lega</Text>
            <RuleRow label="Tipo mercato" value={MARKET_LABELS[league.default_market_type] || league.default_market_type || '1X2'} />
            <RuleRow label="Giornata iniziale" value={league.start_matchday || 1} />
            <RuleRow label="Giornata finale" value={league.end_matchday || 38} />
            <RuleRow label="Regole bloccate" value={league.rules_locked ? 'Si' : 'No'} />
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
      <Text style={s.ruleValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  leagueName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  card: { backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.card },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  ruleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ruleLabel: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  ruleValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
});
