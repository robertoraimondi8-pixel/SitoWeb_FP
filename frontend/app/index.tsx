import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color="#F5A623" />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
});
