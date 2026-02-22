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
}

const BAR_MAX_HEIGHT = 72;
const BAR_WIDTH = 20;

export const LastFiveIndicator: React.FC<LastFiveIndicatorProps> = ({ data, label }) => {
  const maxPts = Math.max(...data.map(d => d.points), 1);
  const lastIdx = data.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.chartRow}>
        {data.map((item, idx) => {
          const barH = Math.max(4, (item.points / maxPts) * BAR_MAX_HEIGHT);
          const isLatest = idx === lastIdx;
          return (
            <View key={item.matchday_number} style={styles.barGroup}>
              {/* Points label above bar */}
              <Text style={[styles.barValue, isLatest && styles.barValueHighlight]}>
                {item.points.toFixed(1)}
              </Text>
              {/* Bar */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      backgroundColor: isLatest ? colors.accent : colors.accent + '38',
                    },
                    isLatest && styles.barHighlight,
                  ]}
                />
              </View>
              {/* Matchday number */}
              <Text style={[styles.barLabel, isLatest && styles.barLabelHighlight]}>
                {item.matchday_number}
              </Text>
            </View>
          );
        })}
      </View>
      {label && <Text style={styles.hint}>{label}</Text>}
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
