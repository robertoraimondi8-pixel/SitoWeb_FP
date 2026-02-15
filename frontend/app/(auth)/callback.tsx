import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    processGoogleCallback();
  }, []);

  const processGoogleCallback = async () => {
    try {
      let sessionId: string | null = null;

      // Extract session_id from URL hash fragment (web) or query params
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash && hash.includes('session_id=')) {
          sessionId = hash.split('session_id=')[1]?.split('&')[0];
        }
      }

      if (!sessionId) {
        setError('No session_id found');
        setTimeout(() => router.replace('/(auth)/login'), 2000);
        return;
      }

      // Send session_id to backend for verification
      const res = await apiCall('/auth/google/session', {
        method: 'POST',
        body: { session_id: sessionId },
      });

      // Save auth data
      await AsyncStorage.setItem('access_token', res.access_token);
      await AsyncStorage.setItem('refresh_token', res.refresh_token);
      await AsyncStorage.setItem('user', JSON.stringify(res.user));

      // Redirect to home
      router.replace('/(tabs)/home');
    } catch (e: any) {
      console.error('Google auth error:', e);
      setError(e.message || 'Authentication failed');
      setTimeout(() => router.replace('/(auth)/login'), 3000);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {error ? (
        <Text style={[s.error, { color: colors.error }]}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.text, { color: colors.textSecondary }]}>Autenticazione in corso...</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { fontSize: 16, marginTop: 20 },
  error: { fontSize: 15, textAlign: 'center' },
});
