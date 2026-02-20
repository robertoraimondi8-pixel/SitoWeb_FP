import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, getPerformanceColor } from '../../theme/designSystem';

interface MatchdayPerformance {
  matchday_number: number;
  points: number;
}

interface LastFiveIndicatorProps {
  data: MatchdayPerformance[];
}

export const LastFiveIndicator: React.FC<LastFiveIndicatorProps> = ({ data }) => {
  const formatPoints = (n: number) => n.toFixed(1);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {data.map((item) => (
          <View key={item.matchday_number} style={styles.item}>
            <View style={[
              styles.circle,
              { backgroundColor: getPerformanceColor(item.points) }
            ]}>
              <Text style={styles.circleText}>{item.matchday_number}</Text>
            </View>
            <Text style={styles.points}>{formatPoints(item.points)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>Punti per giornata</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'center',
  },
  item: {
    alignItems: 'center',
    width: 52,
    marginHorizontal: 8,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
  points: {
    ...typography.meta,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    fontWeight: '700',
  },
  hint: {
    ...typography.metaSmall,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});

export default LastFiveIndicator;
