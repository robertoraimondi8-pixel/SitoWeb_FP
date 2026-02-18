/**
 * SplashScreen + FirstAccessGate
 * Routing logic:
 *   unauthenticated        → /(auth)/
 *   authenticated, profile incomplete → /complete-profile
 *   authenticated, no leagues          → /onboarding
 *   authenticated, has leagues         → /(tabs)/home
 */
import { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Animated, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme/designSystem';

const { width } = Dimensions.get('window');
const MIN_SPLASH_MS = 2000;

export default function SplashScreen() {
  const { isAuthenticated, isLoading, token, user } = useAuth();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  const opacity = new Animated.Value(0);

  // Animate logo in
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => setSplashDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Google OAuth callback handling (web)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          processGoogleSession(sessionId);
          return;
        }
      }
    }
  }, []);

  // Route once both splash and auth are ready
  useEffect(() => {
    if (!splashDone || isLoading) return;
    route();
  }, [splashDone, isLoading, isAuthenticated]);

  const route = async () => {
    if (!isAuthenticated) {
      router.replace('/(auth)/');
      return;
    }

    // Profile completeness gate
    if (user && user.profile_completed === false) {
      router.replace('/complete-profile');
      return;
    }

    // League gate
    try {
      const leagues = await apiCall('/leagues', { token });
      if (!leagues || leagues.length === 0) {
        router.replace('/onboarding');
        return;
      }
    } catch (_) {}

    router.replace('/(tabs)/home');
  };

  const processGoogleSession = async (sessionId: string) => {
    try {
      const res = await apiCall('/auth/google/session', {
        method: 'POST',
        body: { session_id: sessionId },
      });
      await AsyncStorage.setItem('access_token', res.access_token);
      await AsyncStorage.setItem('refresh_token', res.refresh_token);
      await AsyncStorage.setItem('user', JSON.stringify(res.user));
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      router.replace('/');
    } catch (e) {
      router.replace('/(auth)/');
    }
  };

  return (
    <View style={s.container}>
      <Animated.Image
        source={require('../assets/logo-full.png')}
        style={[s.logo, { opacity }]}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.65,
    height: 180,
  },
});
