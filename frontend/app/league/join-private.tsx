import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function JoinPrivateScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await apiCall('/leagues/join', {
        method: 'POST',
        token,
        body: { invite_code: code.trim().toUpperCase() },
      });
      if (token) await refreshLeagues(token);
      Alert.alert(
        t('league_joined_title'),
        `${t('league_joined_desc')} ${res.league?.name || ''}`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
      );
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t('join_private_title')}</Text>
          <View style={s.backBtn} />
        </View>

        <View style={s.content}>
          <View style={[s.illustration, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
            <Ionicons name="key" size={48} color="#8B5CF6" />
          </View>

          <Text style={[s.desc, { color: colors.textSecondary }]}>
            {t('join_private_desc')}
          </Text>

          <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              testID="join-code-input"
              style={[s.codeInput, { color: colors.text }]}
              placeholder="XXXXXXXX"
              placeholderTextColor={colors.textSecondary}
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
              textAlign="center"
            />
          </View>

          <TouchableOpacity
            testID="join-submit-btn"
            style={[s.btn, { backgroundColor: code.trim().length >= 4 ? colors.accent : colors.border }]}
            onPress={handleJoin}
            disabled={loading || code.trim().length < 4}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[s.btnText, { color: colors.background }]}>{t('join').toUpperCase()}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  illustration: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  desc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  inputWrap: { borderWidth: 1.5, borderRadius: 16, width: '100%', marginBottom: 24 },
  codeInput: { fontSize: 28, fontWeight: '800', letterSpacing: 6, paddingVertical: 18, paddingHorizontal: 20 },
  btn: { width: '100%', height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
