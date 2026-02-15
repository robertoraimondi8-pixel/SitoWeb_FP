import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.35, 160);

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
  const [error, setError] = useState('');

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

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    setGoogleLoading(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const redirectUrl = window.location.origin;
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }
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

            {/* Google Login */}
            <TouchableOpacity
              testID="google-login-btn"
              style={[s.googleBtn, { borderColor: colors.border }]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
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
