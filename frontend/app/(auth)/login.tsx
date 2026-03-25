import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Design System
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { BrandLogo } from '../../src/components/BrandLogo';

// ─── Mappa errori login → messaggi leggibili ─────────────────────────────────
function mapLoginErrorKey(e: unknown): string {
  const raw = (e?.message ?? String(e ?? '')).toLowerCase();
  if (
    raw.includes('401') || raw.includes('400') ||
    raw.includes('invalid email') || raw.includes('invalid password') ||
    raw.includes('incorrect') || raw.includes('not found') ||
    raw.includes('user not found') ||
    raw.includes('email o password') || raw.includes('non validi')
  ) return 'login_errors.invalid_credentials';
  if (
    raw.includes('network') || raw.includes('fetch') ||
    raw.includes('connection') || raw.includes('failed to fetch')
  ) return 'login_errors.network_error';
  if (raw.includes('50') || raw.includes('server error') || raw.includes('internal')) {
    return 'login_errors.server_error';
  }
  return 'login_errors.generic_error';
}

const { width } = Dimensions.get('window');

// Timeout per Google Login (15 secondi)
const GOOGLE_LOGIN_TIMEOUT = 15000;

// Log prefix per identificare i log di Google OAuth
const LOG_PREFIX = '[GoogleOAuth]';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, loginWithToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [error, setError] = useState('');
  
  // Ref per timeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await login(email.trim().toLowerCase(), password);
      const accessToken = res.access_token;
      const storedUser = res.user;

      // GATE 1: profilo incompleto (utenti Google)
      if (storedUser?.profile_completed === false) {
        router.replace('/complete-profile');
        return;
      }

      // GATE 2: email verification
      if (storedUser?.email_verified === false) {
        router.replace('/verify-email');
        return;
      }

      // GATE 3: nessuna lega → onboarding
      try {
        const leagues = await apiCall('/leagues', { token: accessToken });
        if (!leagues || leagues.length === 0) {
          router.replace('/onboarding');
          return;
        }
      } catch (leagueErr: unknown) {
        router.replace('/onboarding');
        return;
      }

      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      setError(t(mapLoginErrorKey(e)));
    } finally {
      setLoading(false);
    }
  };

  const resetGoogleState = () => {
    setGoogleLoading(false);
    setGoogleError('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    setError('');

    try {
      // Mark Google auth as in-progress (for recovery on app restart)
      await AsyncStorage.setItem('google_auth_pending', 'true');

      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'fantapronostic',
        path: 'auth/callback',
      });

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUri)}`;

      timeoutRef.current = setTimeout(async () => {
        setGoogleError(t('login_errors.google_timeout'));
        setGoogleLoading(false);
        await AsyncStorage.removeItem('google_auth_pending');
        // Dismiss any stuck browser session
        try { await WebBrowser.dismissBrowser(); } catch (_) {}
      }, GOOGLE_LOGIN_TIMEOUT);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (result.type === 'success' && result.url) {
        let sessionId: string | null = null;
        const hashMatch = result.url.match(/#.*session_id=([^&]+)/);
        if (hashMatch) sessionId = hashMatch[1];
        if (!sessionId) {
          const queryMatch = result.url.match(/[?&]session_id=([^&#]+)/);
          if (queryMatch) sessionId = queryMatch[1];
        }

        if (!sessionId) {
          setGoogleError(t('login_errors.google_invalid_session'));
          setGoogleLoading(false);
          await AsyncStorage.removeItem('google_auth_pending');
          return;
        }

        try {
          const res = await apiCall('/auth/google/session', {
            method: 'POST',
            body: { session_id: sessionId },
            skipAuth: true,
          });
          // Only persist auth AFTER backend confirms session is valid
          await loginWithToken(res.access_token, res.refresh_token, res.user);
          await AsyncStorage.removeItem('google_auth_pending');
          router.replace('/');
        } catch (backendError: unknown) {
          setGoogleError(backendError.message || t('login_errors.google_auth_failed'));
          setGoogleLoading(false);
          await AsyncStorage.removeItem('google_auth_pending');
        }
      } else if (result.type === 'cancel') {
        setGoogleError(t('login_errors.google_cancelled'));
        setGoogleLoading(false);
        await AsyncStorage.removeItem('google_auth_pending');
      } else if (result.type === 'dismiss') {
        setGoogleLoading(false);
        await AsyncStorage.removeItem('google_auth_pending');
      } else {
        setGoogleError(t('login_errors.google_generic_error'));
        setGoogleLoading(false);
        await AsyncStorage.removeItem('google_auth_pending');
      }
    } catch (e: unknown) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setGoogleError(e.message || t('login_errors.google_connection_error'));
      setGoogleLoading(false);
      await AsyncStorage.removeItem('google_auth_pending');
      // Dismiss any stuck browser
      try { await WebBrowser.dismissBrowser(); } catch (_) {}
    }
  };

  const handleRetryGoogle = () => {
    resetGoogleState();
    handleGoogleLogin();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo - GRANDE E DOMINANTE */}
          <View style={styles.logoSection}>
            <Image
              source={require('../../assets/logo-full.png')}
              style={styles.mainLogo}
              resizeMode="contain"
            />
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.welcomeTitle}>{t('auth.welcome_back')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('auth.sign_in_continue')}</Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                placeholder={t('email')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                placeholder={t('password')}
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                testID="toggle-password-btn"
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity testID="forgot-password-btn" style={styles.forgotRow} onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotText}>{t('forgot_password')}</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              testID="login-submit-btn"
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.loginBtnText}>{t('login').toUpperCase()}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login Error */}
            {googleError ? (
              <View style={styles.googleErrorBanner}>
                <Ionicons name="warning" size={18} color={colors.error} />
                <Text style={styles.googleErrorText}>{googleError}</Text>
                <TouchableOpacity 
                  testID="retry-google-btn"
                  onPress={handleRetryGoogle}
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryBtnText}>{t('login_errors.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Google Login */}
            <TouchableOpacity
              testID="google-login-btn"
              style={[styles.googleBtn, googleError && { opacity: 0.7 }]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <View style={styles.googleLoadingRow}>
                  <ActivityIndicator color={colors.textSecondary} size="small" />
                  <Text style={styles.googleLoadingText}>{t('auth.loading_google')}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.googleIconWrap}>
                    <Text style={styles.googleG}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>{t('continue_with_google')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <TouchableOpacity
            testID="go-to-register-btn"
            onPress={() => router.push('/(auth)/register')}
            style={styles.registerRow}
          >
            <Text style={styles.registerLabel}>{t('no_account')} </Text>
            <Text style={styles.registerLink}>{t('register_action')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  
  /* ─── Logo ENORME DOMINANTE ─── */
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
    marginBottom: spacing.lg,
  },
  mainLogo: {
    width: width * 0.85,   // 85% larghezza schermo
    height: 220,           // ~35% altezza schermo visibile
  },
  
  /* ─── Form Card ─── */
  formCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  welcomeTitle: {
    ...typography.titleL,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    ...typography.bodyS,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    ...typography.bodyS,
    color: colors.error,
  },
  
  /* ─── Inputs ─── */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    height: 54,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    color: colors.textPrimary,
  },
  
  /* ─── Forgot Password ─── */
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xl,
    paddingVertical: spacing.xs,
  },
  forgotText: {
    ...typography.meta,
    color: colors.accent,
    fontWeight: '600',
  },
  
  /* ─── Login Button ─── */
  loginBtn: {
    height: 54,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadows.button,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.textInverse,
  },
  
  /* ─── Divider ─── */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.lg,
    ...typography.meta,
    color: colors.textMuted,
  },
  
  /* ─── Google Error ─── */
  googleErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.errorLight,
    marginBottom: spacing.md,
  },
  googleErrorText: {
    flex: 1,
    ...typography.bodyS,
    color: colors.error,
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  retryBtnText: {
    ...typography.meta,
    color: colors.error,
    fontWeight: '600',
  },
  
  /* ─── Google Button ─── */
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  googleLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  googleLoadingText: {
    ...typography.bodyM,
    color: colors.textSecondary,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleG: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleBtnText: {
    ...typography.bodyM,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  
  /* ─── Register Link ─── */
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  registerLabel: {
    ...typography.bodyM,
    color: colors.textSecondary,
  },
  registerLink: {
    ...typography.bodyM,
    color: colors.accent,
    fontWeight: '700',
  },
});
