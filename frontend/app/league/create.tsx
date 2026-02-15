import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function CreateLeagueScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [created, setCreated] = useState<any>(null);

  useEffect(() => {
    apiCall('/leagues/seasons', { token }).then(setSeasons).catch(() => {});
  }, [token]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const seasonId = seasons[0]?.id;
      if (!seasonId) return;
      const res = await apiCall('/leagues', {
        method: 'POST',
        token,
        body: { name: name.trim(), season_id: seasonId },
      });
      if (token) await refreshLeagues(token);
      setCreated(res);
    } catch (e: any) {
      // Show error inline
      setCreated(null);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!created?.invite_code) return;
    try {
      await Share.share({
        message: `${t('league_share_message')} ${created.name}\n${t('invite_code')}: ${created.invite_code}`,
      });
    } catch (e) { /* ignore */ }
  };

  const goHome = () => {
    router.replace('/(tabs)/home');
  };

  // Success state
  if (created) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.successContent}>
          <View style={[s.successIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={[s.successTitle, { color: colors.text }]}>{t('league_created_title')}</Text>
          <Text style={[s.successDesc, { color: colors.textSecondary }]}>{t('league_created_desc')}</Text>

          <View style={[s.codeCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
            <Text style={[s.codeLabel, { color: colors.textSecondary }]}>{t('invite_code')}</Text>
            <Text style={[s.codeValue, { color: colors.accent }]}>{created.invite_code}</Text>
          </View>

          <TouchableOpacity
            testID="share-code-btn"
            style={[s.shareBtn, { backgroundColor: colors.accent }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={colors.background} />
            <Text style={[s.shareBtnText, { color: colors.background }]}>{t('share')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="go-home-btn"
            style={[s.homeBtn, { borderColor: colors.border }]}
            onPress={goHome}
          >
            <Text style={[s.homeBtnText, { color: colors.text }]}>{t('back_home')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t('create_league')}</Text>
          <View style={s.backBtn} />
        </View>

        <View style={s.content}>
          <View style={[s.illustration, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
            <Ionicons name="shield-checkmark" size={48} color={colors.info} />
          </View>

          <Text style={[s.desc, { color: colors.textSecondary }]}>
            {t('onboarding_create_desc')}
          </Text>

          <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="create-outline" size={20} color={colors.accent} />
            <TextInput
              testID="league-name-input"
              style={[s.input, { color: colors.text }]}
              placeholder={t('league_name')}
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              maxLength={40}
            />
          </View>

          <TouchableOpacity
            testID="create-league-submit-btn"
            style={[s.btn, { backgroundColor: name.trim().length >= 3 ? colors.accent : colors.border }]}
            onPress={handleCreate}
            disabled={loading || name.trim().length < 3}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={[s.btnText, { color: colors.background }]}>{t('create').toUpperCase()}</Text>
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
  illustration: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  desc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 54, marginBottom: 24, width: '100%', gap: 10 },
  input: { flex: 1, fontSize: 16 },
  btn: { width: '100%', height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  successContent: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
  successDesc: { fontSize: 15, textAlign: 'center', marginBottom: 32 },
  codeCard: { width: '100%', padding: 20, borderRadius: 16, borderWidth: 2, alignItems: 'center', marginBottom: 24 },
  codeLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  codeValue: { fontSize: 36, fontWeight: '900', letterSpacing: 4 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 54, borderRadius: 14, marginBottom: 12 },
  shareBtnText: { fontSize: 16, fontWeight: '700' },
  homeBtn: { width: '100%', height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { fontSize: 15, fontWeight: '600' },
});
