/**
 * VerifyEmailScreen — schermata post-registrazione
 * Mostra messaggio "controlla la tua email" con pulsante "Rinvia"
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/api/client';
import { colors, spacing, borderRadius, shadows, typography } from '../src/theme/designSystem';

const { width } = Dimensions.get('window');

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendError, setResendError] = useState('');

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setResendMsg('');
    setResendError('');
    try {
      const res = await apiCall('/auth/resend-verification', {
        method: 'POST',
        body: { email },
        skipAuth: true,
      });
      setResendMsg(res.message || 'Email inviata. Controlla la tua casella.');
    } catch (e: any) {
      setResendError(e.message || 'Errore. Riprova più tardi.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.inner}>
        {/* Logo */}
        <Image
          source={require('../assets/logo-full.png')}
          style={s.logo}
          resizeMode="contain"
        />

        {/* Icon */}
        <View style={s.iconWrap}>
          <Ionicons name="mail-open-outline" size={56} color={colors.accent} />
        </View>

        <Text style={s.title}>Controlla la tua email</Text>
        <Text style={s.subtitle}>
          Abbiamo inviato un link di verifica a:
        </Text>
        {email ? (
          <Text style={s.email}>{email}</Text>
        ) : null}
        <Text style={s.hint}>
          Clicca sul link nell'email per attivare il tuo account.{'\n'}
          Se non vedi l'email, controlla la cartella spam.
        </Text>

        {/* Feedback messages */}
        {resendMsg ? (
          <View style={s.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={s.successText}>{resendMsg}</Text>
          </View>
        ) : null}
        {resendError ? (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={s.errorText}>{resendError}</Text>
          </View>
        ) : null}

        {/* Resend button */}
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
              <Text style={s.resendBtnText}>Rinvia email di verifica</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Go to login */}
        <TouchableOpacity
          style={s.loginBtn}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={s.loginBtnText}>Vai al Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl,
  },
  logo: { width: width * 0.55, height: 110, marginBottom: spacing.xxl },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${colors.accent}15`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.titleL, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.bodyM, color: colors.textSecondary, textAlign: 'center' },
  email: {
    ...typography.bodyM, color: colors.accent, fontWeight: '700',
    textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg,
  },
  hint: {
    ...typography.bodyS, color: colors.textMuted,
    textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl,
  },
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
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, height: 52, borderRadius: borderRadius.lg,
    borderWidth: 2, borderColor: colors.accent,
    paddingHorizontal: spacing.xxl, marginBottom: spacing.md, width: '100%',
  },
  resendBtnText: { ...typography.bodyM, color: colors.accent, fontWeight: '700' },
  loginBtn: {
    height: 52, borderRadius: borderRadius.lg,
    backgroundColor: colors.accent, alignItems: 'center',
    justifyContent: 'center', width: '100%', ...shadows.button,
  },
  loginBtnText: { fontSize: 16, fontWeight: '800', color: colors.textInverse, letterSpacing: 0.5 },
});
