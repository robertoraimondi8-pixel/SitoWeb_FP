import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useLeague } from '../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../src/api/client';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { token, user, logout, handleAuthError } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();
  const [nationalLeagues, setNationalLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [lang, setLang] = useState(i18n.language);

  useEffect(() => {
    (async () => {
      try {
        const nls = await apiCall('/leagues/national', { token });
        setNationalLeagues(nls);
      } catch (e: any) { 
        if (isAuthError(e)) {
          const didLogout = await handleAuthError(e);
          if (didLogout) router.replace('/(auth)/login');
          return;
        }
        console.error(e); 
      }
      finally { setLoading(false); }
    })();
  }, [token, handleAuthError, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/');
  };

  const switchLang = (newLang: string) => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
    if (token) {
      apiCall('/profile', { method: 'PUT', token, body: { language: newLang } }).catch(() => {});
    }
  };

  const handleNational = async (leagueId: string) => {
    setPayLoading(true);
    try {
      await apiCall(`/leagues/${leagueId}/join-direct`, { method: 'POST', token });
      // Refresh leagues and go home
      if (token) await refreshLeagues(token);
      router.replace('/(tabs)/home');
    } catch (e: any) { Alert.alert('Errore', e.message); }
    finally { setPayLoading(false); }
  };

  const handleCreatePrivate = () => {
    router.push('/league/create');
  };

  const handleJoinPrivate = () => {
    router.push('/league/join-private');
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Top bar — pulsante Esci */}
        <View style={s.topBar}>
          <TouchableOpacity
            testID="onboarding-logout-btn"
            style={s.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
            <Text style={[s.logoutText, { color: colors.textSecondary }]}>Esci</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={s.headerSection}>
          <Image
            source={require('../assets/logo.png')}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={[s.welcome, { color: colors.text }]}>
            {t('onboarding_welcome')}, {user?.username}!
          </Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {t('onboarding_subtitle')}
          </Text>
        </View>

        {/* Language Selector */}
        <View style={s.langSection}>
          <Text style={[s.langLabel, { color: colors.textSecondary }]}>{t('language')}</Text>
          <View style={s.langRow}>
            {[{ code: 'it', flag: '🇮🇹', label: 'Italiano' }, { code: 'en', flag: '🇬🇧', label: 'English' }].map(l => (
              <TouchableOpacity
                key={l.code}
                testID={`onboarding-lang-${l.code}`}
                onPress={() => switchLang(l.code)}
                style={[
                  s.langChip,
                  { borderColor: lang === l.code ? colors.accent : colors.border },
                  lang === l.code && { backgroundColor: 'rgba(245,166,35,0.12)' },
                ]}
              >
                <Text style={s.flag}>{l.flag}</Text>
                <Text style={[s.langName, { color: lang === l.code ? colors.accent : colors.text }]}>{l.label}</Text>
                {lang === l.code && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Path A: National League */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>{t('onboarding_choose_path')}</Text>

        {nationalLeagues.map(nl => (
          <TouchableOpacity
            key={nl.id}
            testID="onboarding-national-btn"
            style={[s.pathCard, { backgroundColor: colors.card, borderColor: colors.accent }]}
            onPress={() => handleNational(nl.id)}
            disabled={payLoading}
            activeOpacity={0.85}
          >
            <View style={[s.pathIconWrap, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
              <Ionicons name="globe" size={28} color={colors.accent} />
            </View>
            <View style={s.pathContent}>
              <Text style={[s.pathTitle, { color: colors.text }]}>{t('onboarding_national_title')}</Text>
              <Text style={[s.pathDesc, { color: colors.textSecondary }]}>{t('onboarding_national_desc')}</Text>
              <View style={s.priceRow}>
                <Text style={[s.price, { color: colors.accent }]}>€20.00</Text>
                <Text style={[s.pricePer, { color: colors.textSecondary }]}>/ {t('onboarding_season')}</Text>
              </View>
            </View>
            {payLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={22} color={colors.accent} />
            )}
          </TouchableOpacity>
        ))}

        {/* Path B: Create Private League */}
        <TouchableOpacity
          testID="onboarding-create-private-btn"
          style={[s.pathCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleCreatePrivate}
          activeOpacity={0.85}
        >
          <View style={[s.pathIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Ionicons name="add-circle" size={28} color={colors.info} />
          </View>
          <View style={s.pathContent}>
            <Text style={[s.pathTitle, { color: colors.text }]}>{t('onboarding_create_title')}</Text>
            <Text style={[s.pathDesc, { color: colors.textSecondary }]}>{t('onboarding_create_desc')}</Text>
            <View style={[s.freeBadge, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Text style={[s.freeText, { color: colors.success }]}>{t('onboarding_free')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Path C: Join Private League */}
        <TouchableOpacity
          testID="onboarding-join-private-btn"
          style={[s.pathCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleJoinPrivate}
          activeOpacity={0.85}
        >
          <View style={[s.pathIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
            <Ionicons name="enter" size={28} color="#8B5CF6" />
          </View>
          <View style={s.pathContent}>
            <Text style={[s.pathTitle, { color: colors.text }]}>{t('onboarding_join_title')}</Text>
            <Text style={[s.pathDesc, { color: colors.textSecondary }]}>{t('onboarding_join_desc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingRight: 12 },
  logoutText: { fontSize: 14, fontWeight: '500' },
  headerSection: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 100, height: 80, borderRadius: 14, marginBottom: 16 },
  welcome: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 22 },
  langSection: { marginBottom: 28 },
  langLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 10 },
  langChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  flag: { fontSize: 20 },
  langName: { flex: 1, fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  pathCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 12, gap: 14 },
  pathIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pathContent: { flex: 1 },
  pathTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  pathDesc: { fontSize: 13, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  price: { fontSize: 18, fontWeight: '800' },
  pricePer: { fontSize: 12 },
  freeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  freeText: { fontSize: 12, fontWeight: '700' },
});
