/**
 * VerifyEmailScreen — schermata verifica email
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Dimensions, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiCall } from '../src/api/client';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, borderRadius, shadows, typography } from '../src/theme/designSystem';

const { width } = Dimensions.get('window');

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { email: paramEmail } = useLocalSearchParams<{ email: string }>();
  const { user, updateUser } = useAuth();

  const emailToShow = user?.email ?? paramEmail ?? '';

  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerify = async () => {
    const tk = token.trim();
    if (!tk) { setErrorMsg(t('verify_email.paste_token')); return; }
    setVerifying(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiCall('/auth/verify-email', {
        method: 'POST',
        body: { token: tk },
        skipAuth: true,
      });
      updateUser({ email_verified: true });
      setSuccessMsg(t('verify_email.verified_success'));
      setTimeout(() => router.replace('/'), 1200);
    } catch (e: unknown) {
      setErrorMsg(e.message || t('verify_email.invalid_token'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!emailToShow) return;
    setResending(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiCall('/auth/resend-verification', {
        method: 'POST',
        body: { email: emailToShow },
        skipAuth: true,
      });
      setSuccessMsg(t('verify_email.resend_success'));
    } catch (e: unknown) {
      setErrorMsg(e.message || t('verify_email.resend_error'));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../assets/logo-full.png')}
          style={s.logo}
          resizeMode="contain"
        />

        <View style={s.iconWrap}>
          <Ionicons name="mail-open-outline" size={52} color={colors.accent} />
        </View>

        <Text style={s.title}>{t('verify_email.title')}</Text>

        {emailToShow ? (
          <Text style={s.email}>{emailToShow}</Text>
        ) : null}

        {/* Messaggio user-friendly */}
        <View style={s.infoBanner}>
          <Ionicons name="mail-outline" size={18} color={colors.info ?? '#3B82F6'} />
          <View style={{ flex: 1 }}>
            <Text style={s.infoDesc}>{t('verify_email.sent_desc')}</Text>
            <Text style={s.infoHint}>{t('verify_email.check_spam')}</Text>
          </View>
        </View>

        {/* TOKEN INPUT */}
        <View style={s.tokenSection}>
          <Text style={s.tokenLabel}>{t('verify_email.token_label')}</Text>
          <View style={[s.tokenInputWrap, errorMsg ? { borderColor: colors.error } : null]}>
            <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
            <TextInput
              style={s.tokenInput}
              placeholder={t('verify_email.token_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={token}
              onChangeText={v => { setToken(v); setErrorMsg(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
            />
            {token.length > 0 && (
              <TouchableOpacity onPress={() => setToken('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Feedback */}
        {successMsg ? (
          <View style={s.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={s.successText}>{successMsg}</Text>
          </View>
        ) : null}
        {errorMsg ? (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* VERIFY BUTTON */}
        <TouchableOpacity
          style={[s.verifyBtn, (verifying || !token.trim()) && { opacity: 0.5 }]}
          onPress={handleVerify}
          disabled={verifying || !token.trim()}
          activeOpacity={0.85}
        >
          {verifying ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={20} color={colors.textInverse} />
              <Text style={s.verifyBtnText}>{t('verify_email.verify_btn')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* RESEND BUTTON */}
        <TouchableOpacity
          style={[s.resendBtn, resending && { opacity: 0.6 }]}
          onPress={handleResend}
          disabled={resending}
          activeOpacity={0.85}
        >
          {resending ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color={colors.accent} />
              <Text style={s.resendBtnText}>{t('verify_email.resend_btn')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.loginLink}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.7}
        >
          <Text style={s.loginLinkText}>{t('forgot_password_screen.back_to_login')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xxl,
  },
  logo: { width: width * 0.52, height: 100, marginBottom: spacing.xxl },
  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: `${colors.accent}18`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.titleL, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  email: {
    ...typography.bodyM, color: colors.accent, fontWeight: '700',
    textAlign: 'center', marginBottom: spacing.xl,
  },
  infoBanner: {
    flexDirection: 'row', gap: spacing.md,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderLeftWidth: 4, borderLeftColor: '#3B82F6',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl, width: '100%',
  },
  infoDesc: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginBottom: spacing.xs },
  infoHint: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  tokenSection: { width: '100%', marginBottom: spacing.lg },
  tokenLabel: { ...typography.bodyS, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs },
  tokenInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.lg, height: 52,
    paddingHorizontal: spacing.md, gap: spacing.sm,
    backgroundColor: colors.background,
  },
  tokenInput: { flex: 1, fontSize: 13, color: colors.textPrimary, height: '100%' },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: `${colors.success}15`, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.lg, width: '100%',
  },
  successText: { flex: 1, ...typography.bodyS, color: colors.success },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorLight, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.lg, width: '100%',
  },
  errorText: { flex: 1, ...typography.bodyS, color: colors.error },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, height: 54, borderRadius: borderRadius.lg,
    backgroundColor: colors.accent, width: '100%', marginBottom: spacing.md,
    ...shadows.button,
  },
  verifyBtnText: { fontSize: 16, fontWeight: '800', color: colors.textInverse, letterSpacing: 0.5 },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, height: 52, borderRadius: borderRadius.lg,
    borderWidth: 2, borderColor: colors.accent, width: '100%', marginBottom: spacing.md,
  },
  resendBtnText: { ...typography.bodyM, color: colors.accent, fontWeight: '700' },
  loginLink: { paddingVertical: spacing.md },
  loginLinkText: { ...typography.bodyM, color: colors.textSecondary },
});
