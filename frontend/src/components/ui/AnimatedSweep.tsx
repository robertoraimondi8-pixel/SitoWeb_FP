import React, { useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  style?: ViewStyle;
  duration?: number;
}

export const AnimatedSweep = ({ duration = 4000 }: Props) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { transform: [{ translateX }], overflow: 'visible' },
      ]}
    >
      <LinearGradient
        colors={[
          'transparent',
          'rgba(255,255,255,0.13)',
          'rgba(255,255,255,0.06)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: -40,
          left: 0,
          width: 100,
          height: '180%',
          transform: [{ rotate: '-15deg' }],
        }}
      />
    </Animated.View>
  );
};
