import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image, Dimensions, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.35, 160);

// Timeout per Google Login (15 secondi)
const GOOGLE_LOGIN_TIMEOUT = 15000;

// Log prefix per identificare i log di Google OAuth
const LOG_PREFIX = '[GoogleOAuth]';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { login } = useAuth();
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
          
          // Save auth data
          await AsyncStorage.setItem('access_token', res.access_token);
          await AsyncStorage.setItem('refresh_token', res.refresh_token);
          await AsyncStorage.setItem('user', JSON.stringify(res.user));
          
          console.log(`${LOG_PREFIX} Auth data saved, redirecting to home...`);
          
          // Navigate to home
          router.replace('/(tabs)/home');
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
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.keyboardView}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={s.logoSection}>
            <Image
              testID="app-logo"
              source={require('../../assets/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form Card */}
          <View style={[s.formCard, { backgroundColor: colors.card }]}>
            {error ? (
              <View style={[s.errorBanner, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={[s.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={[s.inputContainer, { borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={s.inputIcon} />
              <TextInput
                testID="login-email-input"
                style={[s.input, { color: colors.text }]}
                placeholder={t('email')}
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={[s.inputContainer, { borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={s.inputIcon} />
              <TextInput
                testID="login-password-input"
                style={[s.input, { color: colors.text }]}
                placeholder={t('password')}
                placeholderTextColor={colors.textSecondary}
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
            <TouchableOpacity testID="forgot-password-btn" style={s.forgotRow}>
              <Text style={[s.forgotText, { color: colors.accent }]}>Password dimenticata?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              testID="login-submit-btn"
              style={[s.loginBtn, { backgroundColor: colors.accent }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[s.loginBtnText, { color: colors.background }]}>
                  {t('login').toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[s.dividerText, { color: colors.textSecondary }]}>oppure</Text>
              <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Google Login Error */}
            {googleError ? (
              <View style={[s.googleErrorBanner, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="warning" size={18} color={colors.error} />
                <Text style={[s.googleErrorText, { color: colors.error }]}>{googleError}</Text>
                <TouchableOpacity 
                  testID="retry-google-btn"
                  onPress={handleRetryGoogle}
                  style={[s.retryBtn, { borderColor: colors.error }]}
                >
                  <Text style={[s.retryBtnText, { color: colors.error }]}>Riprova</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Google Login */}
            <TouchableOpacity
              testID="google-login-btn"
              style={[
                s.googleBtn, 
                { borderColor: colors.border },
                googleError && { opacity: 0.7 }
              ]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <View style={s.googleLoadingRow}>
                  <ActivityIndicator color={colors.text} size="small" />
                  <Text style={[s.googleLoadingText, { color: colors.textSecondary }]}>
                    Attendere...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={s.googleIconWrap}>
                    <Text style={s.googleG}>G</Text>
                  </View>
                  <Text style={[s.googleBtnText, { color: colors.text }]}>
                    Continua con Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <TouchableOpacity
            testID="go-to-register-btn"
            onPress={() => router.push('/(auth)/register')}
            style={s.registerRow}
          >
            <Text style={[s.registerLabel, { color: colors.textSecondary }]}>
              {t('no_account')}{' '}
            </Text>
            <Text style={[s.registerLink, { color: colors.accent }]}>
              {t('register')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 60,
  },
  /* ─── Logo ─── */
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: LOGO_SIZE * 1.3,
    height: LOGO_SIZE,
    borderRadius: 20,
  },
  /* ─── Form Card ─── */
  formCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  /* ─── Inputs ─── */
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  /* ─── Forgot Password ─── */
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    paddingVertical: 2,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  /* ─── Login Button ─── */
  loginBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  /* ─── Divider ─── */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    fontWeight: '500',
  },
  /* ─── Google Error ─── */
  googleErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  googleErrorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  /* ─── Google Button ─── */
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  googleLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  googleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  /* ─── Register Link ─── */
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerLabel: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
