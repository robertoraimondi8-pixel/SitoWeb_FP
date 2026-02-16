/**
 * Admin Console - FantaPronostic
 * 
 * Gestione operazioni quotidiane: matchday corrente, status, risultati, confirm punteggi.
 * Per operazioni avanzate (creazione seasons, bulk import, audit logs) usare Postman/curl.
 * 
 * Accesso: solo utenti con role === "admin"
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, Alert, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';

// Types
interface Season {
  id: string;
  name: string;
  is_active: boolean;
  current_matchday_id?: string;
}

interface Matchday {
  id: string;
  number: number;
  label?: string;
  status: string;
  first_kickoff: string;
}

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  market_type: string;
}

const STATUS_OPTIONS = ['DRAFT', 'OPEN', 'LOCKED', 'LIVE', 'COMPLETED'];

export default function AdminConsole() {
  const { colors } = useTheme();
  const { user, token, handleAuthError } = useAuth();
  const router = useRouter();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Data
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<Matchday | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  
  // Match results editing
  const [editingResults, setEditingResults] = useState<Record<string, { home: string; away: string }>>({});
  
  // Modals
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  
  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      Alert.alert('Non autorizzato', 'Accesso riservato agli amministratori');
      router.back();
    }
  }, [user, router]);

  // Load seasons on mount
  useEffect(() => {
    loadSeasons();
  }, []);

  // Load matchdays when season changes
  useEffect(() => {
    if (selectedSeason) {
      loadMatchdays(selectedSeason.id);
    }
  }, [selectedSeason]);

  // Load matches when matchday changes
  useEffect(() => {
    if (selectedMatchday) {
      loadMatches(selectedMatchday.id);
    }
  }, [selectedMatchday]);

  const loadSeasons = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiCall('/admin/seasons', { token });
      setSeasons(data);
      // Auto-select active season
      const active = data.find((s: Season) => s.is_active);
      if (active) setSelectedSeason(active);
      else if (data.length > 0) setSelectedSeason(data[0]);
    } catch (e: any) {
      if (isAuthError(e)) {
        await handleAuthError(e);
        router.replace('/(auth)/login');
        return;
      }
      setError(e.message || 'Errore caricamento seasons');
    } finally {
      setLoading(false);
    }
  };

  const loadMatchdays = async (seasonId: string) => {
    try {
      const data = await apiCall(`/admin/matchdays?season_id=${seasonId}`, { token });
      setMatchdays(data);
      setSelectedMatchday(null);
      setMatches([]);
    } catch (e: any) {
      if (isAuthError(e)) {
        await handleAuthError(e);
        router.replace('/(auth)/login');
        return;
      }
      console.error(e);
    }
  };

  const loadMatches = async (matchdayId: string) => {
    try {
      const data = await apiCall(`/admin/matches?matchday_id=${matchdayId}`, { token });
      setMatches(data);
      // Initialize editing state
      const initial: Record<string, { home: string; away: string }> = {};
      data.forEach((m: Match) => {
        initial[m.id] = {
          home: m.home_score !== null ? String(m.home_score) : '',
          away: m.away_score !== null ? String(m.away_score) : '',
        };
      });
      setEditingResults(initial);
    } catch (e: any) {
      if (isAuthError(e)) {
        await handleAuthError(e);
        router.replace('/(auth)/login');
        return;
      }
      console.error(e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSeasons();
    setRefreshing(false);
  }, []);

  // === ACTIONS ===

  const setCurrentMatchday = async (matchdayId: string) => {
    if (!selectedSeason) return;
    
    setActionLoading(true);
    try {
      await apiCall(`/admin/seasons/${selectedSeason.id}/current-matchday?matchday_id=${matchdayId}`, {
        method: 'PUT',
        token,
      });
      Alert.alert('Fatto!', 'Giornata corrente aggiornata');
      // Refresh seasons to update current_matchday_id
      await loadSeasons();
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile impostare giornata corrente');
    } finally {
      setActionLoading(false);
    }
  };

  const updateMatchdayStatus = async (status: string) => {
    if (!selectedMatchday) return;
    
    // Confirm for COMPLETED
    if (status === 'COMPLETED') {
      Alert.alert(
        'Conferma',
        'Sei sicuro di voler impostare lo status a COMPLETED? Questa azione è importante.',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Conferma', onPress: () => doUpdateStatus(status) },
        ]
      );
    } else {
      doUpdateStatus(status);
    }
    setShowStatusPicker(false);
  };

  const doUpdateStatus = async (status: string) => {
    if (!selectedMatchday || !selectedSeason) return;
    
    setActionLoading(true);
    try {
      await apiCall(`/admin/matchdays/${selectedMatchday.id}`, {
        method: 'PUT',
        token,
        body: { status },
      });
      Alert.alert('Fatto!', `Status aggiornato a ${status}`);
      await loadMatchdays(selectedSeason.id);
      // Re-select the matchday to refresh
      const updated = matchdays.find(m => m.id === selectedMatchday.id);
      if (updated) setSelectedMatchday({ ...updated, status });
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile aggiornare status');
    } finally {
      setActionLoading(false);
    }
  };

  const saveMatchResult = async (matchId: string) => {
    const result = editingResults[matchId];
    if (!result) return;
    
    const homeScore = parseInt(result.home, 10);
    const awayScore = parseInt(result.away, 10);
    
    if (isNaN(homeScore) || isNaN(awayScore)) {
      Alert.alert('Errore', 'Inserisci punteggi validi');
      return;
    }
    
    setActionLoading(true);
    try {
      await apiCall(`/admin/matches/${matchId}`, {
        method: 'PUT',
        token,
        body: { home_score: homeScore, away_score: awayScore, status: 'finished' },
      });
      Alert.alert('Fatto!', 'Risultato salvato');
      if (selectedMatchday) await loadMatches(selectedMatchday.id);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile salvare risultato');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmMatchday = async () => {
    if (!selectedMatchday) return;
    
    Alert.alert(
      'Conferma Punteggi',
      'Questa azione calcolerà e confermerà i punteggi definitivi per tutti gli utenti. Continuare?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Conferma', onPress: doConfirmMatchday },
      ]
    );
  };

  const doConfirmMatchday = async () => {
    if (!selectedMatchday || !selectedSeason) return;
    
    setActionLoading(true);
    try {
      const result = await apiCall(`/admin/matchdays/${selectedMatchday.id}/confirm`, {
        method: 'POST',
        token,
      });
      Alert.alert('Punteggi Confermati!', `Processati ${result.users_processed || 0} utenti`);
      await loadMatchdays(selectedSeason.id);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile confermare punteggi');
    } finally {
      setActionLoading(false);
    }
  };

  // === RENDER ===

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}>
          <Ionicons name="lock-closed" size={48} color={colors.error} />
          <Text style={[s.errorText, { color: colors.error }]}>Accesso non autorizzato</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.loadingText, { color: colors.textSecondary }]}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Admin Console</Text>
        {actionLoading && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {error ? (
          <View style={[s.errorBanner, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={[s.errorBannerText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* SECTION 1: Seasons */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          <Text style={[s.sectionTitle, { color: colors.accent }]}>
            <Ionicons name="calendar" size={16} /> SEASONS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.horizontalScroll}>
            {seasons.map((season) => (
              <TouchableOpacity
                key={season.id}
                style={[
                  s.chip,
                  { borderColor: colors.border },
                  selectedSeason?.id === season.id && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => setSelectedSeason(season)}
              >
                <Text style={[
                  s.chipText,
                  { color: colors.text },
                  selectedSeason?.id === season.id && { color: colors.background },
                ]}>
                  {season.name} {season.is_active ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* SECTION 2: Matchdays */}
        {selectedSeason && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <Text style={[s.sectionTitle, { color: colors.accent }]}>
              <Ionicons name="football" size={16} /> GIORNATE
            </Text>
            {matchdays.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>Nessuna giornata</Text>
            ) : (
              matchdays.map((md) => {
                const isCurrent = selectedSeason.current_matchday_id === md.id;
                const isSelected = selectedMatchday?.id === md.id;
                return (
                  <TouchableOpacity
                    key={md.id}
                    style={[
                      s.matchdayRow,
                      { borderColor: colors.border },
                      isSelected && { borderColor: colors.accent, backgroundColor: 'rgba(245,166,35,0.1)' },
                    ]}
                    onPress={() => setSelectedMatchday(md)}
                  >
                    <View style={s.matchdayInfo}>
                      <Text style={[s.matchdayNum, { color: colors.text }]}>
                        Giornata {md.number} {isCurrent ? '⭐' : ''}
                      </Text>
                      <View style={[s.statusBadge, { backgroundColor: getStatusColor(md.status, colors) }]}>
                        <Text style={s.statusBadgeText}>{md.status}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.accent }]}
                      onPress={() => setCurrentMatchday(md.id)}
                      disabled={isCurrent}
                    >
                      <Text style={[s.actionBtnText, { color: colors.background }]}>
                        {isCurrent ? 'Corrente' : 'Set Current'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* SECTION 3: Selected Matchday Actions */}
        {selectedMatchday && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <Text style={[s.sectionTitle, { color: colors.accent }]}>
              <Ionicons name="settings" size={16} /> AZIONI GIORNATA {selectedMatchday.number}
            </Text>
            
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtnLarge, { borderColor: colors.accent }]}
                onPress={() => setShowStatusPicker(true)}
              >
                <Ionicons name="swap-horizontal" size={20} color={colors.accent} />
                <Text style={[s.actionBtnLargeText, { color: colors.accent }]}>Cambia Status</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[s.actionBtnLarge, { borderColor: colors.success, backgroundColor: 'rgba(34,197,94,0.1)' }]}
                onPress={confirmMatchday}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[s.actionBtnLargeText, { color: colors.success }]}>Confirm Punteggi</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SECTION 4: Matches */}
        {selectedMatchday && matches.length > 0 && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <Text style={[s.sectionTitle, { color: colors.accent }]}>
              <Ionicons name="list" size={16} /> PARTITE ({matches.length})
            </Text>
            
            {matches.map((match) => (
              <View key={match.id} style={[s.matchRow, { borderColor: colors.border }]}>
                <View style={s.matchTeams}>
                  <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>
                    {match.home_team}
                  </Text>
                  <Text style={[s.vsText, { color: colors.textSecondary }]}>vs</Text>
                  <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>
                    {match.away_team}
                  </Text>
                </View>
                
                <View style={s.matchScoreRow}>
                  <TextInput
                    style={[s.scoreInput, { color: colors.text, borderColor: colors.border }]}
                    keyboardType="numeric"
                    placeholder="H"
                    placeholderTextColor={colors.textSecondary}
                    value={editingResults[match.id]?.home || ''}
                    onChangeText={(t) => setEditingResults(prev => ({
                      ...prev,
                      [match.id]: { ...prev[match.id], home: t }
                    }))}
                  />
                  <Text style={[s.scoreDash, { color: colors.textSecondary }]}>-</Text>
                  <TextInput
                    style={[s.scoreInput, { color: colors.text, borderColor: colors.border }]}
                    keyboardType="numeric"
                    placeholder="A"
                    placeholderTextColor={colors.textSecondary}
                    value={editingResults[match.id]?.away || ''}
                    onChangeText={(t) => setEditingResults(prev => ({
                      ...prev,
                      [match.id]: { ...prev[match.id], away: t }
                    }))}
                  />
                  <TouchableOpacity
                    style={[s.saveBtn, { backgroundColor: colors.accent }]}
                    onPress={() => saveMatchResult(match.id)}
                  >
                    <Ionicons name="checkmark" size={18} color={colors.background} />
                  </TouchableOpacity>
                </View>
                
                <Text style={[s.matchStatus, { color: colors.textSecondary }]}>
                  {match.status} • {match.market_type}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="fade">
        <TouchableOpacity 
          style={s.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowStatusPicker(false)}
        >
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Seleziona Status</Text>
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[s.modalOption, { borderColor: colors.border }]}
                onPress={() => updateMatchdayStatus(status)}
              >
                <Text style={[
                  s.modalOptionText,
                  { color: colors.text },
                  selectedMatchday?.status === status && { color: colors.accent, fontWeight: '700' }
                ]}>
                  {status} {selectedMatchday?.status === status ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.modalCancel, { borderColor: colors.border }]}
              onPress={() => setShowStatusPicker(false)}
            >
              <Text style={[s.modalCancelText, { color: colors.error }]}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function getStatusColor(status: string, colors: any): string {
  switch (status) {
    case 'COMPLETED': return 'rgba(34,197,94,0.8)';
    case 'LIVE': return 'rgba(239,68,68,0.8)';
    case 'LOCKED': return 'rgba(245,166,35,0.8)';
    case 'OPEN': return 'rgba(59,130,246,0.8)';
    default: return 'rgba(107,114,128,0.8)';
  }
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 16, fontWeight: '600' },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  
  // Scroll
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  // Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '500' },
  
  // Section
  section: { borderRadius: 14, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 12, letterSpacing: 0.5 },
  
  // Horizontal scroll (seasons)
  horizontalScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  
  // Matchdays
  emptyText: { fontSize: 14, fontStyle: 'italic', padding: 8 },
  matchdayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  matchdayInfo: { flex: 1, gap: 4 },
  matchdayNum: { fontSize: 15, fontWeight: '600' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  
  // Actions
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtnLarge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  actionBtnLargeText: { fontSize: 13, fontWeight: '600' },
  
  // Matches
  matchRow: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600' },
  vsText: { fontSize: 12 },
  matchScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  scoreInput: { width: 44, height: 40, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  scoreDash: { fontSize: 18 },
  saveBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  matchStatus: { fontSize: 11 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1 },
  modalOptionText: { fontSize: 16, textAlign: 'center' },
  modalCancel: { paddingVertical: 14, marginTop: 8, borderTopWidth: 1 },
  modalCancelText: { fontSize: 16, textAlign: 'center', fontWeight: '600' },
});
