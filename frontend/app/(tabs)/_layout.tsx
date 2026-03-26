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
  const router = useRouter();
  const { token } = useAuth();
  const { mode, currentRoundInfo, leagueMatchdayInfo, setPendingMatchupOpen } = useCompetition();
  const insets = useSafeAreaInsets();

  // Register for push notifications when user is authenticated
  usePushNotifications(token);

  // Responsive tab bar: manual safe area handling
  // Disable React Navigation's automatic safe area (safeAreaInsets: {bottom: 0})
  // and calculate manually to avoid double-padding on some devices
  const ANDROID_MIN_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const bottomInset = Math.max(insets.bottom, ANDROID_MIN_BOTTOM);
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
            // ═══ DYNAMIC ROUTING for Pronostici tab ═══
            // Resolves destination based on competition type + matchday state
            if (mode === 'league' && leagueMatchdayInfo) {
              const status = leagueMatchdayInfo.status?.toUpperCase();
              if (status === 'LIVE' || status === 'COMPLETED') {
                e.preventDefault();
                router.push(`/live/${leagueMatchdayInfo.matchdayId}?league_id=${leagueMatchdayInfo.leagueId}` as any);
              }
              // OPEN / LOCKED → default behavior (predictions form)
            } else if (mode === 'tournament' && currentRoundInfo) {
              const status = currentRoundInfo.status?.toUpperCase();
              if ((status === 'LIVE' || status === 'COMPLETED') && currentRoundInfo.matchup_id) {
                e.preventDefault();
                setPendingMatchupOpen(currentRoundInfo.matchup_id);
                router.navigate('/(tabs)/home' as any);
              }
              // OPEN / PENDING → default behavior (predictions form)
            }
            // No cached info → default behavior (predictions screen handles fallback)
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
