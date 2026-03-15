import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiCall } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/designSystem';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    processGoogleCallback();
  }, []);

  const processGoogleCallback = async () => {
    try {
      let sessionId: string | null = null;

      if (params.session_id) {
        sessionId = params.session_id as string;
      }

      if (!sessionId && Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash && hash.includes('session_id=')) {
          sessionId = hash.split('session_id=')[1]?.split('&')[0];
        }
        const urlParams = new URLSearchParams(window.location.search);
        if (!sessionId && urlParams.has('session_id')) {
          sessionId = urlParams.get('session_id');
        }
      }

      if (!sessionId) {
        setError('Sessione non trovata. Riprova il login.');
        setProcessing(false);
        setTimeout(() => router.replace('/(auth)/login'), 3000);
        return;
      }

      const res = await apiCall('/auth/google/session', {
        method: 'POST',
        body: { session_id: sessionId },
        skipAuth: true,
      });

      // Bug 1 fix: update AuthContext in-memory state (not just AsyncStorage)
      await loginWithToken(res.access_token, res.refresh_token, res.user);

      // Bug 2 fix: same routing gates as normal login
      // GATE 1: incomplete profile (Google users without username/dob)
      if (res.user?.profile_completed === false) {
        router.replace('/complete-profile');
        return;
      }

      // GATE 2: email verification
      if (res.user?.email_verified === false) {
        router.replace('/verify-email');
        return;
      }

      // GATE 3: no leagues → onboarding
      try {
        const leagues = await apiCall('/leagues', { token: res.access_token });
        if (!leagues || leagues.length === 0) {
          router.replace('/onboarding');
          return;
        }
      } catch {
        // If leagues check fails, continue to home
      }

      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      setError((e as Error).message || 'Autenticazione fallita');
      setProcessing(false);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {error ? (
        <View style={s.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[s.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.replace('/(auth)/login')}
            data-testid="callback-retry-btn"
          >
            <Text style={[s.retryBtnText, { color: colors.background }]}>Torna al Login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.text, { color: colors.textSecondary }]}>Autenticazione in corso...</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingContainer: { alignItems: 'center', gap: 16 },
  errorContainer: { alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  text: { fontSize: 16, fontWeight: '500' },
  errorText: { fontSize: 15, textAlign: 'center', fontWeight: '500' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 16 },
  retryBtnText: { fontSize: 15, fontWeight: '600' },
});
