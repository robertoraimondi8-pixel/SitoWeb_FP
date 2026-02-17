import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/designSystem';

interface StatBlockProps {
  label: string;
  value: string | number;
  accent?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const StatBlock: React.FC<StatBlockProps> = ({
  label,
  value,
  accent = false,
  size = 'medium',
}) => {
  const getFontSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'medium': return 20;
      case 'large': return 24;
      default: return 20;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[
        styles.value,
        { fontSize: getFontSize() },
        accent && styles.accent,
      ]}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  label: {
    ...typography.metaSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  value: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  accent: {
    color: colors.accent,
  },
});

export default StatBlock;
