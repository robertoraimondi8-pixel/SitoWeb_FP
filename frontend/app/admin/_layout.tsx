/**
 * Admin Layout - Expo Router Stack Navigation for Admin Routes
 * Enables /admin, /admin/tournaments, /admin/league sub-routes
 */
import { Stack } from 'expo-router';
import { colors } from '../../src/theme/designSystem';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="tournaments" />
      <Stack.Screen name="league" />
    </Stack>
  );
}
