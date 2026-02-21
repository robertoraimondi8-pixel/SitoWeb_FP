/**
 * AuthLanding — schermata iniziale auth
 * Azioni: Registrati | Accedi | Continua con Google | Password dimenticata
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, Dimensions, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useTranslation } from 'react-i18next';
import { apiCall } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/designSystem';

const { width, height } = Dimensions.get('window');

export default function AuthLanding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGoogleLogin = async () => {
    console.log('GOOGLE: start'); // LOG A
    setGoogleLoading(true);
    setGoogleError('');
    try {
      // ── WEB: redirect diretto del browser, callback gestito da app/index.tsx ──
      if (Platform.OS === 'web') {
        const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';
        console.log('GOOGLE: web branch — redirect to auth, origin:', redirectUri);
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUri)}`;
        window.location.href = authUrl;
        return; // pagina navigherà via, loading resta visibile
      }

      // ── NATIVE (iOS/Android): flow esistente con WebBrowser ──
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'fantapronostic', path: 'auth/callback' });
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUri)}`;
      timeoutRef.current = setTimeout(() => {
        setGoogleError('Login non completato. Riprova.');
        setGoogleLoading(false);
      }, 15000);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      clearTimeout(timeoutRef.current);

      // LOG B
      console.log('GOOGLE: result', {
        type: result.type,
        hasUrl: result.type === 'success' ? !!result.url : false,
        urlPreview: result.type === 'success' ? result.url?.slice(0, 80) : null,
        error: (result as { error?: string }).error ?? null,
      });

      if (result.type === 'success' && result.url) {
        let sessionId: string | null = null;
        const hashMatch = result.url.match(/#.*session_id=([^&]+)/);
        if (hashMatch) sessionId = hashMatch[1];
        if (!sessionId) {
          const queryMatch = result.url.match(/[?&]session_id=([^&#]+)/);
          if (queryMatch) sessionId = queryMatch[1];
        }
        console.log('GOOGLE: sessionId extracted?', !!sessionId); // LOG B extra
        if (!sessionId) { setGoogleError('Sessione non valida. Riprova.'); setGoogleLoading(false); return; }

        console.log('GOOGLE: calling backend /api/auth/google'); // LOG C
        const res = await apiCall('/auth/google/session', { method: 'POST', body: { session_id: sessionId }, skipAuth: true });

        // LOG D
        console.log('GOOGLE: backend status ok (no exception thrown)');
        console.log('GOOGLE: has access_token', !!res?.access_token);

        // 1. Salva auth state (AsyncStorage + React state in-memory)
        await loginWithToken(res.access_token, res.refresh_token, res.user);

        // LOG E
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const savedToken = await AsyncStorage.getItem('access_token');
        console.log('GOOGLE: token saved?', savedToken != null);

        // 2. Determina destinazione direttamente — NO router.replace('/')
        let targetRoute: string;
        let reason: string;

        if (!res.user?.username) {
          targetRoute = '/complete-profile';
          reason = 'no_username';
        } else {
          try {
            const leagues = await apiCall('/leagues', { token: res.access_token });
            if (!leagues || leagues.length === 0) {
              targetRoute = '/onboarding';
              reason = 'no_leagues';
            } else {
              targetRoute = '/(tabs)/home';
              reason = 'has_leagues';
            }
          } catch (_) {
            targetRoute = '/onboarding';
            reason = 'leagues_check_failed';
          }
        }

        console.log('GOOGLE: navigate to', targetRoute, 'reason:', reason); // LOG F
        router.replace(targetRoute as Href);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setGoogleError(result.type === 'cancel' ? 'Login annullato' : '');
      } else {
        setGoogleError('Errore durante il login. Riprova.');
      }
    } catch (e: unknown) {
      clearTimeout(timeoutRef.current);
      console.log('GOOGLE: CATCH error', e?.message); // LOG extra catch
      setGoogleError(e.message || 'Errore di connessione');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Logo */}
        <View style={s.heroSection}>
          <Image
            source={require('../../assets/logo-full.png')}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.tagline}>{t('auth.tagline')}</Text>
        </View>

        {/* CTA Buttons */}
        <View style={s.ctaSection}>
          {/* Registrati */}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={20} color={colors.textInverse} />
            <Text style={s.primaryBtnText}>{t('register')}</Text>
          </TouchableOpacity>

          {/* Accedi */}
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={20} color={colors.accent} />
            <Text style={s.secondaryBtnText}>Accedi</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>oppure</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Google */}
          {googleError ? (
            <Text style={s.errorText}>{googleError}</Text>
          ) : null}
          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <>
                <View style={s.googleIcon}><Text style={s.googleG}>G</Text></View>
                <Text style={s.googleBtnText}>Continua con Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Password dimenticata */}
          <TouchableOpacity
            style={s.forgotRow}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={s.forgotText}>Password dimenticata?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          Accedendo accetti i nostri{' '}
          <Text style={s.footerLink}>Termini</Text>
          {' '}e la{' '}
          <Text style={s.footerLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  heroSection: { alignItems: 'center', paddingTop: height * 0.06, paddingBottom: spacing.xxxl },
  logo: { width: width * 0.72, height: 190 },
  tagline: {
    fontSize: 18,
    fontWeight: '500' as const,
    lineHeight: 26,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  ctaSection: { gap: spacing.md },
  primaryBtn: {
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.button,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: colors.textInverse, letterSpacing: 0.5 },
  secondaryBtn: {
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  secondaryBtnText: { fontSize: 17, fontWeight: '700', color: colors.accent },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.lg, ...typography.meta, color: colors.textMuted },
  errorText: { ...typography.bodyS, color: colors.error, textAlign: 'center' },
  googleBtn: {
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  googleIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  googleG: { fontSize: 16, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { ...typography.bodyM, color: colors.textPrimary, fontWeight: '600' },
  forgotRow: { alignItems: 'center', paddingVertical: spacing.sm },
  forgotText: { ...typography.bodyM, color: colors.accent, fontWeight: '600' },
  footer: { ...typography.meta, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  footerLink: { color: colors.accent, fontWeight: '600' },
});
