import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius } from '../../src/theme/designSystem';
import * as WebBrowser from 'expo-web-browser';

export default function JoinLeagueScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [nationalLeagues, setNationalLeagues] = useState<any[]>([]);
  const [payLoading, setPayLoading] = useState<string | null>(null);

  useEffect(() => {
    apiCall('/leagues/national', { token }).then(setNationalLeagues).catch(() => {});
  }, [token]);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await apiCall('/leagues/join', { method: 'POST', token, body: { invite_code: code.trim().toUpperCase() } });
      Alert.alert('Entrato nella lega!');
      router.back();
    } catch (e: unknown) { Alert.alert(t('error'), e.message); }
    finally { setLoading(false); }
  };

  const handleNationalJoin = async (leagueId: string) => {
    setPayLoading(leagueId);
    try {
      const origin = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const res = await apiCall('/payments/checkout', {
        method: 'POST',
        token,
        body: { league_id: leagueId, origin_url: origin },
      });
      if (res.url) {
        await WebBrowser.openBrowserAsync(res.url);
      }
    } catch (e: unknown) { Alert.alert(t('error'), e.message); }
    finally { setPayLoading(null); }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: '#F5F6F8' }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={[s.header, { backgroundColor: '#F3F4F6' }]}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t('join_league')}</Text>
        </View>

        <ScrollView contentContainerStyle={s.content}>
          {/* National Leagues */}
          {nationalLeagues.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.accent }]}>{t('join_national')}</Text>
              {nationalLeagues.map(l => (
                  <View key={l.id} style={[s.nationalCard, { backgroundColor: '#1F4C8F', borderColor: colors.accent }]}>
                  <Ionicons name="globe" size={28} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nationalName, { color: '#FFFFFF' }]}>{l.name}</Text>
                    <Text style={[s.nationalMeta, { color: 'rgba(255,255,255,0.5)' }]}>{l.member_count} membri</Text>
                  </View>
                  <View>
                    <Text style={[s.price, { color: colors.accent }]}>{t('membership_price')}</Text>
                    <TouchableOpacity testID={`pay-national-${l.id}`} style={[s.payBtn, { backgroundColor: colors.accent }]} onPress={() => handleNationalJoin(l.id)} disabled={!!payLoading}>
                      {payLoading === l.id ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[s.payBtnText, { color: colors.background }]}>{t('pay_now')}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Private League Join */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.accent }]}>{t('invite_code')}</Text>
            <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="key-outline" size={22} color={colors.accent} />
              <TextInput testID="invite-code-input" style={[s.input, { color: colors.text }]} placeholder={t('invite_code')} placeholderTextColor={colors.textSecondary} value={code} onChangeText={setCode} autoCapitalize="characters" />
            </View>

            <TouchableOpacity testID="join-league-submit-btn" style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleJoin} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.background} /> : <Text style={[s.btnText, { color: colors.background }]}>{t('join')}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  content: { padding: 24, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  nationalCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  nationalName: { fontSize: 15, fontWeight: '600' },
  nationalMeta: { fontSize: 12 },
  price: { fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 6 },
  payBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  payBtnText: { fontSize: 13, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 20 },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  btn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
});
