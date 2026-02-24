import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

type Notification = {
  id: string;
  title?: string;
  message: string;
  read: boolean;
  created_at: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await apiCall<Notification[]>('/notifications', { token });
        setNotifs(data);
        // Mark all as read when page opens
        await apiCall('/notifications/read-all', { token, method: 'PATCH' }).catch(() => {});
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const markRead = async (id: string) => {
    try {
      await apiCall(`/notifications/${id}/read`, { token, method: 'PATCH' });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifiche</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.content}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.notifCard, !item.read && s.notifUnread]}
              onPress={() => !item.read && markRead(item.id)}
              testID={`notif-${item.id}`}
            >
              <View style={[s.dot, item.read && s.dotRead]} />
              <View style={s.notifBody}>
                {item.title && <Text style={s.notifTitle}>{item.title}</Text>}
                <Text style={s.notifMessage}>{item.message}</Text>
                <Text style={s.notifDate}>{formatDate(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.border} />
              <Text style={s.empty}>Nessuna notifica</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: 8 },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.card },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 },
  dotRead: { backgroundColor: colors.border },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  notifMessage: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  notifDate: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10 },
  empty: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
});
