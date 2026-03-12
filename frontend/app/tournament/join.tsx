import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../src/theme/designSystem';

export default function JoinTournamentScreen() {
  const { token } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const all = await apiCall('/tournaments', { token });
        setTournaments((all || []).filter((t: any) => t.status === 'registration'));
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, [token]);

  const handleJoin = async (tournId: string) => {
    setJoining(tournId);
    try {
      await apiCall(`/tournaments/${tournId}/register`, { method: 'POST', token });
      if (token) await refreshLeagues(token);
      Alert.alert('Iscritto!', 'Sei stato iscritto al torneo con successo.');
      router.replace('/(tabs)/home');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile iscriversi');
    } finally { setJoining(null); }
  };

  const handleCode = async () => {
    if (!code.trim()) return;
    setJoining('code');
    try {
      // Try to find tournament by code (id or invite_code)
      const res = await apiCall(`/tournaments/join-by-code`, { method: 'POST', token, body: { code: code.trim() } });
      if (token) await refreshLeagues(token);
      Alert.alert('Iscritto!', 'Sei entrato nel torneo.');
      router.replace('/(tabs)/home');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Codice non valido');
    } finally { setJoining(null); }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="back-btn">
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Entra in un Torneo</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Code Input Section */}
        <View style={s.codeSection}>
          <View style={s.codeIcon}>
            <Ionicons name="key" size={24} color={colors.accent} />
          </View>
          <Text style={s.codeTitle}>Hai un codice invito?</Text>
          <Text style={s.codeDesc}>Inserisci il codice per entrare in un torneo privato</Text>
          <View style={s.codeRow}>
            <TextInput
              style={s.codeInput}
              placeholder="Inserisci codice"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              data-testid="tournament-code-input"
            />
            <TouchableOpacity
              style={[s.codeBtn, !code.trim() && { opacity: 0.5 }]}
              onPress={handleCode}
              disabled={!code.trim() || joining === 'code'}
              data-testid="tournament-code-submit"
            >
              {joining === 'code' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.codeBtnText}>Entra</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Available Tournaments */}
        <Text style={s.sectionLabel}>TORNEI DISPONIBILI</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 32 }} />
        ) : tournaments.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Nessun torneo disponibile</Text>
            <Text style={s.emptyDesc}>Non ci sono tornei con iscrizioni aperte al momento. Riprova più tardi!</Text>
          </View>
        ) : (
          tournaments.map(t => {
            const spotsLeft = t.max_participants - (t.registered_count || 0);
            const almostFull = spotsLeft <= 3;
            return (
              <TouchableOpacity
                key={t.id}
                style={s.tournCard}
                onPress={() => handleJoin(t.id)}
                disabled={!!joining}
                activeOpacity={0.85}
                data-testid={`join-tourn-${t.id}`}
              >
                <View style={s.tournIcon}>
                  <Ionicons name="trophy" size={24} color={colors.accent} />
                </View>
                <View style={s.tournContent}>
                  <Text style={s.tournName}>{t.name}</Text>
                  <View style={s.tournMeta}>
                    <View style={s.metaChip}>
                      <Ionicons name="people" size={12} color={colors.textSecondary} />
                      <Text style={s.metaText}>{t.registered_count || 0}/{t.max_participants}</Text>
                    </View>
                    <View style={s.metaChip}>
                      <Ionicons name="grid" size={12} color={colors.textSecondary} />
                      <Text style={s.metaText}>{t.groups_count} gironi</Text>
                    </View>
                    {t.entry_fee > 0 && (
                      <View style={[s.metaChip, { backgroundColor: 'rgba(245,166,35,0.1)' }]}>
                        <Text style={[s.metaText, { color: colors.accent, fontWeight: '700' }]}>{t.entry_fee.toFixed(2)} EUR</Text>
                      </View>
                    )}
                  </View>
                  {almostFull && <Text style={s.almostFull}>Ultimi {spotsLeft} posti!</Text>}
                  {!t.entry_fee && (
                    <View style={s.freeBadge}>
                      <Text style={s.freeText}>GRATIS</Text>
                    </View>
                  )}
                </View>
                {joining === t.id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="chevron-forward" size={22} color={colors.accent} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8e8e8' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  scroll: { padding: 20, paddingBottom: 40 },

  codeSection: { backgroundColor: '#1F4C8F', borderRadius: 16, padding: 20, marginBottom: 24, alignItems: 'center' },
  codeIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(245,166,35,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  codeTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  codeDesc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 16 },
  codeRow: { flexDirection: 'row', gap: 10, width: '100%' },
  codeInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', fontWeight: '600', letterSpacing: 1.5 },
  codeBtn: { backgroundColor: colors.accent, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  tournCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e8e8e8', gap: 14 },
  tournIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(245,166,35,0.08)', alignItems: 'center', justifyContent: 'center' },
  tournContent: { flex: 1 },
  tournName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  tournMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F6F8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  metaText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  almostFull: { fontSize: 11, fontWeight: '700', color: '#ef4444', marginTop: 4 },
  freeBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  freeText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
});
