/**
 * VerifyEmailScreen — schermata verifica email
 *
 * Flusso:
 *  1. Mostrata dopo registrazione manuale (email_verified = false)
 *  2. Mostrata ad ogni login se email_verified = false (gate globale in index.tsx)
 *
 * In versione beta: la verifica email è SIMULATA — il token viene loggato sul server.
 * L'utente incolla il token dal log → clic "Verifica" → backend aggiorna email_verified.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Dimensions, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/api/client';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, borderRadius, shadows, typography } from '../src/theme/designSystem';

const { width } = Dimensions.get('window');

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email: paramEmail } = useLocalSearchParams<{ email: string }>();
  const { user, updateUser } = useAuth();

  // Prefer email from auth context (available when routed from login gate),
  // fallback to URL param (available when routed right after registration)
  const emailToShow = user?.email ?? paramEmail ?? '';

  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ─── Verify token ────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const t = token.trim();
    if (!t) { setErrorMsg('Incolla il token di verifica.'); return; }
    setVerifying(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiCall('/auth/verify-email', {
        method: 'POST',
        body: { token: t },
        skipAuth: true,
      });
      // Update auth context so the routing gate lets the user through
      updateUser({ email_verified: true });
      setSuccessMsg('Email verificata! Reindirizzamento in corso…');
      setTimeout(() => router.replace('/'), 1200);
    } catch (e: unknown) {
      setErrorMsg(e.message || 'Token non valido o scaduto.');
    } finally {
      setVerifying(false);
    }
  };

  // ─── Resend ───────────────────────────────────────────────────────────────
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
      setSuccessMsg('Nuovo token generato. Controlla i log del server.');
    } catch (e: unknown) {
      setErrorMsg(e.message || 'Errore. Riprova più tardi.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <Image
          source={require('../assets/logo-full.png')}
          style={s.logo}
          resizeMode="contain"
        />

        {/* Mail icon */}
        <View style={s.iconWrap}>
          <Ionicons name="mail-open-outline" size={52} color={colors.accent} />
        </View>

        <Text style={s.title}>Verifica email</Text>

        {emailToShow ? (
          <Text style={s.email}>{emailToShow}</Text>
        ) : null}

        {/* ── BANNER BETA ── */}
        <View style={s.betaBanner}>
          <Ionicons name="flask-outline" size={18} color={colors.warning ?? '#F59E0B'} />
          <View style={{ flex: 1 }}>
            <Text style={s.betaTitle}>Versione beta — verifica simulata</Text>
            <Text style={s.betaDesc}>
              In questa versione di test l'email non viene inviata realmente.{'\n'}
              Il token di verifica è visibile nei log del server.{'\n\n'}
              <Text style={{ fontWeight: '700' }}>Come usarlo:</Text>
              {'\n'}1. Apri i log backend{'\n'}2. Cerca la riga{' '}
              <Text style={s.codeText}>[EMAIL-VERIFY] token=…</Text>
              {'\n'}3. Copia il token e incollalo qui sotto.
            </Text>
          </View>
        </View>

        {/* ── TOKEN INPUT ── */}
        <View style={s.tokenSection}>
          <Text style={s.tokenLabel}>Token di verifica</Text>
          <View style={[s.tokenInputWrap, errorMsg ? { borderColor: colors.error } : null]}>
            <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
            <TextInput
              style={s.tokenInput}
              placeholder="Incolla il token dal log del server"
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

        {/* ── VERIFY BUTTON ── */}
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
              <Text style={s.verifyBtnText}>Verifica Email</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── RESEND BUTTON ── */}
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
              <Text style={s.resendBtnText}>Genera nuovo token</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── GO TO LOGIN ── */}
        <TouchableOpacity
          style={s.loginLink}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.7}
        >
          <Text style={s.loginLinkText}>
            Torna al Login
          </Text>
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

  // ── Beta Banner ──
  betaBanner: {
    flexDirection: 'row', gap: spacing.md,
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl, width: '100%',
  },
  betaTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: spacing.xs },
  betaDesc: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  codeText: { fontFamily: 'monospace', backgroundColor: '#FDE68A', color: '#78350F', fontSize: 11 },

  // ── Token Input ──
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

  // ── Feedback Banners ──
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

  // ── Buttons ──
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
