/**
 * ForgotPasswordScreen — richiesta reset password
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiCall } from '../../src/api/client';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/designSystem';

const { width } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleSubmit = async () => {
    if (!isValidEmail(email)) { setError(t('forgot_password_screen.err_invalid_email')); return; }
    setLoading(true);
    setError('');
    try {
      await apiCall('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
        skipAuth: true,
      });
      setSent(true);
    } catch (e: unknown) {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={s.logoSection}>
            <Image
              source={require('../../assets/logo-full.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>

          <View style={s.card}>
            <View style={s.iconWrap}>
              <Ionicons name="mail" size={32} color={colors.accent} />
            </View>
            <Text style={s.title}>{t('forgot_password_screen.title')}</Text>
            <Text style={s.subtitle}>{t('forgot_password_screen.subtitle')}</Text>

            {sent ? (
              <View style={s.successBox}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={s.successText}>{t('forgot_password_screen.success_message')}</Text>
              </View>
            ) : (
              <>
                {error ? (
                  <View style={s.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={[s.inputRow, { borderColor: error ? colors.error : colors.border }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                  <TextInput
                    style={s.input}
                    placeholder={t('email')}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={v => { setEmail(v); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[s.btn, (!email || loading) && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={!email || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Text style={s.btnText}>{t('forgot_password_screen.submit_btn')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => router.back()} style={s.backLink}>
              <Text style={s.backLinkText}>{t('forgot_password_screen.back_to_login')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.xl },
  backBtn: { marginBottom: spacing.md },
  logoSection: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: width * 0.55, height: 120 },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: `${colors.accent}18`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.titleM, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.bodyS, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  successBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: `${colors.success}15`,
    borderRadius: borderRadius.md, padding: spacing.lg, width: '100%', marginBottom: spacing.lg,
  },
  successText: { flex: 1, ...typography.bodyS, color: colors.success, lineHeight: 20 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorLight, borderRadius: borderRadius.md,
    padding: spacing.md, width: '100%', marginBottom: spacing.md,
  },
  errorText: { flex: 1, ...typography.bodyS, color: colors.error },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    borderWidth: 1.5, borderRadius: borderRadius.lg,
    height: 54, paddingHorizontal: spacing.lg,
    gap: spacing.md, backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },
  input: { flex: 1, fontSize: 16, color: colors.textPrimary },
  btn: {
    height: 54, borderRadius: borderRadius.lg,
    backgroundColor: colors.accent, width: '100%',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg, ...shadows.button,
  },
  btnText: { fontSize: 15, fontWeight: '800', color: colors.textInverse, letterSpacing: 1 },
  backLink: { paddingVertical: spacing.sm },
  backLinkText: { ...typography.bodyM, color: colors.accent, fontWeight: '600' },
});
