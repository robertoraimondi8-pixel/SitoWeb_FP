import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { useCompetition } from '../../src/contexts/CompetitionContext';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

function ImpersonationBanner() {
  const [active, setActive] = useState(false);
  const [username, setUsername] = useState('');
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('impersonation_active').then(v => {
      if (v === 'true') {
        setActive(true);
        AsyncStorage.getItem('impersonation_username').then(u => setUsername(u || ''));
      }
    });
  }, []);

  if (!active) return null;

  const exitImpersonation = async () => {
    await AsyncStorage.removeItem('impersonation_active');
    await AsyncStorage.removeItem('impersonation_username');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.close();
    }
    router.replace('/(auth)/login');
    setTimeout(async () => {
      await logout();
    }, 200);
  };

  return (
    <View style={ib.banner} data-testid="impersonation-banner">
      <Text style={ib.text}>Stai navigando come: <Text style={ib.name}>{username}</Text> (Impersonazione Admin)</Text>
      <TouchableOpacity onPress={exitImpersonation} style={ib.btn} data-testid="exit-impersonation-btn">
        <Text style={ib.btnText}>Esci</Text>
      </TouchableOpacity>
    </View>
  );
}

const ib = StyleSheet.create({
  banner: { backgroundColor: '#D97706', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, gap: 12 },
  text: { color: '#0F172A', fontSize: 13, fontWeight: '500', flexShrink: 1 },
  name: { fontWeight: '800' },
  btn: { backgroundColor: '#0F172A', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: '#F5A623', fontSize: 12, fontWeight: '700' },
});

function TabContent() {
  // === DIAGNOSTIC: log typeof for every value from contexts ===
  const routerRaw = useRouter();
  const authRaw = useAuth();
  const compRaw = useCompetition();
  const insets = useSafeAreaInsets();

  // Destructure with safe fallbacks
  const router = routerRaw;
  const token = authRaw?.token ?? null;
  const mode = compRaw?.mode ?? 'league';
  const currentRoundInfo = compRaw?.currentRoundInfo ?? null;
  const leagueMatchdayInfo = compRaw?.leagueMatchdayInfo ?? null;
  const setPendingMatchupOpen = typeof compRaw?.setPendingMatchupOpen === 'function'
    ? compRaw.setPendingMatchupOpen
    : () => {};

  // Log diagnostics on every render (will show in Expo logs / Logcat)
  useEffect(() => {
    console.log('[TabContent-DIAG] v-EM-0326 render', JSON.stringify({
      router: typeof router?.push,
      'router.push': typeof router?.push,
      'router.navigate': typeof router?.navigate,
      'router.replace': typeof router?.replace,
      token: typeof token,
      tokenVal: token ? 'present' : 'null',
      mode: mode,
      authRaw_keys: authRaw ? Object.keys(authRaw) : 'NULL',
      'authRaw.logout': typeof authRaw?.logout,
      'authRaw.login': typeof authRaw?.login,
      'authRaw.loginWithToken': typeof authRaw?.loginWithToken,
      'authRaw.handleAuthError': typeof authRaw?.handleAuthError,
      compRaw_keys: compRaw ? Object.keys(compRaw) : 'NULL',
      'compRaw.setPendingMatchupOpen': typeof compRaw?.setPendingMatchupOpen,
      'compRaw.setLeagueMatchdayInfo': typeof compRaw?.setLeagueMatchdayInfo,
      currentRoundInfo: currentRoundInfo ? 'present' : 'null',
      leagueMatchdayInfo: leagueMatchdayInfo ? 'present' : 'null',
      'insets.bottom': insets?.bottom,
      platform: Platform.OS,
    }));
  });

  // Register for push notifications when user is authenticated
  if (typeof usePushNotifications === 'function') {
    usePushNotifications(token);
  } else {
    console.log('[TabContent-DIAG] usePushNotifications is NOT a function:', typeof usePushNotifications);
  }

  // Responsive tab bar
  const ANDROID_MIN_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const bottomInset = Math.max(insets?.bottom ?? 0, ANDROID_MIN_BOTTOM);
  const TAB_BAR_BASE_HEIGHT = 56;
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + bottomInset;

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#162F5C',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 0.5,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: '#F5A623',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="statistics" options={{ title: 'Statistiche', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen
        name="predictions"
        options={{ title: 'Pronostici', tabBarIcon: ({ color, size }) => <Ionicons name="football" size={size} color={color} /> }}
        listeners={{
          tabPress: (e) => {
            // Defensive: skip all logic if router is broken
            if (!router || typeof router.push !== 'function') {
              console.log('[TabContent-DIAG] tabPress: router.push is not a function!', typeof router?.push);
              return;
            }
            if (mode === 'league' && leagueMatchdayInfo) {
              const status = (leagueMatchdayInfo.status || '').toUpperCase();
              if (status === 'LIVE' || status === 'COMPLETED') {
                e.preventDefault();
                router.push(`/live/${leagueMatchdayInfo.matchdayId}?league_id=${leagueMatchdayInfo.leagueId}` as any);
              }
            } else if (mode === 'tournament' && currentRoundInfo) {
              const status = (currentRoundInfo.status || '').toUpperCase();
              if ((status === 'LIVE' || status === 'COMPLETED') && currentRoundInfo.matchup_id) {
                e.preventDefault();
                setPendingMatchupOpen(currentRoundInfo.matchup_id);
                if (typeof router.navigate === 'function') {
                  router.navigate('/(tabs)/home' as any);
                }
              }
            }
          },
        }}
      />
      <Tabs.Screen name="rankings" options={{ title: 'Classifica', tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilo', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <>
      <ImpersonationBanner />
      <TabContent />
    </>
  );
}
