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
    // ── LOG PUNTO 3 ──────────────────────────────────────────────────────────
    console.log('[DEBUG-3] index.tsx useEffect fired:',
      'isLoading=', isLoading,
      'isAuthenticated=', isAuthenticated,
      'splashDone=', splashDone,
      'impersonating=', impersonating
    );
    if (isLoading) { console.log('[DEBUG-3] SKIP: isLoading=true'); return; }
    if (impersonating) { console.log('[DEBUG-3] SKIP: impersonation in progress'); return; }
    if (!splashDone && !isAuthenticated) { console.log('[DEBUG-3] SKIP: splash not done + not auth'); return; }
    console.log('[DEBUG-3] => chiamo route()');
    route();
  }, [splashDone, isLoading, isAuthenticated, impersonating]);

  const route = async () => {
    const accessToken = await AsyncStorage.getItem('access_token');
    console.log('[DEBUG-3] route(): storedTokenExists=', !!accessToken);
    if (!accessToken) {
      console.log('[DEBUG-4] NAVIGATE -> /(auth)/ (no token in AsyncStorage)');
      router.replace('/(auth)/');
      return;
    }

    const userStr = await AsyncStorage.getItem('user');
    const storedUser: { profile_complete?: boolean; access_token?: string } | null = userStr ? JSON.parse(userStr) : null;

    // GATE 1: Profile completeness (Google users missing required fields)
    if (storedUser?.profile_completed === false) {
      console.log('[DEBUG-4] NAVIGATE -> /complete-profile (profile_completed=false)');
      router.replace('/complete-profile');
      return;
    }

    // GATE 2: Email verification — disabilitato per beta
    // if (storedUser?.email_verified === false) { ... }

    // GATE 3: First access — no leagues → onboarding
    try {
      const leagues = await apiCall('/leagues', { token: accessToken });
      if (!leagues || leagues.length === 0) {
        console.log('[DEBUG-4] NAVIGATE -> /onboarding (nessuna lega da index.tsx)');
        router.replace('/onboarding');
        return;
      }
    } catch (_) {}

    console.log('[DEBUG-4] NAVIGATE -> /(tabs)/home (da index.tsx)');
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

  const processImpersonation = async (impToken: string, impUsername: string) => {
    try {
      console.log('[Impersonate] Starting impersonation for:', impUsername);
      // Fetch user data using the impersonated token
      const userData = await apiCall('/auth/me', { token: impToken });
      console.log('[Impersonate] User data fetched:', userData?.username);
      // Save impersonation state
      await AsyncStorage.setItem('impersonation_active', 'true');
      await AsyncStorage.setItem('impersonation_username', impUsername || userData.username || '');
      // Establish the session
      await loginWithToken(impToken, impToken, userData);
      console.log('[Impersonate] Session established');
      // Clean URL
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      // Allow routing to proceed (isAuthenticated is now true)
      setImpersonating(false);
    } catch (e) {
      console.error('[Impersonate] Failed:', e);
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
