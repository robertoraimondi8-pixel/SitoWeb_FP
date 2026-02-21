import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const LOG_PREFIX = '[GoogleCallback]';

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    processGoogleCallback();
  }, []);

  const processGoogleCallback = async () => {
    console.log(`${LOG_PREFIX} === CALLBACK SCREEN LOADED ===`);
    console.log(`${LOG_PREFIX} Platform: ${Platform.OS}`);
    
    try {
      let sessionId: string | null = null;

      // Method 1: Check URL params (for deep links)
      if (params.session_id) {
        sessionId = params.session_id as string;
        console.log(`${LOG_PREFIX} Found session_id in route params`);
      }

      // Method 2: Extract session_id from URL hash fragment (web)
      if (!sessionId && Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        console.log(`${LOG_PREFIX} Web hash fragment present: ${!!hash}`);
        if (hash && hash.includes('session_id=')) {
          sessionId = hash.split('session_id=')[1]?.split('&')[0];
          console.log(`${LOG_PREFIX} Extracted session_id from hash`);
        }
        
        // Also check query params
        const urlParams = new URLSearchParams(window.location.search);
        if (!sessionId && urlParams.has('session_id')) {
          sessionId = urlParams.get('session_id');
          console.log(`${LOG_PREFIX} Extracted session_id from query params`);
        }
      }

      if (!sessionId) {
        console.log(`${LOG_PREFIX} ERROR: No session_id found in callback`);
        setError('Sessione non trovata. Riprova il login.');
        setProcessing(false);
        setTimeout(() => router.replace('/(auth)/login'), 3000);
        return;
      }

      console.log(`${LOG_PREFIX} Calling backend /api/auth/google/session...`);

      // Send session_id to backend for verification
      const res = await apiCall('/auth/google/session', {
        method: 'POST',
        body: { session_id: sessionId },
        skipAuth: true,
      });

      console.log(`${LOG_PREFIX} Backend response received, user: ${res.user?.username}`);

      // Save auth data
      await AsyncStorage.setItem('access_token', res.access_token);
      await AsyncStorage.setItem('refresh_token', res.refresh_token);
      await AsyncStorage.setItem('user', JSON.stringify(res.user));

      console.log(`${LOG_PREFIX} Auth data saved, redirecting to home...`);

      // Redirect to home
      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      console.error(`${LOG_PREFIX} Error: ${e.message}`);
      setError(e.message || 'Autenticazione fallita');
      setProcessing(false);
    }
  };

  const handleRetry = () => {
    router.replace('/(auth)/login');
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {error ? (
        <View style={s.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[s.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity 
            style={[s.retryBtn, { backgroundColor: colors.accent }]}
            onPress={handleRetry}
          >
            <Text style={[s.retryBtnText, { color: colors.background }]}>
              Torna al Login
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.text, { color: colors.textSecondary }]}>
            Autenticazione in corso...
          </Text>
          <Text style={[s.subtext, { color: colors.textSecondary }]}>
            Attendere...
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  text: { 
    fontSize: 16, 
    fontWeight: '500',
  },
  subtext: {
    fontSize: 13,
  },
  errorText: { 
    fontSize: 15, 
    textAlign: 'center',
    fontWeight: '500',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
