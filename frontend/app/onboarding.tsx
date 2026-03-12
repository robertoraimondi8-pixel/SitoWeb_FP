import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Alert, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { useLeague } from '../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, brandGradients } from '../src/theme/designSystem';
import { BrandLogo } from '../src/components/BrandLogo';

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const { token, user, logout, handleAuthError } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();
  const [nationalLeagues, setNationalLeagues] = useState<any[]>([]);
  const [availableTournaments, setAvailableTournaments] = useState<any[]>([]);
  const [showTournaments, setShowTournaments] = useState(false);
  const [tournCode, setTournCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [lang, setLang] = useState(i18n.language);

  // Auth guard: usa AsyncStorage (non React state) per evitare race condition
  // React state può essere null al primo render anche se loginWithToken ha già salvato il token
  useEffect(() => {
    (async () => {
      const tok = await AsyncStorage.getItem('access_token');
      if (!tok) router.replace('/(auth)/');
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [nls, tournaments] = await Promise.all([
          apiCall('/leagues/national', { token }),
          apiCall('/tournaments', { token }).catch(() => []),
        ]);
        setNationalLeagues(nls);
        // Filter only tournaments with open registration
        const open = (tournaments || []).filter((t: any) => t.status === 'registration');
        setAvailableTournaments(open);
      } catch (e: unknown) { 
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

  const handleJoinTournament = async (tournId: string) => {
    setPayLoading(true);
    try {
      await apiCall(`/tournaments/${tournId}/register`, { method: 'POST', token });
      Alert.alert('Iscritto!', 'Sei stato iscritto al torneo con successo.');
      if (token) await refreshLeagues(token);
      router.replace('/(tabs)/home');
    } catch (e: any) { Alert.alert('Errore', e.message || 'Impossibile iscriversi'); }
    finally { setPayLoading(false); }
  };

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
    } catch (e: unknown) { Alert.alert('Errore', e.message); }
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
      <View style={[s.center, { backgroundColor: '#F5F6F8' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: '#F5F6F8' }]} edges={['top', 'bottom']}>
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
            <Text style={[s.logoutText, { color: colors.textSecondary }]}>{t('onboarding.logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={s.headerSection}>
          <BrandLogo variant="wordmark" size="lg" />
          <Text style={[s.welcome, { color: colors.textPrimary }]}>
            {t('onboarding.welcome')}, {user?.username}!
          </Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {t('onboarding.subtitle')}
          </Text>
        </View>

        {/* Language Selector */}
        <View style={s.langSection}>
          <Text style={[s.langLabel, { color: colors.textSecondary }]}>{t('language')}</Text>
          <View style={s.langRow}>
            {[
              { code: 'it', flag: '🇮🇹', label: 'Italiano' },
              { code: 'en', flag: '🇬🇧', label: 'English' },
              { code: 'es', flag: '🇪🇸', label: 'Español' },
            ].map(l => (
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
                <Text style={[s.langName, { color: lang === l.code ? colors.accent : colors.textPrimary }]}>{l.label}</Text>
                {lang === l.code && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Path A: National League */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>{t('onboarding.choose_path')}</Text>

        {nationalLeagues.map(nl => (
          <TouchableOpacity
            key={nl.id}
            testID="onboarding-national-btn"
            style={[s.pathCard, { backgroundColor: '#1F4C8F', borderColor: colors.accent }]}
            onPress={() => handleNational(nl.id)}
            disabled={payLoading}
            activeOpacity={0.85}
          >
            <View style={[s.pathIconWrap, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
              <Ionicons name="globe" size={28} color={colors.accent} />
            </View>
            <View style={s.pathContent}>
              <Text style={[s.pathTitle, { color: '#FFFFFF' }]}>{t('onboarding.national_title')}</Text>
              <Text style={[s.pathDesc, { color: 'rgba(255,255,255,0.5)' }]}>{t('onboarding.national_desc')}</Text>
              <View style={[s.freeBadge, { backgroundColor: 'rgba(16,185,129,0.12)', marginTop: 6 }]}>
                <Text style={[s.freeText, { color: colors.success }]}>{t('onboarding.free')}</Text>
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
          style={[s.pathCard, { backgroundColor: '#1F4C8F', borderColor: 'rgba(255,255,255,0.08)' }]}
          onPress={handleCreatePrivate}
          activeOpacity={0.85}
        >
          <View style={[s.pathIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Ionicons name="add-circle" size={28} color={colors.info} />
          </View>
          <View style={s.pathContent}>
            <Text style={[s.pathTitle, { color: '#FFFFFF' }]}>{t('onboarding.create_title')}</Text>
            <Text style={[s.pathDesc, { color: 'rgba(255,255,255,0.5)' }]}>{t('onboarding.create_desc')}</Text>
            <View style={[s.freeBadge, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Text style={[s.freeText, { color: colors.success }]}>{t('onboarding.free')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Path C: Join Private League */}
        <TouchableOpacity
          testID="onboarding-join-private-btn"
          style={[s.pathCard, { backgroundColor: '#1F4C8F', borderColor: 'rgba(255,255,255,0.08)' }]}
          onPress={handleJoinPrivate}
          activeOpacity={0.85}
        >
          <View style={[s.pathIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
            <Ionicons name="enter" size={28} color="#8B5CF6" />
          </View>
          <View style={s.pathContent}>
            <Text style={[s.pathTitle, { color: '#FFFFFF' }]}>{t('onboarding.join_title')}</Text>
            <Text style={[s.pathDesc, { color: 'rgba(255,255,255,0.5)' }]}>{t('onboarding.join_desc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Path D: Join Tournament */}
        <TouchableOpacity
          testID="onboarding-join-tournament-btn"
          style={[s.pathCard, { backgroundColor: '#1F4C8F', borderColor: showTournaments ? colors.accent : 'rgba(255,255,255,0.08)' }]}
          onPress={() => setShowTournaments(!showTournaments)}
          activeOpacity={0.85}
        >
          <View style={[s.pathIconWrap, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
            <Ionicons name="trophy" size={28} color={colors.accent} />
          </View>
          <View style={s.pathContent}>
            <Text style={[s.pathTitle, { color: '#FFFFFF' }]}>Entra in un Torneo</Text>
            <Text style={[s.pathDesc, { color: 'rgba(255,255,255,0.5)' }]}>Sfida altri giocatori in tornei a eliminazione diretta</Text>
          </View>
          <Ionicons name={showTournaments ? 'chevron-down' : 'chevron-forward'} size={22} color={colors.accent} />
        </TouchableOpacity>

        {/* Tournament list (expandable) */}
        {showTournaments && (
          <View style={{ marginBottom: 16, marginTop: -4 }}>
            {availableTournaments.length > 0 ? (
              availableTournaments.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  onPress={() => handleJoinTournament(t.id)}
                  disabled={payLoading}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(31,76,143,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trophy" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{t.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t.registered_count || 0}/{t.max_participants} iscritti</Text>
                  </View>
                  {t.entry_fee > 0 ? (
                    <View style={{ backgroundColor: 'rgba(245,166,35,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>{t.entry_fee.toFixed(2)} EUR</Text>
                    </View>
                  ) : (
                    <View style={[s.freeBadge, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                      <Text style={[s.freeText, { color: colors.success }]}>GRATIS</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="trophy-outline" size={32} color={colors.textMuted} />
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>Nessun torneo disponibile al momento</Text>
              </View>
            )}

            {/* Code input */}
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hai un codice invito?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: '#F5F6F8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
                  placeholder="Inserisci codice torneo"
                  value={tournCode}
                  onChangeText={setTournCode}
                  autoCapitalize="characters"
                  data-testid="tournament-code-input"
                />
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => {
                    if (!tournCode.trim()) return;
                    Alert.alert('Info', 'Funzionalità codice torneo in arrivo');
                  }}
                  data-testid="tournament-code-submit"
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Entra</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
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
