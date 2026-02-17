import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/designSystem';

type LogoVariant = 'full' | 'wordmark';
type LogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
}

// Size mappings for height (width auto via aspectRatio)
const SIZE_MAP = {
  sm: { height: 20, aspectRatio: 4.5 },
  md: { height: 30, aspectRatio: 4.5 },
  lg: { height: 56, aspectRatio: 3.2 },
};

// Wordmark sizes - lg is 15-20% bigger for Home header
const WORDMARK_SIZE_MAP = {
  sm: { height: 18, aspectRatio: 5.5 },
  md: { height: 28, aspectRatio: 5.5 },
  lg: { height: 38, aspectRatio: 5.5 },  // ~35% bigger than md
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'wordmark',
  size = 'md',
}) => {
  const sizeMap = variant === 'full' ? SIZE_MAP : WORDMARK_SIZE_MAP;
  const dimensions = sizeMap[size];
  const calculatedWidth = dimensions.height * dimensions.aspectRatio;

  const logoSource = variant === 'full'
    ? require('../../assets/logo-full.png')
    : require('../../assets/logo-wordmark.png');

  return (
    <Image
      source={logoSource}
      style={{
        height: dimensions.height,
        width: calculatedWidth,
      }}
      resizeMode="contain"
      accessibilityLabel="FantaPronostic Logo"
    />
  );
};

// Fallback text component if image fails
export const BrandLogoFallback: React.FC<{ size?: LogoSize }> = ({ size = 'md' }) => {
  const fontSize = size === 'sm' ? 14 : size === 'md' ? 18 : 24;
  
  return (
    <View style={styles.fallbackContainer}>
      <Text style={[styles.fallbackFanta, { fontSize }]}>FANTA</Text>
      <Text style={[styles.fallbackPronostic, { fontSize }]}>Pronostic</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fallbackFanta: {
    fontWeight: '800',
    color: '#F59E0B',
  },
  fallbackPronostic: {
    fontWeight: '700',
    color: '#1F3A8A',
  },
});

export default BrandLogo;
