import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, token, logout, handleAuthError } = useAuth();
  const router = useRouter();
  const [leagueCount, setLeagueCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const p = await apiCall('/profile', { token });
        setLeagueCount(p.leagues_count);
      } catch (e: any) { 
        if (isAuthError(e)) {
          await handleAuthError(e);
          router.replace('/(auth)/login');
          return;
        }
        console.error(e); 
      }
    })();
  }, [token, handleAuthError, router]);

  const switchLang = () => {
    const newLang = i18n.language === 'it' ? 'en' : 'it';
    i18n.changeLanguage(newLang);
    apiCall('/profile', { method: 'PUT', token, body: { language: newLang } }).catch(() => {});
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <View style={[s.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[s.avatarText, { color: colors.background }]}>{user?.username?.[0]?.toUpperCase()}</Text>
          </View>
          <Text style={[s.username, { color: colors.text }]}>{user?.username}</Text>
          <Text style={[s.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>

        <View style={[s.statsRow, { backgroundColor: colors.card }]}>
          <View style={s.statItem}>
            <Text style={[s.statNum, { color: colors.accent }]}>{leagueCount}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>{t('my_leagues')}</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <View style={s.statItem}>
            <Text style={[s.statNum, { color: colors.accent }]}>{user?.role}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Ruolo</Text>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: colors.card }]}>
          <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>{t('settings')}</Text>

          <View style={s.settingRow}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={colors.accent} />
            <Text style={[s.settingLabel, { color: colors.text }]}>{isDark ? t('dark_mode') : t('light_mode')}</Text>
            <Switch testID="theme-toggle" value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#ccc', true: colors.accent }} thumbColor="#fff" />
          </View>

          <TouchableOpacity testID="lang-toggle-btn" style={s.settingRow} onPress={switchLang}>
            <Ionicons name="language" size={22} color={colors.accent} />
            <Text style={[s.settingLabel, { color: colors.text }]}>{t('language')}</Text>
            <View style={[s.langChip, { backgroundColor: colors.background }]}>
              <Text style={[s.langChipText, { color: colors.accent }]}>{i18n.language.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[s.section, { backgroundColor: colors.card }]}>
          <TouchableOpacity testID="create-league-profile-btn" style={s.settingRow} onPress={() => router.push('/league/create')}>
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
            <Text style={[s.settingLabel, { color: colors.text }]}>{t('create_league')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity testID="join-league-profile-btn" style={s.settingRow} onPress={() => router.push('/league/join')}>
            <Ionicons name="enter-outline" size={22} color={colors.accent} />
            <Text style={[s.settingLabel, { color: colors.text }]}>{t('join_league')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity testID="logout-btn" style={[s.logoutBtn, { borderColor: colors.error }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[s.logoutText, { color: colors.error }]}>{t('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: { alignItems: 'center', marginBottom: 24, paddingTop: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800' },
  username: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, marginTop: 2 },
  statsRow: { flexDirection: 'row', borderRadius: 14, padding: 16, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 4 },
  section: { borderRadius: 14, padding: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, gap: 12 },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  langChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  langChipText: { fontSize: 13, fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  logoutText: { fontSize: 15, fontWeight: '600' },
});
