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
  const [impersonating, setImpersonating] = useState(false);
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
      // Check for impersonation token first
      const urlParams = new URLSearchParams(window.location.search);
      const impersonateToken = urlParams.get('impersonate_token');
      const impersonateUser = urlParams.get('impersonate_user');
      if (impersonateToken) {
        setImpersonating(true);
        processImpersonation(impersonateToken, impersonateUser || '');
        return;
      }

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
    if (isLoading) return;
    if (impersonating) return;
    if (!splashDone && !isAuthenticated) return;
    route();
  }, [splashDone, isLoading, isAuthenticated, impersonating]);

  const route = async () => {
    const accessToken = await AsyncStorage.getItem('access_token');
    if (!accessToken) {
      router.replace('/(auth)/');
      return;
    }

    const userStr = await AsyncStorage.getItem('user');
    const storedUser: { profile_complete?: boolean; access_token?: string } | null = userStr ? JSON.parse(userStr) : null;

    // GATE 1: Profile completeness (Google users missing required fields)
    if (storedUser?.profile_completed === false) {
      router.replace('/complete-profile');
      return;
    }

    // GATE 2: Email verification
    if (storedUser?.email_verified === false) {
      router.replace('/verify-email');
      return;
    }

    // GATE 3: First access — no leagues → onboarding
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
      await loginWithToken(res.access_token, res.refresh_token, res.user);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {
      router.replace('/(auth)/');
    }
  };

  const processImpersonation = async (impToken: string, impUsername: string) => {
    try {
      const userData = await apiCall('/auth/me', { token: impToken });
      await AsyncStorage.setItem('impersonation_active', 'true');
      await AsyncStorage.setItem('impersonation_username', impUsername || userData.username || '');
      await loginWithToken(impToken, impToken, userData);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setImpersonating(false);
    } catch (e) {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setImpersonating(false);
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
