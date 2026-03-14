import { Stack } from 'expo-router';

export default function LeagueLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create" />
      <Stack.Screen name="join" />
      <Stack.Screen name="join-private" />
      <Stack.Screen name="list" />
      <Stack.Screen name="payment-success" />
      <Stack.Screen name="[id]/manage" />
    </Stack>
  );
}
