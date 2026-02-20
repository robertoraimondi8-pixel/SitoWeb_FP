/**
 * League Admin Console - FantaPronostic
 * 
 * Console admin per gestire una lega MANUALE specifica.
 * Replica la stessa UX della console admin globale ma limitata alla lega selezionata.
 * 
 * Accesso: solo owner/admin della lega
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, Alert, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface League {
  id: string;
  name: string;
  match_source_type: string;
  owner_id: string;
  season_id: string;
}

interface Matchday {
  id: string;
  number: number;
  label?: string;
  status: string;
  first_kickoff: string;
  league_id: string;
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
  league_id: string;
}

const STATUS_OPTIONS = ['DRAFT', 'OPEN', 'LOCKED', 'LIVE', 'COMPLETED'];
const MATCH_STATUS_OPTIONS = ['scheduled', 'live', 'finished', 'postponed', 'cancelled', 'void'];
const MARKET_TYPES = ['1X2', 'GOAL_NGOAL', 'OVER_UNDER', 'EXACT_SCORE'];

export default function LeagueAdminConsole() {
  const { colors } = useTheme();
  const { user, token, handleAuthError } = useAuth();
  const router = useRouter();
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Data
  const [league, setLeague] = useState<League | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<Matchday | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  
  // Match results editing
  const [editingResults, setEditingResults] = useState<Record<string, { home: string; away: string; status: string }>>({});
  const [modifiedMatches, setModifiedMatches] = useState<Set<string>>(new Set());
  
  // Modals
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showCreateMatchday, setShowCreateMatchday] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showMatchStatusPicker, setShowMatchStatusPicker] = useState<string | null>(null);
  const [showMatchdayDropdown, setShowMatchdayDropdown] = useState(false);
  
  // Date picker state
  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(15, 0, 0, 0);
    return d;
  };
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDefaultDate());
  
  // Create matchday form
  const [newMatchday, setNewMatchday] = useState({ number: '', label: '' });
  const [showNumberPicker, setShowNumberPicker] = useState(false);
  
  // Add match form
  const [newMatch, setNewMatch] = useState({ 
    home_team: '', 
    away_team: '', 
    market_type: '1X2',
    competition: 'Lega Privata',
  });
  const [matchDate, setMatchDate] = useState(getDefaultDate());
  const [showMatchDatePicker, setShowMatchDatePicker] = useState(false);
  const [showMatchTimePicker, setShowMatchTimePicker] = useState(false);

  // Get available matchday numbers
  const getAvailableNumbers = () => {
    const usedNumbers = matchdays.map(md => md.number);
    return Array.from({ length: 40 }, (_, i) => i + 1).filter(n => !usedNumbers.includes(n));
  };

  // Load league on mount
  useEffect(() => {
    if (leagueId) {
      loadLeague();
    }
  }, [leagueId]);

  // Load matchdays when league changes
  useEffect(() => {
    if (league) {
      loadMatchdays();
    }
  }, [league]);

  // Load matches when matchday changes
  useEffect(() => {
    if (selectedMatchday) {
      loadMatches(selectedMatchday.id);
    }
  }, [selectedMatchday]);

  const loadLeague = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiCall(`/leagues/${leagueId}`, { token });
      
      // Verifica che l'utente sia owner
      const isOwner = data.owner_id === user?.id || data.created_by === user?.id;
      if (!isOwner) {
        Alert.alert('Non autorizzato', 'Solo il creatore della lega può gestirla');
        router.back();
        return;
      }
      
      // Verifica che sia una lega manuale
      const isManual = data.match_source_type === 'manual' || data.match_source_type === 'custom';
      if (!isManual) {
        Alert.alert('Info', 'Questa lega usa le partite della Lega Nazionale');
        router.back();
        return;
      }
      
      setLeague(data);
    } catch (e: any) {
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      setError(e.message || 'Errore caricamento lega');
    } finally {
      setLoading(false);
    }
  };

  const loadMatchdays = async () => {
    if (!league) return;
    try {
      const data = await apiCall(`/leagues/${league.id}/matchdays`, { token });
      setMatchdays(data.sort((a: Matchday, b: Matchday) => a.number - b.number));
      setSelectedMatchday(null);
      setMatches([]);
      setModifiedMatches(new Set());
    } catch (e: any) {
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error(e);
    }
  };

  const loadMatches = async (matchdayId: string) => {
    try {
      const data = await apiCall(`/leagues/${league?.id}/matchdays/${matchdayId}/matches`, { token });
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
      setModifiedMatches(new Set());
    } catch (e: any) {
      if (isAuthError(e)) {
        const didLogout = await handleAuthError(e);
        if (didLogout) router.replace('/(auth)/login');
        return;
      }
      console.error(e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeague();
    setRefreshing(false);
  }, []);

  const updateMatchResult = (matchId: string, field: 'home' | 'away' | 'status', value: string) => {
    setEditingResults(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value }
    }));
    setModifiedMatches(prev => new Set(prev).add(matchId));
  };

  // === MATCHDAY ACTIONS ===

  const createMatchday = async () => {
    if (!league || !newMatchday.number) {
      Alert.alert('Errore', 'Inserisci il numero della giornata');
      return;
    }
    
    setActionLoading(true);
    try {
      const kickoffISO = selectedDate.toISOString();
      const number = parseInt(newMatchday.number, 10);
      const half = number <= 19 ? 1 : 2;
      
      await apiCall(`/leagues/${league.id}/matchdays`, {
        method: 'POST',
        token,
        body: {
          season_id: league.season_id,
          number: number,
          label: newMatchday.label || `Giornata ${newMatchday.number}`,
          half: half,
          first_kickoff: kickoffISO,
          status: 'DRAFT',
        },
      });
      Alert.alert('Fatto!', 'Giornata creata');
      setShowCreateMatchday(false);
      setNewMatchday({ number: '', label: '' });
      setSelectedDate(getDefaultDate());
      await loadMatchdays();
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
    if (!league) return;
    setActionLoading(true);
    try {
      await apiCall(`/leagues/${league.id}/matchdays/${matchdayId}`, {
        method: 'DELETE',
        token,
      });
      Alert.alert('Fatto!', 'Giornata eliminata');
      setSelectedMatchday(null);
      setMatches([]);
      await loadMatchdays();
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile eliminare giornata');
    } finally {
      setActionLoading(false);
    }
  };

  const updateMatchdayStatus = async (status: string) => {
    if (!selectedMatchday || !league) return;
    
    setActionLoading(true);
    try {
      await apiCall(`/leagues/${league.id}/matchdays/${selectedMatchday.id}`, {
        method: 'PUT',
        token,
        body: { status },
      });
      Alert.alert('Fatto!', `Status aggiornato a ${status}`);
      await loadMatchdays();
      setSelectedMatchday({ ...selectedMatchday, status });
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Impossibile aggiornare status');
    } finally {
      setActionLoading(false);
      setShowStatusPicker(false);
    }
  };

  // === MATCH ACTIONS ===

  const addMatch = async () => {
    if (!selectedMatchday || !league || !newMatch.home_team || !newMatch.away_team) {
      Alert.alert('Errore', 'Inserisci squadra casa e ospite');
      return;
    }
    
    setActionLoading(true);
    try {
      await apiCall(`/leagues/${league.id}/matchdays/${selectedMatchday.id}/matches`, {
        method: 'POST',
        token,
        body: {
          home_team: newMatch.home_team,
          away_team: newMatch.away_team,
          market_type: newMatch.market_type,
          competition: newMatch.competition,
          start_time: matchDate.toISOString(),
          status: 'scheduled',
        },
      });
      Alert.alert('Fatto!', 'Partita aggiunta');
      setShowAddMatch(false);
      setNewMatch({ home_team: '', away_team: '', market_type: '1X2', competition: 'Lega Privata' });
      setMatchDate(getDefaultDate());
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
    if (!selectedMatchday || !league) return;
    setActionLoading(true);
    try {
      await apiCall(`/leagues/${league.id}/matches/${matchId}`, {
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

  const saveAllMatches = async () => {
    if (modifiedMatches.size === 0 || !league) {
      Alert.alert('Info', 'Nessuna modifica da salvare');
      return;
    }
    
    setActionLoading(true);
    let savedCount = 0;
    let errorCount = 0;
    
    for (const matchId of modifiedMatches) {
      const result = editingResults[matchId];
      if (!result) continue;
      
      try {
        const homeScore = result.home ? parseInt(result.home, 10) : null;
        const awayScore = result.away ? parseInt(result.away, 10) : null;
        
        const body: any = { status: result.status };
        if (homeScore !== null && !isNaN(homeScore)) body.home_score = homeScore;
        if (awayScore !== null && !isNaN(awayScore)) body.away_score = awayScore;
        
        await apiCall(`/leagues/${league.id}/matches/${matchId}`, {
          method: 'PUT',
          token,
          body,
        });
        savedCount++;
      } catch (e: any) {
        errorCount++;
        console.error(`Error saving match ${matchId}:`, e);
      }
    }
    
    setActionLoading(false);
    setModifiedMatches(new Set());
    
    if (errorCount > 0) {
      Alert.alert('Attenzione', `Salvate ${savedCount} partite, ${errorCount} errori`);
    } else {
      Alert.alert('Fatto!', `Salvate ${savedCount} partite`);
    }
    
    if (selectedMatchday) await loadMatches(selectedMatchday.id);
  };

  const updateMatchStatus = (matchId: string, status: string) => {
    updateMatchResult(matchId, 'status', status);
    setShowMatchStatusPicker(null);
  };

  // Date picker handlers
  const onDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const onTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) {
      const newDate = new Date(selectedDate);
      newDate.setHours(date.getHours());
      newDate.setMinutes(date.getMinutes());
      setSelectedDate(newDate);
    }
  };

  // === RENDER ===

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

  if (!league) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[s.errorText, { color: colors.error }]}>Lega non trovata</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} 
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {league.name}
        </Text>
        {actionLoading && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      {/* Banner */}
      <View style={[s.descBanner, { backgroundColor: colors.card, borderColor: colors.accent }]}>
        <Ionicons name="create" size={24} color={colors.accent} />
        <View style={s.descBannerText}>
          <Text style={[s.descTitle, { color: colors.text }]}>Console Lega</Text>
          <Text style={[s.descSubtitle, { color: colors.textSecondary }]}>
            Crea giornate e partite per questa lega
          </Text>
        </View>
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

        {/* SECTION: Matchdays */}
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
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>
              Nessuna giornata - creane una per iniziare!
            </Text>
          ) : (
            <>
              <TouchableOpacity
                style={[s.dropdownSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowMatchdayDropdown(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                <Text style={[s.dropdownText, { color: colors.text }]}>
                  {selectedMatchday 
                    ? `${selectedMatchday.label || `Giornata ${selectedMatchday.number}`}` 
                    : 'Seleziona giornata...'}
                </Text>
                {selectedMatchday && (
                  <View style={[s.dropdownBadge, { backgroundColor: getStatusColor(selectedMatchday.status) }]}>
                    <Text style={s.dropdownBadgeText}>{selectedMatchday.status}</Text>
                  </View>
                )}
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {selectedMatchday && (
                <View style={s.quickActions}>
                  <TouchableOpacity
                    style={[s.quickBtn, { backgroundColor: colors.accent }]}
                    onPress={() => setShowStatusPicker(true)}
                  >
                    <Ionicons name="swap-horizontal" size={16} color={colors.background} />
                    <Text style={[s.quickBtnText, { color: colors.background }]}>Status</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.quickBtn, { backgroundColor: 'rgba(239,68,68,0.15)' }]}
                    onPress={() => deleteMatchday(selectedMatchday.id)}
                  >
                    <Ionicons name="trash" size={16} color={colors.error} />
                    <Text style={[s.quickBtnText, { color: colors.error }]}>Elimina</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* SECTION: Matches */}
        {selectedMatchday && (
          <View style={[s.section, { backgroundColor: colors.card }]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.accent }]}>
                <Ionicons name="list" size={16} /> PARTITE ({matches.length}/10)
              </Text>
              {matches.length >= 10 ? (
                <View style={[s.addBtn, { backgroundColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                  <Text style={[s.addBtnText, { color: colors.textMuted }]}>Max 10</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.addBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setShowAddMatch(true)}
                >
                  <Ionicons name="add" size={18} color={colors.background} />
                  <Text style={[s.addBtnText, { color: colors.background }]}>Aggiungi</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {matches.length >= 10 && (
              <Text style={[s.limitWarning, { color: colors.accent }]}>
                Hai raggiunto il limite massimo di 10 partite per questa giornata.
              </Text>
            )}
            
            {matches.length === 0 ? (
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                Nessuna partita - aggiungine per permettere i pronostici!
              </Text>
            ) : (
              <>
                {matches.map((match) => {
                  const isModified = modifiedMatches.has(match.id);
                  const matchTime = match.start_time ? new Date(match.start_time) : null;
                  return (
                    <View key={match.id} style={[
                      s.matchCard, 
                      { borderColor: isModified ? colors.accent : colors.border },
                      isModified && { borderWidth: 2 }
                    ]}>
                      <View style={s.matchTeamsRow}>
                        <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>
                          {match.home_team}
                        </Text>
                        <Text style={[s.vsText, { color: colors.textSecondary }]}>vs</Text>
                        <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>
                          {match.away_team}
                        </Text>
                        <TouchableOpacity onPress={() => deleteMatch(match.id)}>
                          <Ionicons name="close-circle" size={22} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                      
                      {matchTime && (
                        <View style={s.matchTimeRow}>
                          <Ionicons name="time-outline" size={14} color={colors.accent} />
                          <Text style={[s.matchTimeText, { color: colors.accent }]}>
                            {matchTime.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })} {matchTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      )}
                      
                      <View style={s.matchControlsRow}>
                        <TextInput
                          style={[s.scoreInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          keyboardType="numeric"
                          placeholder="H"
                          placeholderTextColor={colors.textSecondary}
                          value={editingResults[match.id]?.home || ''}
                          onChangeText={(t) => updateMatchResult(match.id, 'home', t)}
                        />
                        <Text style={[s.scoreDash, { color: colors.textSecondary }]}>-</Text>
                        <TextInput
                          style={[s.scoreInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          keyboardType="numeric"
                          placeholder="A"
                          placeholderTextColor={colors.textSecondary}
                          value={editingResults[match.id]?.away || ''}
                          onChangeText={(t) => updateMatchResult(match.id, 'away', t)}
                        />
                        
                        <TouchableOpacity
                          style={[s.statusSelector, { backgroundColor: getMatchStatusColor(editingResults[match.id]?.status || match.status) }]}
                          onPress={() => setShowMatchStatusPicker(match.id)}
                        >
                          <Text style={s.statusSelectorText}>
                            {(editingResults[match.id]?.status || match.status).toUpperCase().slice(0, 4)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      <Text style={[s.matchMeta, { color: colors.textSecondary }]}>
                        {match.market_type} {isModified && '• Modificato'}
                      </Text>
                    </View>
                  );
                })}
                
                <TouchableOpacity
                  style={[s.saveAllBtn, { backgroundColor: modifiedMatches.size > 0 ? colors.accent : colors.border }]}
                  onPress={saveAllMatches}
                  disabled={modifiedMatches.size === 0}
                >
                  <Ionicons name="save" size={20} color={modifiedMatches.size > 0 ? colors.background : colors.textSecondary} />
                  <Text style={[s.saveAllBtnText, { color: modifiedMatches.size > 0 ? colors.background : colors.textSecondary }]}>
                    SALVA TUTTO ({modifiedMatches.size} modifiche)
                  </Text>
                </TouchableOpacity>
              </>
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
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ padding: 0 }} keyboardShouldPersistTaps="handled">
            <View style={[s.modalForm, { backgroundColor: colors.card }]}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Nuova Giornata</Text>
              
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Numero *</Text>
              <TouchableOpacity
                style={[s.formInput, { borderColor: showNumberPicker ? colors.accent : colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setShowNumberPicker(v => !v)}
              >
                <Text style={{ color: newMatchday.number ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {newMatchday.number ? `Giornata ${newMatchday.number}` : 'Seleziona numero...'}
                </Text>
                <Ionicons name={showNumberPicker ? "chevron-up" : "chevron-down"} size={20} color={colors.accent} />
              </TouchableOpacity>
              
              {showNumberPicker && (
                <View style={[s.inlinePickerList, { borderColor: colors.accent, backgroundColor: colors.background }]}>
                  {getAvailableNumbers().length === 0 ? (
                    <Text style={[s.inlinePickerEmpty, { color: colors.textSecondary }]}>Tutti i numeri sono in uso</Text>
                  ) : (
                    getAvailableNumbers().slice(0, 10).map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[s.inlinePickerItem, { borderBottomColor: colors.borderLight }]}
                        onPress={() => {
                          setNewMatchday(p => ({ ...p, number: String(num), label: `Giornata ${num}` }));
                          setShowNumberPicker(false);
                        }}
                      >
                        <Text style={[s.inlinePickerItemText, { color: colors.text }]}>Giornata {num}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
              
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Label (opzionale)</Text>
              <TextInput
                style={[s.formInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Es: Giornata 1"
                placeholderTextColor={colors.textSecondary}
                value={newMatchday.label}
                onChangeText={(t) => setNewMatchday(p => ({ ...p, label: t }))}
              />
              
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Data e Ora *</Text>
              <View style={s.dateTimeRow}>
                <TouchableOpacity
                  style={[s.dateTimeBtn, { borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color={colors.accent} />
                  <Text style={[s.dateTimeBtnText, { color: colors.text }]}>
                    {selectedDate.toLocaleDateString('it-IT')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.dateTimeBtn, { borderColor: colors.border }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time" size={20} color={colors.accent} />
                  <Text style={[s.dateTimeBtnText, { color: colors.text }]}>
                    {selectedDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showDatePicker && (
                <DateTimePicker value={selectedDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} minimumDate={new Date()} />
              )}
              {showTimePicker && (
                <DateTimePicker value={selectedDate} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onTimeChange} is24Hour={true} />
              )}
              
              {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
                <TouchableOpacity style={[s.donePickerBtn, { backgroundColor: colors.accent }]} onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}>
                  <Text style={[s.donePickerBtnText, { color: colors.background }]}>Fatto</Text>
                </TouchableOpacity>
              )}
              
              <View style={s.modalBtns}>
                <TouchableOpacity
                  style={[s.modalBtn, { borderColor: colors.border }]}
                  onPress={() => { setShowCreateMatchday(false); setNewMatchday({ number: '', label: '' }); }}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Add Match */}
      <Modal visible={showAddMatch} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ padding: 24 }}>
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
              
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Data e Ora *</Text>
              <View style={s.dateTimeRow}>
                <TouchableOpacity
                  style={[s.dateTimeBtn, { borderColor: colors.border }]}
                  onPress={() => setShowMatchDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color={colors.accent} />
                  <Text style={[s.dateTimeBtnText, { color: colors.text }]}>
                    {matchDate.toLocaleDateString('it-IT')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.dateTimeBtn, { borderColor: colors.border }]}
                  onPress={() => setShowMatchTimePicker(true)}
                >
                  <Ionicons name="time" size={20} color={colors.accent} />
                  <Text style={[s.dateTimeBtnText, { color: colors.text }]}>
                    {matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {showMatchDatePicker && (
                <DateTimePicker value={matchDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(e, d) => { if (Platform.OS === 'android') setShowMatchDatePicker(false); if (d) setMatchDate(d); }} />
              )}
              {showMatchTimePicker && (
                <DateTimePicker value={matchDate} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} is24Hour={true} onChange={(e, d) => { if (Platform.OS === 'android') setShowMatchTimePicker(false); if (d) { const n = new Date(matchDate); n.setHours(d.getHours()); n.setMinutes(d.getMinutes()); setMatchDate(n); }}} />
              )}
              
              {Platform.OS === 'ios' && (showMatchDatePicker || showMatchTimePicker) && (
                <TouchableOpacity style={[s.donePickerBtn, { backgroundColor: colors.accent }]} onPress={() => { setShowMatchDatePicker(false); setShowMatchTimePicker(false); }}>
                  <Text style={[s.donePickerBtnText, { color: colors.background }]}>Fatto</Text>
                </TouchableOpacity>
              )}
              
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Tipo Mercato</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {MARKET_TYPES.map((mt) => (
                  <TouchableOpacity
                    key={mt}
                    style={[s.chip, { borderColor: colors.border }, newMatch.market_type === mt && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => setNewMatch(p => ({ ...p, market_type: mt }))}
                  >
                    <Text style={[s.chipText, { color: colors.text }, newMatch.market_type === mt && { color: colors.background }]}>
                      {mt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
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
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Matchday Dropdown */}
      <Modal visible={showMatchdayDropdown} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowMatchdayDropdown(false)}>
          <View style={[s.dropdownModal, { backgroundColor: colors.card }]}>
            <View style={s.dropdownModalHandle} />
            <Text style={[s.modalTitle, { color: colors.text }]}>Seleziona Giornata</Text>
            <ScrollView style={s.dropdownList}>
              {matchdays.map((md) => {
                const isSelected = selectedMatchday?.id === md.id;
                return (
                  <TouchableOpacity
                    key={md.id}
                    style={[s.dropdownItem, { borderColor: colors.border }, isSelected && { backgroundColor: 'rgba(245,166,35,0.1)', borderColor: colors.accent }]}
                    onPress={() => { setSelectedMatchday(md); setShowMatchdayDropdown(false); }}
                  >
                    <Text style={[s.dropdownItemText, { color: colors.text }]}>
                      {md.label || `Giornata ${md.number}`}
                    </Text>
                    <View style={[s.statusDot, { backgroundColor: getStatusColor(md.status) }]} />
                    <Text style={[s.dropdownStatusText, { color: colors.textSecondary }]}>{md.status}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
  
  descBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  descBannerText: { flex: 1 },
  descTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  descSubtitle: { fontSize: 13 },
  
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '500' },
  
  section: { borderRadius: 14, padding: 14, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { fontSize: 12, fontWeight: '600' },
  
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  
  emptyText: { fontSize: 14, fontStyle: 'italic', padding: 8, textAlign: 'center' },
  
  dropdownSelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderRadius: 12, marginBottom: 12, gap: 10 },
  dropdownText: { flex: 1, fontSize: 15, fontWeight: '600' },
  dropdownBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  dropdownBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  
  quickActions: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  quickBtnText: { fontSize: 13, fontWeight: '600' },
  
  matchCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  matchTeamsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600' },
  vsText: { fontSize: 12 },
  
  matchTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  matchTimeText: { fontSize: 12, fontWeight: '600' },
  
  matchControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  scoreInput: { width: 48, height: 44, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  scoreDash: { fontSize: 20 },
  
  statusSelector: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginLeft: 'auto' },
  statusSelectorText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  
  matchMeta: { fontSize: 11 },
  
  saveAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  saveAllBtnText: { fontSize: 15, fontWeight: '700' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalForm: { width: '100%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  modalOptionText: { flex: 1, fontSize: 16 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 4 },
  
  dateTimeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 10 },
  dateTimeBtnText: { fontSize: 15, fontWeight: '500' },
  
  donePickerBtn: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 8, marginBottom: 8 },
  donePickerBtnText: { fontSize: 15, fontWeight: '600' },
  
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  
  inlinePickerList: { borderWidth: 1.5, borderRadius: 10, marginBottom: 8, maxHeight: 180, overflow: 'hidden' },
  inlinePickerEmpty: { fontSize: 13, padding: 14, textAlign: 'center', fontStyle: 'italic' },
  inlinePickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  inlinePickerItemText: { fontSize: 15, fontWeight: '600' },
  
  dropdownModal: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' },
  dropdownModalHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  dropdownList: { maxHeight: 350 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8, gap: 10 },
  dropdownItemText: { flex: 1, fontSize: 15, fontWeight: '600' },
  dropdownStatusText: { fontSize: 12, fontWeight: '500' },
});
