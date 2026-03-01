import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useLeague } from '../../src/contexts/LeagueContext';
import { colors, typography, spacing, borderRadius, brandGradients } from '../../src/theme/designSystem';

export default function MyLeaguesScreen() {
  const router = useRouter();
  const { leagues, activeLeague, setActiveLeague } = useLeague();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Le mie leghe</Text>
        <View style={{ width: 24 }} />
      </View>
      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        renderItem={({ item }) => {
          const isActive = activeLeague?.id === item.id;
          return (
            <TouchableOpacity
              style={[s.leagueCard, isActive && s.leagueCardActive]}
              onPress={() => { setActiveLeague(item); router.back(); }}
              data-testid={`league-${item.id}`}
            >
              <View style={s.leagueInfo}>
                <View style={s.leagueRow}>
                  <Ionicons name="trophy" size={18} color={isActive ? colors.accent : 'rgba(255,255,255,0.5)'} />
                  <Text style={[s.leagueName, isActive && s.leagueNameActive]}>{item.name}</Text>
                </View>
                <Text style={s.leagueMeta}>{item.member_count} partecipanti</Text>
              </View>
              {isActive && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>Non partecipi a nessuna lega</Text>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: 10 },
  leagueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  leagueCardActive: { borderWidth: 2, borderColor: colors.accent },
  leagueInfo: { flex: 1 },
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leagueName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  leagueNameActive: { color: colors.accent, fontWeight: '700' },
  leagueMeta: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginLeft: 28 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
});
