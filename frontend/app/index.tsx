/**
 * SplashScreen + FirstAccessGate
 * Routing logic (in order):
 *   1. unauthenticated             → /(auth)/
 *   2. profile incomplete          → /complete-profile
 *   3. email_verified == false     → /verify-email
 *   4. no leagues                  → /onboarding (scelta iniziale)
 *   5. else                        → /(tabs)/home
 */
import { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Animated, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/api/client';
import { colors } from '../src/theme/designSystem';

const { width } = Dimensions.get('window');
const MIN_SPLASH_MS = 2000;

export default function SplashScreen() {
  const { isAuthenticated, isLoading, token, user, loginWithToken } = useAuth();
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
  // Special case: if user is already authenticated (e.g. post-login redirect),
  // skip the splash wait and route immediately.
  useEffect(() => {
    if (isLoading) return;
    if (!splashDone && !isAuthenticated) return; // Show splash only if NOT yet authenticated
    route();
  }, [splashDone, isLoading, isAuthenticated]);

  const route = async () => {
    // Read directly from AsyncStorage — avoids React state stale-closure race condition
    // (AsyncStorage is written synchronously in saveAuth before setState calls)
    const accessToken = await AsyncStorage.getItem('access_token');
    if (!accessToken) {
      router.replace('/(auth)/');
      return;
    }

    const userStr = await AsyncStorage.getItem('user');
    const storedUser: any = userStr ? JSON.parse(userStr) : null;

    // GATE 1: Profile completeness (Google users missing required fields)
    if (storedUser?.profile_completed === false) {
      router.replace('/complete-profile');
      return;
    }

    // GATE 2: Email verification (manual registrations)
    // TODO: Riattivare quando si integra un servizio email reale (es. Resend)
    // Google emails are always considered verified (email_verified: true from backend)
    // if (storedUser?.email_verified === false) {
    //   router.replace({
    //     pathname: '/verify-email',
    //     params: { email: storedUser.email ?? '' },
    //   });
    //   return;
    // }

    // GATE 3: First access — no leagues → onboarding choice screen
    try {
      const leagues = await apiCall('/leagues', { token: accessToken });
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
      // Use loginWithToken — updates BOTH AsyncStorage AND in-memory context state
      await loginWithToken(res.access_token, res.refresh_token, res.user);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      // Don't navigate — the route() useEffect will fire when isAuthenticated changes
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
