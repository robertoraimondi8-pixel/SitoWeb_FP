import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, typography, spacing, getStatusColor, getStatusBgColor } from '../../theme/designSystem';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'small' | 'medium';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'medium' }) => {
  const isLive = status?.toUpperCase() === 'LIVE';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isLive]);

  const backgroundColor = getStatusBgColor(status);
  const textColor = getStatusColor(status);
  const displayLabel = label || status;
  const isSmall = size === 'small';
  
  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall, { backgroundColor }]}>
      {isLive && (
        <Animated.View style={[styles.liveDot, { backgroundColor: textColor, opacity: pulseAnim }]} />
      )}
      <Text style={[styles.text, isSmall && styles.textSmall, { color: textColor }]}>{displayLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: spacing.xs,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  textSmall: {
    fontSize: 10,
  },
});

export default StatusBadge;
