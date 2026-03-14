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
    setGoogleLoading(true);
    setGoogleError('');
    try {
      // ── WEB: redirect diretto del browser, callback gestito da app/index.tsx ──
      if (Platform.OS === 'web') {
        const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUri)}`;
        window.location.href = authUrl;
        return;
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

      if (result.type === 'success' && result.url) {
        let sessionId: string | null = null;
        const hashMatch = result.url.match(/#.*session_id=([^&]+)/);
        if (hashMatch) sessionId = hashMatch[1];
        if (!sessionId) {
          const queryMatch = result.url.match(/[?&]session_id=([^&#]+)/);
          if (queryMatch) sessionId = queryMatch[1];
        }
        if (!sessionId) { setGoogleError('Sessione non valida. Riprova.'); setGoogleLoading(false); return; }

        const res = await apiCall('/auth/google/session', { method: 'POST', body: { session_id: sessionId }, skipAuth: true });

        // Salva auth state
        await loginWithToken(res.access_token, res.refresh_token, res.user);

        // Determina destinazione
        let targetRoute: string;

        if (!res.user?.username) {
          targetRoute = '/complete-profile';
        } else {
          try {
            const leagues = await apiCall('/leagues', { token: res.access_token });
            if (!leagues || leagues.length === 0) {
              targetRoute = '/onboarding';
            } else {
              targetRoute = '/(tabs)/home';
            }
          } catch (_) {
            targetRoute = '/onboarding';
          }
        }

        router.replace(targetRoute as Href);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setGoogleError(result.type === 'cancel' ? 'Login annullato' : '');
      } else {
        setGoogleError('Errore durante il login. Riprova.');
      }
    } catch (e: unknown) {
      clearTimeout(timeoutRef.current);
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
            <Text style={s.secondaryBtnText}>{t('login')}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t('or')}</Text>
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
                <Text style={s.googleBtnText}>{t('continue_with_google')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.forgotRow}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={s.forgotText}>{t('forgot_password')}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          {t('auth.footer_text')}{' '}
          <Text style={s.footerLink} onPress={() => router.push('/menu/terms')}>{t('auth.footer_terms')}</Text>
          {' '}{t('auth.footer_and')}{' '}
          <Text style={s.footerLink} onPress={() => router.push('/menu/privacy')}>{t('auth.footer_privacy')}</Text>
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
