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
import { Ionicons } from '@expo/vector-icons';

// Design System
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';
import { BrandLogo } from '../../src/components/BrandLogo';

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
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Login failed');
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
    console.log(`${LOG_PREFIX} === GOOGLE LOGIN STARTED ===`);
    console.log(`${LOG_PREFIX} Platform: ${Platform.OS}`);
    
    setGoogleLoading(true);
    setGoogleError('');
    setError('');

    try {
      // Generate redirect URI using expo-auth-session
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'fantapronostic',
        path: 'auth/callback',
      });
      console.log(`${LOG_PREFIX} Generated redirectUri: ${redirectUri}`);

      // Build Emergent Auth URL
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUri)}`;
      console.log(`${LOG_PREFIX} Opening auth URL (without sensitive params)`);

      // Set timeout for Google login
      timeoutRef.current = setTimeout(() => {
        console.log(`${LOG_PREFIX} TIMEOUT: Login did not complete within ${GOOGLE_LOGIN_TIMEOUT/1000}s`);
        setGoogleError('Login non completato. Riprova.');
        setGoogleLoading(false);
      }, GOOGLE_LOGIN_TIMEOUT);

      // Open browser for OAuth
      console.log(`${LOG_PREFIX} Opening WebBrowser...`);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      console.log(`${LOG_PREFIX} WebBrowser result type: ${result.type}`);

      // Clear timeout since we got a response
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (result.type === 'success' && result.url) {
        console.log(`${LOG_PREFIX} SUCCESS: Received callback URL`);
        
        // Extract session_id from URL
        let sessionId: string | null = null;
        
        // Try hash fragment first (#session_id=...)
        const hashMatch = result.url.match(/#.*session_id=([^&]+)/);
        if (hashMatch) {
          sessionId = hashMatch[1];
          console.log(`${LOG_PREFIX} Found session_id in hash fragment`);
        }
        
        // Try query params (?session_id=...)
        if (!sessionId) {
          const queryMatch = result.url.match(/[?&]session_id=([^&#]+)/);
          if (queryMatch) {
            sessionId = queryMatch[1];
            console.log(`${LOG_PREFIX} Found session_id in query params`);
          }
        }

        if (!sessionId) {
          console.log(`${LOG_PREFIX} ERROR: No session_id found in callback URL`);
          setGoogleError('Sessione non valida. Riprova.');
          setGoogleLoading(false);
          return;
        }

        console.log(`${LOG_PREFIX} Calling backend /api/auth/google/session...`);
        
        // Call backend to verify session and get tokens
        try {
          const res = await apiCall('/auth/google/session', {
            method: 'POST',
            body: { session_id: sessionId },
            skipAuth: true,
          });
          
          console.log(`${LOG_PREFIX} Backend response: success, user: ${res.user?.username}`);
          
          // Use loginWithToken to update BOTH AsyncStorage AND in-memory context state
          await loginWithToken(res.access_token, res.refresh_token, res.user);
          
          console.log(`${LOG_PREFIX} Auth saved, navigating...`);
          
          // Route based on profile completion
          if (res.user?.profile_completed === false || !res.user?.accepted_privacy || !res.user?.accepted_terms) {
            router.replace('/complete-profile');
          } else {
            router.replace('/(tabs)/home');
          }
        } catch (backendError: any) {
          console.log(`${LOG_PREFIX} Backend error: ${backendError.message}`);
          setGoogleError(backendError.message || 'Autenticazione fallita');
          setGoogleLoading(false);
        }
      } else if (result.type === 'cancel') {
        console.log(`${LOG_PREFIX} User cancelled login`);
        setGoogleError('Login annullato');
        setGoogleLoading(false);
      } else if (result.type === 'dismiss') {
        console.log(`${LOG_PREFIX} Browser dismissed`);
        setGoogleLoading(false);
      } else {
        console.log(`${LOG_PREFIX} Unexpected result type: ${result.type}`);
        setGoogleError('Errore durante il login. Riprova.');
        setGoogleLoading(false);
      }
    } catch (e: any) {
      console.log(`${LOG_PREFIX} Exception: ${e.message}`);
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setGoogleError(e.message || 'Errore di connessione');
      setGoogleLoading(false);
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
            <Text style={styles.welcomeTitle}>Bentornato!</Text>
            <Text style={styles.welcomeSubtitle}>Accedi per continuare</Text>

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
              <Text style={styles.forgotText}>Password dimenticata?</Text>
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
                <Text style={styles.loginBtnText}>ACCEDI</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>oppure</Text>
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
                  <Text style={styles.retryBtnText}>Riprova</Text>
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
                  <Text style={styles.googleLoadingText}>Attendere...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.googleIconWrap}>
                    <Text style={styles.googleG}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Continua con Google</Text>
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
            <Text style={styles.registerLink}>{t('register')}</Text>
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
    ...shadows.card,
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
