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
import { View, Image, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/api/client';
import { colors } from '../src/theme/designSystem';

const MIN_SPLASH_MS = 700;

export default function SplashScreen() {
  const { isAuthenticated, isLoading, token, user, loginWithToken, logout } = useAuth();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const opacity = new Animated.Value(0);

  // Cleanup any stale browser sessions on app startup (fixes Android Google login stuck)
  useEffect(() => {
    cleanupStaleAuthState();
  }, []);

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

  const cleanupStaleAuthState = async () => {
    try {
      // Dismiss any lingering Chrome Custom Tabs from interrupted Google Sign-In
      if (Platform.OS !== 'web') {
        await WebBrowser.coolDownAsync();
      }
      // If a Google auth was in progress when the app was killed, clean up
      const pendingAuth = await AsyncStorage.getItem('google_auth_pending');
      if (pendingAuth === 'true') {
        console.log('[AUTH-RECOVERY] Detected interrupted Google auth, clearing stale state');
        await AsyncStorage.removeItem('google_auth_pending');
        // Only clear tokens if they look invalid (no user data stored)
        const storedUser = await AsyncStorage.getItem('user');
        if (!storedUser) {
          await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
        }
      }
    } catch (_) {}
  };

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
    const storedUser: { profile_completed?: boolean; email_verified?: boolean } | null = userStr ? JSON.parse(userStr) : null;

    // Validate token is still good before proceeding
    // If token is invalid/expired, reset auth and go to login
    if (!storedUser) {
      console.log('[AUTH-RECOVERY] Token exists but no user data, clearing invalid state');
      await logout();
      router.replace('/(auth)/');
      return;
    }

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
    } catch (e: any) {
      // If the API call fails with auth error, token is invalid → clear and go to login
      const msg = String(e?.message ?? e ?? '').toLowerCase();
      if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden')) {
        console.log('[AUTH-RECOVERY] Stored token is invalid, logging out');
        await logout();
        router.replace('/(auth)/');
        return;
      }
      // Network error — continue to home, user will retry
    }

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
        source={require('../assets/images/splash-stadium.png')}
        style={[s.bg, { opacity }]}
        resizeMode="cover"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a3a2a',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
