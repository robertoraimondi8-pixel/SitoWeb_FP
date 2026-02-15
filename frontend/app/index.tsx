import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { isAuthenticated, isLoading, token } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    handleRouting();
  }, [isLoading, isAuthenticated, token]);

  const handleRouting = async () => {
    // Check for Google OAuth callback (session_id in URL hash)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          await processGoogleSession(sessionId);
          return;
        }
      }
    }

    if (isLoading) return;

    if (!isAuthenticated) {
      setChecking(false);
      router.replace('/(auth)/login');
      return;
    }

    // Authenticated: check if user has leagues
    try {
      const leagues = await apiCall('/leagues', { token });
      if (!leagues || leagues.length === 0) {
        // Check if onboarding was already shown
        const onboardingSeen = await AsyncStorage.getItem('onboarding_seen');
        if (!onboardingSeen) {
          setChecking(false);
          router.replace('/onboarding');
          return;
        }
      }
    } catch (e) {
      // If error checking leagues, go to home anyway
    }

    setChecking(false);
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
      // New Google user → onboarding
      router.replace('/onboarding');
    } catch (e) {
      console.error('Google auth error:', e);
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color="#F5A623" />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
});
