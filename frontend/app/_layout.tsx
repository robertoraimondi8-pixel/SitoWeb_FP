import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { LeagueProvider } from '../src/contexts/LeagueContext';
import '../src/i18n';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LeagueProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="complete-profile" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="live/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="league" options={{ presentation: 'modal' }} />
          </Stack>
        </LeagueProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
