import { Tabs, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { CompetitionProvider, useCompetition } from '../../src/contexts/CompetitionContext';

function TabContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mode, currentRoundInfo, leagueMatchdayInfo, setPendingMatchupOpen } = useCompetition();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#162F5C',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 0.5,
          height: 64,
          paddingBottom: 10,
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
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="statistics" options={{ title: t('tabs.statistics'), tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen
        name="predictions"
        options={{ title: t('tabs.predictions'), tabBarIcon: ({ color, size }) => <Ionicons name="football" size={size} color={color} /> }}
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
      <Tabs.Screen name="rankings" options={{ title: t('tabs.rankings'), tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <CompetitionProvider>
      <TabContent />
    </CompetitionProvider>
  );
}
