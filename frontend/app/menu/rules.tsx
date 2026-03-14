import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { useCompetition } from '../../src/contexts/CompetitionContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, brandGradients } from '../../src/theme/designSystem';

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

export default function RulesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { token } = useAuth();
  const { activeLeague } = useLeague();
  const { mode, tournamentId } = useCompetition();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isTournament = mode === 'tournament' && !!tournamentId;

  const SCORING_LABELS: { key: string; labelKey: string }[] = [
    { key: '1x2', labelKey: 'rules.scoring_1x2' },
    { key: 'exact_score', labelKey: 'rules.scoring_exact' },
    { key: 'over_under', labelKey: 'rules.scoring_over_under' },
    { key: 'goal_no_goal', labelKey: 'rules.scoring_gg_ng' },
  ];

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        if (isTournament) {
          setData(await apiCall(`/tournaments/${tournamentId}`, { token }));
        } else if (activeLeague) {
          setData(await apiCall(`/leagues/${activeLeague.id}`, { token }));
        }
      } catch (_) { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [activeLeague, tournamentId, isTournament, token]);

  const sc = isTournament
    ? (data?.scoring_config || { '1x2': { enabled: true, points: 2 }, exact_score: { enabled: true, points: 5 }, over_under: { enabled: true, points: 1 }, goal_no_goal: { enabled: true, points: 1 } })
    : (data?.scoring_config || {});

  const matchSourceLabel = () => {
    const type = data?.match_source_type || data?.league_type;
    if (type === 'national') return t('rules.source_national');
    if (type === 'api') return t('rules.source_api');
    if (type === 'manual' || type === 'custom') return t('rules.source_custom');
    return t('rules.source_default');
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('rules.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : data ? (
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.leagueName}>{data.name}</Text>

          {/* Scoring */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('rules.scoring')}</Text>
            {SCORING_LABELS.map(({ key, labelKey }) => {
              if (!isEnabled(sc[key])) return null;
              return <RuleRow key={key} label={t(labelKey)} value={`${getPoints(sc[key])} pts`} />;
            })}
          </View>

          {/* Settings */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{isTournament ? t('rules.tournament_settings') : t('rules.league_settings')}</Text>
            {isTournament ? (
              <>
                <RuleRow label={t('rules.tournament_type')} value={data.tournament_type === 'groups_knockout' ? t('rules.tournament_type_groups') : t('rules.tournament_type_knockout')} />
                <RuleRow label={t('rules.tournament_participants')} value={data.registered_count || data.max_participants || '-'} />
                {data.groups_count && (
                  <RuleRow label={t('rules.tournament_groups')} value={data.groups_count} />
                )}
              </>
            ) : (
              <>
                <RuleRow label={t('rules.match_source')} value={matchSourceLabel()} />
                <RuleRow label={t('rules.start_matchday')} value={data.start_matchday || 1} />
                <RuleRow label={t('rules.end_matchday')} value={data.end_matchday || 38} />
              </>
            )}
          </View>

          {/* Tiebreak - General */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('rules.tiebreak_title')}</Text>
            <Text style={s.tiebreakDesc}>{t('rules.tiebreak_desc')}</Text>
            <TiebreakItem num="1" text={t('rules.tiebreak_1')} />
            <TiebreakItem num="2" text={t('rules.tiebreak_2')} />
            <TiebreakItem num="3" text={t('rules.tiebreak_3')} />
            <TiebreakItem num="4" text={t('rules.tiebreak_4')} />
          </View>

          {/* Tiebreak - Knockout (tournament only) */}
          {isTournament && (
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('rules.tiebreak_knockout_title')}</Text>
              <Text style={s.tiebreakDesc}>{t('rules.tiebreak_knockout_desc')}</Text>
              <TiebreakItem num="1" text={t('rules.tiebreak_knockout_1')} />
              <TiebreakItem num="2" text={t('rules.tiebreak_knockout_2')} />
              <TiebreakItem num="3" text={t('rules.tiebreak_knockout_3')} />
              <TiebreakItem num="4" text={t('rules.tiebreak_knockout_4')} />
            </View>
          )}
        </ScrollView>
      ) : (
        <Text style={s.empty}>{t('rules.no_competition')}</Text>
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

function TiebreakItem({ num, text }: { num: string; text: string }) {
  return (
    <View style={s.tiebreakRow}>
      <View style={s.tiebreakBadge}><Text style={s.tiebreakBadgeText}>{num}</Text></View>
      <Text style={s.tiebreakText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  leagueName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  card: { backgroundColor: colors.primary, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.accent },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  ruleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  ruleLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', flex: 1 },
  ruleValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
  tiebreakDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19, marginBottom: 12 },
  tiebreakRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  tiebreakBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  tiebreakBadgeText: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  tiebreakText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', flex: 1 },
});
