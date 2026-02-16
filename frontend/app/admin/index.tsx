/**
 * Admin Console - FantaPronostic
 * 
 * Gestione completa: seasons, matchdays, matches, risultati, punteggi.
 * 
 * Funzionalità:
 * - Creare/eliminare giornate
 * - Aggiungere partite a una giornata
 * - Aggiornare risultati in diretta
 * - Cambiare stato partite (scheduled/live/finished)
 * - Confermare punteggi
 * 
 * Accesso: solo utenti con role === "admin"
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, Alert, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
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
  season_id: string;
}

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  market_type: string;
  start_time?: string;
}

const STATUS_OPTIONS = ['DRAFT', 'OPEN', 'LOCKED', 'LIVE', 'COMPLETED'];
const MATCH_STATUS_OPTIONS = ['scheduled', 'live', 'finished', 'postponed', 'cancelled', 'void'];
const MARKET_TYPES = ['1X2', 'GOAL_NGOAL', 'OVER_UNDER', 'EXACT_SCORE'];

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
  const [editingResults, setEditingResults] = useState<Record<string, { home: string; away: string; status: string }>>({});
  
  // Modals
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showCreateMatchday, setShowCreateMatchday] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showMatchStatusPicker, setShowMatchStatusPicker] = useState<string | null>(null);
  
  // Create matchday form
  const [newMatchday, setNewMatchday] = useState({ number: '', label: '', first_kickoff: '' });
  
  // Add match form
  const [newMatch, setNewMatch] = useState({ 
    home_team: '', 
    away_team: '', 
    market_type: '1X2',
    start_time: '',
  });
  
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
      setMatchdays(data.sort((a: Matchday, b: Matchday) => a.number - b.number));
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
      const initial: Record<string, { home: string; away: string; status: string }> = {};
      data.forEach((m: Match) => {
        initial[m.id] = {
          home: m.home_score !== null ? String(m.home_score) : '',
          away: m.away_score !== null ? String(m.away_score) : '',
          status: m.status,
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

  // === MATCHDAY ACTIONS ===

  const setCurrentMatchday = async (matchdayId: string) => {
    if (!selectedSeason) return;
    setActionLoading(true);
    try {
      await apiCall(`/admin/seasons/${selectedSeason.id}/current-matchday?matchday_id=${matchdayId}`, {
        method: 'PUT',
        token,
      });
      Alert.alert('Fatto!', 'Giornata corrente aggiornata');
      await loadSeasons();
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile impostare giornata corrente');
    } finally {
      setActionLoading(false);
    }
  };

  const createMatchday = async () => {
    if (!selectedSeason || !newMatchday.number || !newMatchday.first_kickoff) {
      Alert.alert('Errore', 'Compila numero e data/ora kickoff');
      return;
    }
    
    setActionLoading(true);
    try {
      await apiCall('/admin/matchdays', {
        method: 'POST',
        token,
        body: {
          season_id: selectedSeason.id,
          number: parseInt(newMatchday.number, 10),
          label: newMatchday.label || `Giornata ${newMatchday.number}`,
          first_kickoff: newMatchday.first_kickoff,
          status: 'DRAFT',
        },
      });
      Alert.alert('Fatto!', 'Giornata creata');
      setShowCreateMatchday(false);
      setNewMatchday({ number: '', label: '', first_kickoff: '' });
      await loadMatchdays(selectedSeason.id);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile creare giornata');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteMatchday = async (matchdayId: string) => {
    Alert.alert(
      'Elimina Giornata',
      'Sei sicuro? Questa azione eliminerà anche tutte le partite e pronostici associati.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => doDeleteMatchday(matchdayId) },
      ]
    );
  };

  const doDeleteMatchday = async (matchdayId: string) => {
    if (!selectedSeason) return;
    setActionLoading(true);
    try {
      await apiCall(`/admin/matchdays/${matchdayId}`, {
        method: 'DELETE',
        token,
      });
      Alert.alert('Fatto!', 'Giornata eliminata');
      setSelectedMatchday(null);
      setMatches([]);
      await loadMatchdays(selectedSeason.id);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile eliminare giornata');
    } finally {
      setActionLoading(false);
    }
  };

  const updateMatchdayStatus = async (status: string) => {
    if (!selectedMatchday) return;
    
    if (status === 'COMPLETED') {
      Alert.alert(
        'Conferma',
        'Sei sicuro di voler impostare lo status a COMPLETED?',
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
      setSelectedMatchday({ ...selectedMatchday, status });
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile aggiornare status');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmMatchday = async () => {
    if (!selectedMatchday) return;
    Alert.alert(
      'Conferma Punteggi',
      'Questa azione calcolerà e confermerà i punteggi definitivi. Continuare?',
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

  // === MATCH ACTIONS ===

  const addMatch = async () => {
    if (!selectedMatchday || !newMatch.home_team || !newMatch.away_team) {
      Alert.alert('Errore', 'Inserisci squadra casa e ospite');
      return;
    }
    
    setActionLoading(true);
    try {
      await apiCall('/admin/matches', {
        method: 'POST',
        token,
        body: {
          matchday_id: selectedMatchday.id,
          home_team: newMatch.home_team,
          away_team: newMatch.away_team,
          market_type: newMatch.market_type,
          start_time: newMatch.start_time || selectedMatchday.first_kickoff,
          status: 'scheduled',
        },
      });
      Alert.alert('Fatto!', 'Partita aggiunta');
      setShowAddMatch(false);
      setNewMatch({ home_team: '', away_team: '', market_type: '1X2', start_time: '' });
      await loadMatches(selectedMatchday.id);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile aggiungere partita');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteMatch = async (matchId: string) => {
    Alert.alert(
      'Elimina Partita',
      'Sei sicuro? I pronostici associati saranno eliminati.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => doDeleteMatch(matchId) },
      ]
    );
  };

  const doDeleteMatch = async (matchId: string) => {
    if (!selectedMatchday) return;
    setActionLoading(true);
    try {
      await apiCall(`/admin/matches/${matchId}`, {
        method: 'DELETE',
        token,
      });
      Alert.alert('Fatto!', 'Partita eliminata');
      await loadMatches(selectedMatchday.id);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile eliminare partita');
    } finally {
      setActionLoading(false);
    }
  };

  const saveMatchResult = async (matchId: string) => {
    const result = editingResults[matchId];
    if (!result) return;
    
    const homeScore = result.home ? parseInt(result.home, 10) : null;
    const awayScore = result.away ? parseInt(result.away, 10) : null;
    
    setActionLoading(true);
    try {
      const body: any = { status: result.status };
      if (homeScore !== null && !isNaN(homeScore)) body.home_score = homeScore;
      if (awayScore !== null && !isNaN(awayScore)) body.away_score = awayScore;
      
      await apiCall(`/admin/matches/${matchId}`, {
        method: 'PUT',
        token,
        body,
      });
      Alert.alert('Fatto!', 'Partita aggiornata');
      if (selectedMatchday) await loadMatches(selectedMatchday.id);
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile salvare');
    } finally {
      setActionLoading(false);
    }
  };

  const updateMatchStatus = (matchId: string, status: string) => {
    setEditingResults(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], status }
    }));
    setShowMatchStatusPicker(null);
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
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.accent }]}>
                <Ionicons name="football" size={16} /> GIORNATE
              </Text>
              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: colors.accent }]}
                onPress={() => setShowCreateMatchday(true)}
              >
                <Ionicons name="add" size={18} color={colors.background} />
                <Text style={[s.addBtnText, { color: colors.background }]}>Nuova</Text>
              </TouchableOpacity>
            </View>
            
            {matchdays.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>Nessuna giornata - creane una!</Text>
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
                        {md.label || `Giornata ${md.number}`} {isCurrent ? '⭐' : ''}
                      </Text>
                      <View style={[s.statusBadge, { backgroundColor: getStatusColor(md.status) }]}>
                        <Text style={s.statusBadgeText}>{md.status}</Text>
                      </View>
                    </View>
                    <View style={s.matchdayActions}>
                      <TouchableOpacity
                        style={[s.smallBtn, { backgroundColor: isCurrent ? colors.border : colors.accent }]}
                        onPress={() => setCurrentMatchday(md.id)}
                        disabled={isCurrent}
                      >
                        <Text style={[s.smallBtnText, { color: isCurrent ? colors.textSecondary : colors.background }]}>
                          {isCurrent ? '⭐' : 'Set'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.smallBtn, { backgroundColor: 'rgba(239,68,68,0.2)' }]}
                        onPress={() => deleteMatchday(md.id)}
                      >
                        <Ionicons name="trash" size={14} color={colors.error} />
                      </TouchableOpacity>
                    </View>
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
              <Ionicons name="settings" size={16} /> AZIONI - {selectedMatchday.label || `Giornata ${selectedMatchday.number}`}
            </Text>
            
            <View style={s.actionsGrid}>
              <TouchableOpacity
                style={[s.actionCard, { borderColor: colors.accent }]}
                onPress={() => setShowStatusPicker(true)}
              >
                <Ionicons name="swap-horizontal" size={24} color={colors.accent} />
                <Text style={[s.actionCardText, { color: colors.text }]}>Cambia Status</Text>
                <Text style={[s.actionCardSub, { color: colors.textSecondary }]}>{selectedMatchday.status}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[s.actionCard, { borderColor: colors.success }]}
                onPress={confirmMatchday}
              >
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={[s.actionCardText, { color: colors.text }]}>Confirm</Text>
                <Text style={[s.actionCardSub, { color: colors.textSecondary }]}>Punteggi</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SECTION 4: Matches */}
        {selectedMatchday && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.accent }]}>
                <Ionicons name="list" size={16} /> PARTITE ({matches.length}/11)
              </Text>
              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: colors.accent }]}
                onPress={() => setShowAddMatch(true)}
              >
                <Ionicons name="add" size={18} color={colors.background} />
                <Text style={[s.addBtnText, { color: colors.background }]}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
            
            {matches.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>Nessuna partita - aggiungine!</Text>
            ) : (
              matches.map((match) => (
                <View key={match.id} style={[s.matchCard, { borderColor: colors.border }]}>
                  {/* Teams */}
                  <View style={s.matchTeamsRow}>
                    <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>
                      {match.home_team}
                    </Text>
                    <Text style={[s.vsText, { color: colors.textSecondary }]}>vs</Text>
                    <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>
                      {match.away_team}
                    </Text>
                  </View>
                  
                  {/* Score inputs + Status */}
                  <View style={s.matchControlsRow}>
                    <TextInput
                      style={[s.scoreInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
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
                      style={[s.scoreInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      keyboardType="numeric"
                      placeholder="A"
                      placeholderTextColor={colors.textSecondary}
                      value={editingResults[match.id]?.away || ''}
                      onChangeText={(t) => setEditingResults(prev => ({
                        ...prev,
                        [match.id]: { ...prev[match.id], away: t }
                      }))}
                    />
                    
                    {/* Status selector */}
                    <TouchableOpacity
                      style={[s.statusSelector, { backgroundColor: getMatchStatusColor(editingResults[match.id]?.status || match.status) }]}
                      onPress={() => setShowMatchStatusPicker(match.id)}
                    >
                      <Text style={s.statusSelectorText}>
                        {(editingResults[match.id]?.status || match.status).toUpperCase().slice(0, 4)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Action buttons */}
                  <View style={s.matchActionsRow}>
                    <Text style={[s.matchMeta, { color: colors.textSecondary }]}>
                      {match.market_type}
                    </Text>
                    <View style={s.matchBtns}>
                      <TouchableOpacity
                        style={[s.matchBtn, { backgroundColor: colors.accent }]}
                        onPress={() => saveMatchResult(match.id)}
                      >
                        <Ionicons name="checkmark" size={16} color={colors.background} />
                        <Text style={[s.matchBtnText, { color: colors.background }]}>Salva</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.matchBtn, { backgroundColor: 'rgba(239,68,68,0.15)' }]}
                        onPress={() => deleteMatch(match.id)}
                      >
                        <Ionicons name="trash" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal: Status Picker */}
      <Modal visible={showStatusPicker} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Status Giornata</Text>
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[s.modalOption, { borderColor: colors.border }]}
                onPress={() => updateMatchdayStatus(status)}
              >
                <View style={[s.statusDot, { backgroundColor: getStatusColor(status) }]} />
                <Text style={[s.modalOptionText, { color: colors.text }]}>{status}</Text>
                {selectedMatchday?.status === status && <Ionicons name="checkmark" size={20} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Match Status Picker */}
      <Modal visible={!!showMatchStatusPicker} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowMatchStatusPicker(null)}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Status Partita</Text>
            {MATCH_STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[s.modalOption, { borderColor: colors.border }]}
                onPress={() => updateMatchStatus(showMatchStatusPicker!, status)}
              >
                <View style={[s.statusDot, { backgroundColor: getMatchStatusColor(status) }]} />
                <Text style={[s.modalOptionText, { color: colors.text }]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Create Matchday */}
      <Modal visible={showCreateMatchday} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={[s.modalForm, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Nuova Giornata</Text>
            
            <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Numero *</Text>
            <TextInput
              style={[s.formInput, { color: colors.text, borderColor: colors.border }]}
              keyboardType="numeric"
              placeholder="Es: 12"
              placeholderTextColor={colors.textSecondary}
              value={newMatchday.number}
              onChangeText={(t) => setNewMatchday(p => ({ ...p, number: t }))}
            />
            
            <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Label (opzionale)</Text>
            <TextInput
              style={[s.formInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Es: Giornata 12"
              placeholderTextColor={colors.textSecondary}
              value={newMatchday.label}
              onChangeText={(t) => setNewMatchday(p => ({ ...p, label: t }))}
            />
            
            <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Primo Kickoff (ISO) *</Text>
            <TextInput
              style={[s.formInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="2025-03-01T15:00:00Z"
              placeholderTextColor={colors.textSecondary}
              value={newMatchday.first_kickoff}
              onChangeText={(t) => setNewMatchday(p => ({ ...p, first_kickoff: t }))}
            />
            
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: colors.border }]}
                onPress={() => setShowCreateMatchday(false)}
              >
                <Text style={[s.modalBtnText, { color: colors.textSecondary }]}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: colors.accent }]}
                onPress={createMatchday}
              >
                <Text style={[s.modalBtnText, { color: colors.background }]}>Crea</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Add Match */}
      <Modal visible={showAddMatch} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={[s.modalForm, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Aggiungi Partita</Text>
            
            <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Squadra Casa *</Text>
            <TextInput
              style={[s.formInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Es: Juventus"
              placeholderTextColor={colors.textSecondary}
              value={newMatch.home_team}
              onChangeText={(t) => setNewMatch(p => ({ ...p, home_team: t }))}
            />
            
            <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Squadra Ospite *</Text>
            <TextInput
              style={[s.formInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Es: Inter"
              placeholderTextColor={colors.textSecondary}
              value={newMatch.away_team}
              onChangeText={(t) => setNewMatch(p => ({ ...p, away_team: t }))}
            />
            
            <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Tipo Mercato</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {MARKET_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  style={[
                    s.chip,
                    { borderColor: colors.border },
                    newMatch.market_type === mt && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  onPress={() => setNewMatch(p => ({ ...p, market_type: mt }))}
                >
                  <Text style={[
                    s.chipText,
                    { color: colors.text },
                    newMatch.market_type === mt && { color: colors.background },
                  ]}>
                    {mt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Orario Kickoff (ISO, opzionale)</Text>
            <TextInput
              style={[s.formInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="2025-03-01T15:00:00Z"
              placeholderTextColor={colors.textSecondary}
              value={newMatch.start_time}
              onChangeText={(t) => setNewMatch(p => ({ ...p, start_time: t }))}
            />
            
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: colors.border }]}
                onPress={() => setShowAddMatch(false)}
              >
                <Text style={[s.modalBtnText, { color: colors.textSecondary }]}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: colors.accent }]}
                onPress={addMatch}
              >
                <Text style={[s.modalBtnText, { color: colors.background }]}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'rgba(34,197,94,0.9)';
    case 'LIVE': return 'rgba(239,68,68,0.9)';
    case 'LOCKED': return 'rgba(245,166,35,0.9)';
    case 'OPEN': return 'rgba(59,130,246,0.9)';
    default: return 'rgba(107,114,128,0.9)';
  }
}

function getMatchStatusColor(status: string): string {
  switch (status) {
    case 'finished': return 'rgba(34,197,94,0.9)';
    case 'live': return 'rgba(239,68,68,0.9)';
    case 'scheduled': return 'rgba(59,130,246,0.9)';
    case 'postponed': case 'cancelled': case 'void': return 'rgba(107,114,128,0.9)';
    default: return 'rgba(107,114,128,0.9)';
  }
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 16, fontWeight: '600' },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '500' },
  
  section: { borderRadius: 14, padding: 14, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { fontSize: 12, fontWeight: '600' },
  
  horizontalScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  
  emptyText: { fontSize: 14, fontStyle: 'italic', padding: 8, textAlign: 'center' },
  
  matchdayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8 },
  matchdayInfo: { flex: 1, gap: 4 },
  matchdayNum: { fontSize: 15, fontWeight: '600' },
  matchdayActions: { flexDirection: 'row', gap: 6 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: 11, fontWeight: '600' },
  
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  
  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, gap: 6 },
  actionCardText: { fontSize: 13, fontWeight: '600' },
  actionCardSub: { fontSize: 11 },
  
  matchCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  matchTeamsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600' },
  vsText: { fontSize: 12 },
  
  matchControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  scoreInput: { width: 48, height: 44, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  scoreDash: { fontSize: 20 },
  
  statusSelector: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginLeft: 'auto' },
  statusSelectorText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  
  matchActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchMeta: { fontSize: 11 },
  matchBtns: { flexDirection: 'row', gap: 8 },
  matchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  matchBtnText: { fontSize: 12, fontWeight: '600' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalForm: { width: '100%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  modalOptionText: { flex: 1, fontSize: 16 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 4 },
  
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});
