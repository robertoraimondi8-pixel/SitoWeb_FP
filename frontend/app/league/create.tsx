import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function CreateLeagueScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);

  useEffect(() => {
    apiCall('/leagues/seasons', { token }).then(setSeasons).catch(() => {});
  }, [token]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const seasonId = seasons[0]?.id;
      if (!seasonId) { Alert.alert(t('error'), 'No active season'); return; }
      const res = await apiCall('/leagues', { method: 'POST', token, body: { name, season_id: seasonId } });
      Alert.alert('Lega creata!', `Codice invito: ${res.invite_code}`);
      router.back();
    } catch (e: any) { Alert.alert(t('error'), e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t('create_league')}</Text>
        </View>

        <View style={s.content}>
          <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="shield-outline" size={22} color={colors.accent} />
            <TextInput testID="league-name-input" style={[s.input, { color: colors.text }]} placeholder={t('league_name')} placeholderTextColor={colors.textSecondary} value={name} onChangeText={setName} />
          </View>

          <TouchableOpacity testID="create-league-submit-btn" style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.background} /> : <Text style={[s.btnText, { color: colors.background }]}>{t('create')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  content: { padding: 24 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 20 },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  btn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
});
