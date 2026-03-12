import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/designSystem';

interface MatchdayPerformance {
  matchday_number: number;
  points: number;
}

interface LastFiveIndicatorProps {
  data: MatchdayPerformance[];
  label?: string;
  dark?: boolean;
}

const BAR_MAX_HEIGHT = 72;
const BAR_WIDTH = 20;

export const LastFiveIndicator: React.FC<LastFiveIndicatorProps> = ({ data, label, dark }) => {
  const maxPts = Math.max(...data.map(d => d.points), 1);
  const lastIdx = data.length - 1;
  const mutedColor = dark ? 'rgba(255,255,255,0.45)' : colors.textMuted;
  const primaryColor = dark ? '#FFFFFF' : colors.textPrimary;

  return (
    <View style={styles.container}>
      <View style={styles.chartRow}>
        {data.map((item, idx) => {
          const barH = Math.max(4, (item.points / maxPts) * BAR_MAX_HEIGHT);
          const isLatest = idx === lastIdx;
          return (
            <View key={idx} style={styles.barGroup}>
              <Text style={[styles.barValue, { color: isLatest ? colors.accent : mutedColor }]}>
                {Math.round(item.points).toString()}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      backgroundColor: isLatest ? colors.accent : (dark ? 'rgba(245,166,35,0.25)' : colors.accent + '38'),
                    },
                    isLatest && styles.barHighlight,
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, { color: isLatest ? primaryColor : mutedColor }, isLatest && { fontWeight: '700' }]}>
                {item.matchday_number}
              </Text>
            </View>
          );
        })}
      </View>
      {label && <Text style={[styles.hint, { color: mutedColor }]}>{label}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 20,
    minHeight: BAR_MAX_HEIGHT + 40,
  },
  barGroup: {
    alignItems: 'center',
    width: 36,
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 4,
    minHeight: 4,
  },
  barHighlight: {
    borderRadius: 5,
    width: BAR_WIDTH + 2,
  },
  barValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  barValueHighlight: {
    color: colors.accent,
    fontWeight: '700',
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 6,
  },
  barLabelHighlight: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  hint: {
    ...typography.metaSmall,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});

export default LastFiveIndicator;
