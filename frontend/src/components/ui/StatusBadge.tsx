import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, getStatusColor } from '../../theme/designSystem';

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const backgroundColor = getStatusColor(status);
  const displayLabel = label || status;
  
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      {status?.toUpperCase() === 'LIVE' && <View style={styles.liveDot} />}
      <Text style={styles.text}>{displayLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    gap: spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textInverse,
  },
  text: {
    ...typography.metaSmall,
    color: colors.textInverse,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

export default StatusBadge;
