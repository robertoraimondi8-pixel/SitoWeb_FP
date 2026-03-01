import React, { useRef } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../theme/designSystem';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  icon,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  testID,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const getBg = () => {
    if (disabled) return colors.border;
    switch (variant) {
      case 'primary': return colors.accent;
      case 'secondary': return colors.primary;
      case 'danger': return colors.error;
      case 'outline': case 'ghost': return 'transparent';
      default: return colors.accent;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    if (variant === 'outline') return colors.primary;
    if (variant === 'ghost') return colors.textSecondary;
    return colors.textInverse;
  };

  const h = size === 'small' ? 40 : size === 'large' ? 52 : 48;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        testID={testID}
        style={[
          styles.button,
          { 
            backgroundColor: getBg(),
            height: h,
            borderWidth: variant === 'outline' ? 1.5 : 0,
            borderColor: variant === 'outline' ? colors.primary : undefined,
          },
          variant === 'primary' && !disabled && shadows.button,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator color={getTextColor()} size="small" />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={size === 'small' ? 16 : 20} color={getTextColor()} />}
            <Text style={[styles.text, { color: getTextColor(), fontSize: size === 'small' ? 13 : 15 }]}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    gap: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default PrimaryButton;
