import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <View style={[s.logoCircle, { backgroundColor: colors.accent }]}>
            <Ionicons name="football" size={48} color={colors.background} />
          </View>
          <Text style={[s.title, { color: colors.accent }]}>FANTA</Text>
          <Text style={[s.subtitle, { color: colors.text }]}>Pronostic</Text>
        </View>

        <View style={[s.card, { backgroundColor: colors.card }]}>
          <Text style={[s.cardTitle, { color: colors.text }]}>{t('login')}</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={[s.inputWrap, { borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <TextInput
              testID="login-email-input"
              style={[s.input, { color: colors.text }]}
              placeholder={t('email')}
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[s.inputWrap, { borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <TextInput
              testID="login-password-input"
              style={[s.input, { color: colors.text }]}
              placeholder={t('password')}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity testID="login-submit-btn" style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={[s.btnText, { color: colors.background }]}>{t('login').toUpperCase()}</Text>}
          </TouchableOpacity>

          <TouchableOpacity testID="go-to-register-btn" onPress={() => router.push('/(auth)/register')} style={s.linkWrap}>
            <Text style={[s.link, { color: colors.textSecondary }]}>{t('no_account')} </Text>
            <Text style={[s.linkAccent, { color: colors.accent }]}>{t('register')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: 2 },
  subtitle: { fontSize: 28, fontWeight: '300', marginTop: -4 },
  card: { borderRadius: 16, padding: 24 },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, marginBottom: 14, height: 52 },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  btn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  linkWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  link: { fontSize: 14 },
  linkAccent: { fontSize: 14, fontWeight: '600' },
});
