import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { useTranslation } from 'react-i18next';

type FormMatch = {
  date: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  result: string;
  competition: string;
};

type H2HMatch = {
  date: string;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
};

type StandingPos = {
  rank: number;
  points: number;
  played: number;
};

type PreviewData = {
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  home_form: FormMatch[];
  away_form: FormMatch[];
  h2h: H2HMatch[];
  home_standing: StandingPos | null;
  away_standing: StandingPos | null;
};

interface Props {
  matchId: string;
  token: string;
  visible: boolean;
  onClose: () => void;
}

const RESULT_COLORS: Record<string, string> = {
  W: '#22c55e',
  D: '#f59e0b',
  L: '#ef4444',
};

export function MatchPreviewSheet({ matchId, token, visible, onClose }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && matchId) {
      setLoading(true);
      setError(null);
      setData(null);
      apiCall<PreviewData>(`/stats/match-preview/${matchId}`, { token })
        .then(setData)
        .catch(() => setError(t('matchPreview.not_available')))
        .finally(() => setLoading(false));
    }
  }, [visible, matchId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.sheet} onStartShouldSetResponder={() => true}>
          {/* Handle + Close */}
          <View style={s.sheetHeader}>
            <View style={s.handle} />
            <TouchableOpacity style={s.closeBtn} onPress={onClose} data-testid="match-preview-close">
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.loadingText}>{t('matchPreview.loading')}</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.textMuted} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : data ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
              {/* Title */}
              <View style={s.titleRow}>
                <View style={s.titleTeam}>
                  {data.home_logo && <Image source={{ uri: data.home_logo }} style={s.titleLogo} />}
                  <Text style={s.titleName} numberOfLines={1}>{data.home_team}</Text>
                </View>
                <Text style={s.titleVs}>vs</Text>
                <View style={[s.titleTeam, { justifyContent: 'flex-end' }]}>
                  <Text style={s.titleName} numberOfLines={1}>{data.away_team}</Text>
                  {data.away_logo && <Image source={{ uri: data.away_logo }} style={s.titleLogo} />}
                </View>
              </View>

              {/* Standings Position */}
              {(data.home_standing || data.away_standing) && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>{t('matchPreview.league_position')}</Text>
                  <View style={s.standingsRow}>
                    <StandingCard
                      team={data.home_team}
                      logo={data.home_logo}
                      standing={data.home_standing}
                    />
                    <StandingCard
                      team={data.away_team}
                      logo={data.away_logo}
                      standing={data.away_standing}
                    />
                  </View>
                </View>
              )}

              {/* Home Team Form */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('matchPreview.last_5')} - {data.home_team}</Text>
                <FormRow matches={data.home_form} />
              </View>

              {/* Away Team Form */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('matchPreview.last_5')} - {data.away_team}</Text>
                <FormRow matches={data.away_form} />
              </View>

              {/* Head to Head */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('matchPreview.head_to_head')}</Text>
                {data.h2h.length === 0 ? (
                  <Text style={s.emptyText}>{t('matchPreview.no_h2h')}</Text>
                ) : (
                  data.h2h.map((m, i) => (
                    <View key={i} style={s.h2hRow}>
                      <Text style={s.h2hTeam} numberOfLines={1}>{m.home_team}</Text>
                      <View style={s.h2hScore}>
                        <Text style={s.h2hScoreText}>
                          {m.home_goals ?? '-'} - {m.away_goals ?? '-'}
                        </Text>
                      </View>
                      <Text style={[s.h2hTeam, { textAlign: 'right' }]} numberOfLines={1}>{m.away_team}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

/* ── Standing Card ── */
function StandingCard({ team, logo, standing }: { team: string; logo: string | null; standing: StandingPos | null }) {
  if (!standing) {
    return (
      <View style={s.standingCard}>
        <Text style={s.standingNA}>N/D</Text>
      </View>
    );
  }
  return (
    <View style={s.standingCard}>
      <Text style={s.standingRank}>{standing.rank}°</Text>
      <Text style={s.standingPts}>{standing.points} pts</Text>
      <Text style={s.standingPlayed}>{standing.played}G</Text>
    </View>
  );
}

/* ── Form Row ── */
function FormRow({ matches }: { matches: FormMatch[] }) {
  if (matches.length === 0) {
    return <Text style={s.emptyText}>{t('matchPreview.no_data')}</Text>;
  }
  return (
    <View>
      {/* Result badges */}
      <View style={s.formBadges}>
        {matches.map((m, i) => (
          <View key={i} style={[s.formBadge, { backgroundColor: RESULT_COLORS[m.result] || colors.border }]}>
            <Text style={s.formBadgeText}>{m.result}</Text>
          </View>
        ))}
      </View>
      {/* Match details */}
      {matches.map((m, i) => (
        <View key={i} style={s.formMatchRow}>
          <Text style={s.formMatchTeams} numberOfLines={1}>
            {m.home_team} {m.home_goals}-{m.away_goals} {m.away_team}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ── Styles ── */
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 10,
    padding: 4,
  },
  center: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Title row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  titleTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  titleLogo: { width: 28, height: 28, borderRadius: 6 },
  titleName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  titleVs: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginHorizontal: 10,
  },

  // Section
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Standings
  standingsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  standingCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 12,
    alignItems: 'center',
    gap: 2,
    ...shadows.card,
  },
  standingRank: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  standingPts: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  standingPlayed: {
    fontSize: 12,
    color: colors.textMuted,
  },
  standingNA: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Form badges
  formBadges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  formBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  formMatchRow: {
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  formMatchTeams: {
    fontSize: 13,
    color: colors.textPrimary,
  },

  // H2H
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  h2hTeam: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  h2hScore: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  h2hScoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
