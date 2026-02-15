import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.30, 140);

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lang, setLang] = useState('it');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!email || !username || !password) return;
    setLoading(true);
    setError('');
    try {
      await register(email, username, password, lang);
      i18n.changeLanguage(lang);
      router.replace('/onboarding');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo - Same as Login */}
        <View style={s.logoWrap}>
          <Image
            testID="register-logo"
            source={require('../../assets/logo.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        <View style={[s.card, { backgroundColor: colors.card }]}>
          <Text style={[s.cardTitle, { color: colors.text }]}>{t('register')}</Text>
          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={[s.inputWrap, { borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <TextInput testID="register-email-input" style={[s.input, { color: colors.text }]} placeholder={t('email')} placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={[s.inputWrap, { borderColor: colors.border }]}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            <TextInput testID="register-username-input" style={[s.input, { color: colors.text }]} placeholder={t('username')} placeholderTextColor={colors.textSecondary} value={username} onChangeText={setUsername} autoCapitalize="none" />
          </View>

          <View style={[s.inputWrap, { borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <TextInput testID="register-password-input" style={[s.input, { color: colors.text }]} placeholder={t('password')} placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <View style={s.langRow}>
            <Text style={[s.langLabel, { color: colors.textSecondary }]}>{t('language')}:</Text>
            {['it', 'en'].map(l => (
              <TouchableOpacity key={l} testID={`lang-${l}-btn`} onPress={() => setLang(l)} style={[s.langBtn, lang === l && { backgroundColor: colors.accent }]}>
                <Text style={[s.langText, { color: lang === l ? colors.background : colors.text }]}>{l.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="register-submit-btn" style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={[s.btnText, { color: colors.background }]}>{t('register').toUpperCase()}</Text>}
          </TouchableOpacity>

          <TouchableOpacity testID="go-to-login-btn" onPress={() => router.back()} style={s.linkWrap}>
            <Text style={[s.link, { color: colors.textSecondary }]}>{t('have_account')} </Text>
            <Text style={[s.linkAccent, { color: colors.accent }]}>{t('login')}</Text>
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
  langRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  langLabel: { fontSize: 14 },
  langBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  langText: { fontSize: 14, fontWeight: '600' },
  btn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  linkWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  link: { fontSize: 14 },
  linkAccent: { fontSize: 14, fontWeight: '600' },
});
