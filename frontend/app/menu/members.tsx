import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

type Member = {
  user_id: string;
  username: string;
  email: string;
  role: string;
  joined_at: string;
};

export default function MembersScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { activeLeague } = useLeague();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState('');

  useEffect(() => {
    if (!activeLeague || !token) return;
    (async () => {
      try {
        const data = await apiCall(`/leagues/${activeLeague.id}/members`, { token });
        setMembers(data.members || []);
        setLeagueName(data.league_name || activeLeague.name);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLeague, token]);

  const getRoleBadge = (role: string) => {
    if (role === 'owner' || role === 'admin') return { label: 'Creatore', color: colors.accent };
    return null;
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Partecipanti</Text>
        <View style={{ width: 24 }} />
      </View>
      {leagueName && <Text style={s.subtitle}>{leagueName}</Text>}
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={s.content}
          renderItem={({ item, index }) => {
            const badge = getRoleBadge(item.role);
            return (
              <View style={s.memberCard} data-testid={`member-${item.user_id}`}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{(item.username || '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={s.memberInfo}>
                  <View style={s.nameRow}>
                    <Text style={s.memberName}>{item.username}</Text>
                    {badge && (
                      <View style={[s.badge, { backgroundColor: badge.color }]}>
                        <Text style={s.badgeText}>{badge.label}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={s.rank}>#{index + 1}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>Nessun partecipante</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  subtitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  content: { padding: spacing.lg, gap: 8 },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.card },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  memberInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
  rank: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
});
