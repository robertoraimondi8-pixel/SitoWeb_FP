/**
 * Admin Console v3 - FantaPronostic
 * Console unificata per Lega Nazionale e leghe private.
 * Flusso kickoff-driven: DRAFT → OPEN → LIVE (auto) → COMPLETED (auto)
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
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall, isAuthError } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import ImportFixtures from './ImportFixtures';
import WebDateTimePicker from './WebDateTimePicker';
import { colors } from '../../src/theme/designSystem';

const isWeb = Platform.OS === 'web';

interface League { id: string; name: string; _is_national?: boolean; match_source_type?: string; season_id?: string; owner_id?: string; }
interface Matchday { id: string; number: number; label?: string; status: string; first_kickoff?: string; season_id?: string; league_id?: string; match_count: number; results_count: number; predictions_user_count: number; }
interface Match { id: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null; status: string; market_type: string; start_time?: string; is_special?: boolean; multiplier?: number; }

const MARKET_TYPES = ['1X2', 'GOAL_NGOAL', 'OVER_UNDER', 'EXACT_SCORE'];
const MATCH_STATUS_OPTIONS = ['scheduled', 'live', 'finished', 'postponed', 'cancelled', 'void'];
const MAX_MATCHES = 10;

const STATUS_LABELS: Record<string, string> = { DRAFT: 'BOZZA', OPEN: 'APERTA', LIVE: 'IN CORSO', COMPLETED: 'COMPLETATA' };
const TRANSITION_BTN: Record<string, { label: string; target: string; icon: string }> = {
  DRAFT: { label: 'Pubblica Giornata', target: 'OPEN', icon: 'rocket' },
};

export default function AdminConsoleV3() {
  const { user, token, handleAuthError } = useAuth();
  const { activeLeague } = useLeague();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Leagues
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [showLeagueDropdown, setShowLeagueDropdown] = useState(false);

  // Matchdays
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<Matchday | null>(null);
  const [showMatchdayDropdown, setShowMatchdayDropdown] = useState(false);

  // Matches
  const [matches, setMatches] = useState<Match[]>([]);
  const [editingResults, setEditingResults] = useState<Record<string, { home: string; away: string; status: string }>>({});
  const [modifiedMatches, setModifiedMatches] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateMatchday, setShowCreateMatchday] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showMatchStatusPicker, setShowMatchStatusPicker] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  // Forms
  const [newMatchday, setNewMatchday] = useState({ number: '', label: '' });
  const [showNumberPicker, setShowNumberPicker] = useState(false);
  const getDefaultDate = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(15, 0, 0, 0); return d; };
  const [selectedDate, setSelectedDate] = useState(getDefaultDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [newMatch, setNewMatch] = useState({ home_team: '', away_team: '', market_type: '1X2', competition: '' });
  const [matchDate, setMatchDate] = useState(getDefaultDate());
  const [showMatchDatePicker, setShowMatchDatePicker] = useState(false);
  const [showMatchTimePicker, setShowMatchTimePicker] = useState(false);

  const isSuperAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isCompleted = selectedMatchday?.status === 'COMPLETED';
  const isLive = selectedMatchday?.status === 'LIVE';
  const isOpen = selectedMatchday?.status === 'OPEN';
  const isDraft = selectedMatchday?.status === 'DRAFT';
  const canEditMatches = selectedMatchday && isDraft;

  // Check access
  useEffect(() => {
    if (user && !isSuperAdmin) {
      // League admins can access too - we'll check via API
    }
    loadLeagues();
  }, [user]);

  // Load matchdays when league changes
  useEffect(() => {
    if (selectedLeague) {
      loadMatchdays(selectedLeague.id);
      setSelectedMatchday(null);
      setMatches([]);
    }
  }, [selectedLeague?.id]);

  // Load matches when matchday changes
  useEffect(() => {
    if (selectedMatchday && selectedLeague) {
      loadMatches(selectedMatchday.id);
    }
  }, [selectedMatchday?.id]);

  const authErr = async (e: unknown) => {
    if (isAuthError(e)) { const d = await handleAuthError(e); if (d) router.replace('/(auth)/login'); return true; }
    return false;
  };

  const loadLeagues = async () => {
    try {
      setLoading(true); setError('');
      const data = await apiCall('/admin/v3/leagues', { token });
      setLeagues(data);
      if (isSuperAdmin) {
        // Super admin: keep dropdown, auto-select first league if none selected
        if (data.length > 0 && !selectedLeague) {
          setSelectedLeague(data[0]);
        }
      } else {
        // League owner: lock to active league from Home context
        if (activeLeague) {
          const match = data.find((l: League) => l.id === activeLeague.id);
          if (match) {
            setSelectedLeague(match);
          } else {
            setError('Non hai i permessi di admin per questa lega. Torna alla Home e seleziona una lega che gestisci.');
          }
        } else {
          setError('Nessuna lega attiva. Torna alla Home e seleziona una lega.');
        }
      }
    } catch (e: unknown) {
      if (await authErr(e)) return;
      setError(e.message || 'Errore caricamento leghe');
    } finally { setLoading(false); }
  };

  const loadMatchdays = async (leagueId: string) => {
    try {
      const data = await apiCall(`/admin/v3/matchdays?league_id=${leagueId}`, { token });
      setMatchdays(data);
      // Sync selectedMatchday with fresh data (e.g. first_kickoff, status)
      setSelectedMatchday(prev => {
        if (!prev) return null;
        const updated = data.find((md: Matchday) => md.id === prev.id);
        return updated || prev;
      });
    } catch (e: unknown) {
      if (await authErr(e)) return;
    }
  };

  const loadMatches = async (matchdayId: string) => {
    if (!selectedLeague) return;
    try {
      // Use admin matches endpoint for national, league endpoint for private
      let data;
      if (selectedLeague._is_national) {
        data = await apiCall(`/admin/matches?matchday_id=${matchdayId}`, { token });
      } else {
        data = await apiCall(`/leagues/${selectedLeague.id}/matchdays/${matchdayId}/matches`, { token });
      }
      setMatches(data);
      const initial: Record<string, { home: string; away: string; status: string }> = {};
      data.forEach((m: Match) => {
        initial[m.id] = { home: m.home_score !== null ? String(m.home_score) : '', away: m.away_score !== null ? String(m.away_score) : '', status: m.status };
      });
      setEditingResults(initial);
      setModifiedMatches(new Set());
    } catch (e: unknown) {
      if (await authErr(e)) return;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeagues();
    if (selectedLeague) await loadMatchdays(selectedLeague.id);
    setRefreshing(false);
  }, [selectedLeague]);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  // === Helper: cross-platform confirm/alert ===
  const showAlert = (title: string, message: string) => {
    setConfirmModal({ visible: true, title, message, onConfirm: () => setConfirmModal(p => ({ ...p, visible: false })) });
  };
  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        visible: true, title, message,
        onConfirm: () => { setConfirmModal(p => ({ ...p, visible: false })); resolve(true); },
      });
      // If modal is dismissed without confirm, resolve false
    });
  };

  // === TRANSITION ===
  const doTransition = async (targetStatus: string) => {
    if (!selectedMatchday || !selectedLeague) return;
    const label = STATUS_LABELS[targetStatus] || targetStatus;

    setActionLoading(true);
    try {
      await apiCall(`/admin/matchday/${selectedMatchday.id}/transition`, {
        method: 'POST', token,
        body: { league_id: selectedLeague.id, target_status: targetStatus },
      });
      showAlert('Fatto!', `Giornata ${label}`);
      await loadMatchdays(selectedLeague.id);
      setSelectedMatchday(prev => prev ? { ...prev, status: targetStatus } : null);
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Transizione fallita');
    } finally { setActionLoading(false); }
  };

  // === RECALCULATE ===
  const doRecalculate = async () => {
    if (!selectedMatchday || !selectedLeague) return;
    if (!(await showConfirm('Ricalcola', 'Ricalcolare tutti i punteggi per questa giornata?'))) return;
    setActionLoading(true);
    try {
      await apiCall(`/admin/matchday/${selectedMatchday.id}/recalculate`, {
        method: 'POST', token,
        body: { league_id: selectedLeague.id },
      });
      showAlert('Fatto!', 'Punteggi ricalcolati');
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Ricalcolo fallito');
    } finally { setActionLoading(false); }
  };

  // === REFRESH LIVE SCORES ===
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  // === SUPER_ADMIN OVERRIDE ===
  const doOverride = async (targetStatus: string | null) => {
    if (!selectedMatchday || !selectedLeague) return;
    setActionLoading(true);
    try {
      await apiCall(`/admin/matchday/${selectedMatchday.id}/override`, {
        method: 'POST', token,
        body: { league_id: selectedLeague.id, target_status: targetStatus },
      });
      const msg = targetStatus ? `Stato forzato a ${STATUS_LABELS[targetStatus] || targetStatus}` : 'Override rimosso';
      showAlert('Fatto!', msg);
      setShowOverrideModal(false);
      await loadMatchdays(selectedLeague.id);
      if (targetStatus) {
        setSelectedMatchday(prev => prev ? { ...prev, status: targetStatus } : null);
      }
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Override fallito');
    } finally { setActionLoading(false); }
  };
  const doRefreshLive = async () => {
    setLiveRefreshing(true);
    try {
      await apiCall('/admin/real-fixtures/refresh-live', { method: 'POST', token });
      showAlert('Aggiornamento avviato', 'I risultati live verranno aggiornati a breve.');
      if (selectedMatchday) await loadMatches(selectedMatchday.id);
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Aggiornamento fallito');
    } finally { setLiveRefreshing(false); }
  };

  // === MATCHDAY CRUD ===
  const getAvailableNumbers = () => {
    const used = matchdays.map(md => md.number);
    return Array.from({ length: 40 }, (_, i) => i + 1).filter(n => !used.includes(n));
  };

  const createMatchday = async () => {
    if (!selectedLeague || !newMatchday.number) { showAlert('Errore', 'Seleziona il numero'); return; }
    setActionLoading(true);
    try {
      const num = parseInt(newMatchday.number, 10);
      const half = num <= 19 ? 1 : 2;
      const endpoint = selectedLeague._is_national
        ? '/admin/matchdays'
        : `/leagues/${selectedLeague.id}/matchdays`;
      const body: Record<string, unknown> = {
        season_id: selectedLeague.season_id,
        number: num,
        label: newMatchday.label || `Giornata ${num}`,
        half,
        status: 'DRAFT',
      };
      await apiCall(endpoint, { method: 'POST', token, body });
      showAlert('Fatto!', 'Giornata creata in Bozza. Aggiungi le partite e poi pubblicala.');
      setShowCreateMatchday(false);
      setNewMatchday({ number: '', label: '' });
      await loadMatchdays(selectedLeague.id);
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Impossibile creare');
    } finally { setActionLoading(false); }
  };

  const deleteMatchday = async () => {
    if (!selectedMatchday || !selectedLeague) return;
    if (!(await showConfirm('Elimina Giornata', 'Sei sicuro? Verranno eliminati anche partite, pronostici e punteggi.'))) return;
    setActionLoading(true);
    try {
      const endpoint = selectedLeague._is_national
        ? `/admin/matchdays/${selectedMatchday.id}`
        : `/leagues/${selectedLeague.id}/matchdays/${selectedMatchday.id}`;
      await apiCall(endpoint, { method: 'DELETE', token });
      showAlert('Fatto!', 'Giornata eliminata');
      setSelectedMatchday(null); setMatches([]);
      await loadMatchdays(selectedLeague.id);
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Errore eliminazione');
    } finally { setActionLoading(false); }
  };

  // === MATCH CRUD ===
  const addMatch = async () => {
    if (!selectedMatchday || !selectedLeague || !newMatch.home_team || !newMatch.away_team) {
      showAlert('Errore', 'Inserisci entrambe le squadre'); return;
    }
    setActionLoading(true);
    try {
      const endpoint = selectedLeague._is_national
        ? '/admin/matches'
        : `/leagues/${selectedLeague.id}/matchdays/${selectedMatchday.id}/matches`;
      const body: Record<string, unknown> = {
        home_team: newMatch.home_team, away_team: newMatch.away_team,
        market_type: newMatch.market_type, competition: newMatch.competition,
        start_time: matchDate.toISOString(), status: 'scheduled',
      };
      if (selectedLeague._is_national) body.matchday_id = selectedMatchday.id;
      await apiCall(endpoint, { method: 'POST', token, body });
      showAlert('Fatto!', 'Partita aggiunta');
      setShowAddMatch(false);
      setNewMatch({ home_team: '', away_team: '', market_type: '1X2', competition: '' });
      setMatchDate(getDefaultDate());
      await loadMatches(selectedMatchday.id);
      await loadMatchdays(selectedLeague.id);
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Impossibile aggiungere');
    } finally { setActionLoading(false); }
  };

  const deleteMatch = async (matchId: string) => {
    if (!(await showConfirm('Elimina Partita', 'Eliminare questa partita?'))) return;
    if (!selectedMatchday || !selectedLeague) return;
    setActionLoading(true);
    try {
      const endpoint = selectedLeague._is_national
        ? `/admin/matches/${matchId}`
        : `/leagues/${selectedLeague.id}/matches/${matchId}`;
      await apiCall(endpoint, { method: 'DELETE', token });
      await loadMatches(selectedMatchday.id);
      await loadMatchdays(selectedLeague.id);
    } catch (e: unknown) {
      showAlert('Errore', e.message || 'Errore eliminazione');
    } finally { setActionLoading(false); }
  };

  const updateMatchResult = (matchId: string, field: 'home' | 'away' | 'status', value: string) => {
    setEditingResults(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }));
    setModifiedMatches(prev => new Set(prev).add(matchId));
  };

  const saveAllResults = async () => {
    if (modifiedMatches.size === 0 || !selectedLeague) { showAlert('Info', 'Nessuna modifica'); return; }
    setActionLoading(true);
    let saved = 0, errors = 0;
    for (const matchId of modifiedMatches) {
      const r = editingResults[matchId]; if (!r) continue;
      try {
        const homeScore = r.home ? parseInt(r.home, 10) : null;
        const awayScore = r.away ? parseInt(r.away, 10) : null;
        const body: Record<string, unknown> = { status: r.status };
        if (homeScore !== null && !isNaN(homeScore)) body.home_score = homeScore;
        if (awayScore !== null && !isNaN(awayScore)) body.away_score = awayScore;

        if (selectedLeague._is_national) {
          await apiCall(`/admin/matches/${matchId}`, { method: 'PUT', token, body });
        } else {
          await apiCall(`/leagues/${selectedLeague.id}/matches/${matchId}`, { method: 'PUT', token, body });
        }
        saved++;
      } catch { errors++; }
    }
    setModifiedMatches(new Set());
    if (errors > 0) showAlert('Attenzione', `Salvati ${saved}, errori ${errors}`);
    else showAlert('Fatto!', `${saved} risultati salvati`);
    if (selectedMatchday) { await loadMatches(selectedMatchday.id); await loadMatchdays(selectedLeague.id); }
    setActionLoading(false);
  };

  // Date handlers
  const onDateChange = (_: unknown, d?: Date) => { if (Platform.OS === 'android') setShowDatePicker(false); if (d) setSelectedDate(d); };
  const onTimeChange = (_: unknown, d?: Date) => { if (Platform.OS === 'android') setShowTimePicker(false); if (d) { const n = new Date(selectedDate); n.setHours(d.getHours(), d.getMinutes()); setSelectedDate(n); } };

  // Computed
  const resultsInserted = matches.filter(m => m.home_score !== null && m.away_score !== null).length;
  const transitionInfo = selectedMatchday ? TRANSITION_BTN[selectedMatchday.status] : null;

  // === RENDER ===
  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      </SafeAreaView>
    );
  }

  if (leagues.length === 0) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Console Admin</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="information-circle" size={48} color={colors.accent} />
          <Text style={[s.errorText, { color: colors.textPrimary }]}>Nessuna lega da gestire</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32, marginTop: 8 }}>
            Le leghe che usano le partite della Lega Nazionale non richiedono gestione manuale.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header} data-testid="admin-header">
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Console Admin</Text>
        {actionLoading && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      {/* League Selector: dropdown per super admin, statico per league owner */}
      {isSuperAdmin ? (
        <TouchableOpacity
          data-testid="league-selector"
          style={[s.leagueSelector, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowLeagueDropdown(true)}
        >
          <Ionicons name={selectedLeague?._is_national ? 'trophy' : 'shield'} size={20} color={colors.accent} />
          <Text style={[s.leagueSelectorText, { color: colors.textPrimary }]} numberOfLines={1}>
            {selectedLeague?.name || 'Seleziona lega...'}
          </Text>
          {selectedLeague?._is_national && (
            <View style={[s.nationalBadge, { backgroundColor: colors.accent }]}>
              <Text style={s.nationalBadgeText}>NAZIONALE</Text>
            </View>
          )}
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View
          data-testid="league-selector-static"
          style={[s.leagueSelector, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="shield" size={20} color={colors.accent} />
          <Text style={[s.leagueSelectorText, { color: colors.textPrimary }]} numberOfLines={1}>
            {selectedLeague?.name || 'Nessuna lega attiva'}
          </Text>
        </View>
      )}

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

        {/* TORNEI Link — solo super admin */}
        {isSuperAdmin && (
          <TouchableOpacity
            data-testid="admin-tournaments-link"
            style={[s.section, { backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={() => router.push('/admin/tournaments' as any)}
            activeOpacity={0.7}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trophy" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Gestione Tornei</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Crea, gestisci e avvia tornei</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* GIORNATE Section */}
        <View style={[s.section, { backgroundColor: colors.card }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.accent }]}>
              <Ionicons name="football" size={16} /> GIORNATE
            </Text>
            <TouchableOpacity
              data-testid="create-matchday-btn"
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
            <TouchableOpacity
              data-testid="matchday-selector"
              style={[s.dropdownSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowMatchdayDropdown(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.accent} />
              <Text style={[s.dropdownText, { color: colors.textPrimary }]}>
                {selectedMatchday ? (selectedMatchday.label || `Giornata ${selectedMatchday.number}`) : 'Seleziona giornata...'}
              </Text>
              {selectedMatchday && (
                <View style={[s.statusBadge, { backgroundColor: getStatusColor(selectedMatchday.status) }]}>
                  <Text style={s.statusBadgeText}>{STATUS_LABELS[selectedMatchday.status] || selectedMatchday.status}</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* MATCHDAY DETAIL */}
        {selectedMatchday && (
          <>
            {/* Stats Row */}
            <View style={[s.statsRow, { backgroundColor: colors.card }]}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: colors.textPrimary }]}>{selectedMatchday.match_count}</Text>
                <Text style={[s.statLabel, { color: colors.textSecondary }]}>Partite</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: colors.border }]} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: colors.textPrimary }]}>{selectedMatchday.results_count}/{selectedMatchday.match_count}</Text>
                <Text style={[s.statLabel, { color: colors.textSecondary }]}>Risultati</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: colors.border }]} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: colors.textPrimary }]}>{selectedMatchday.predictions_user_count}</Text>
                <Text style={[s.statLabel, { color: colors.textSecondary }]}>Pronostici</Text>
              </View>
            </View>

            {/* Transition Button */}
            <View style={[s.section, { backgroundColor: colors.card }]}>
              <Text style={[s.sectionTitle, { color: colors.accent, marginBottom: 12 }]}>
                <Ionicons name="git-branch" size={16} /> STATO GIORNATA
              </Text>

              {/* State flow indicator (Kickoff-driven: DRAFT → OPEN → LIVE → COMPLETED) */}
              <View style={s.stateFlow}>
                {['DRAFT', 'OPEN', 'LIVE', 'COMPLETED'].map((st, i) => {
                  const isCurrent = selectedMatchday.status === st;
                  const isPast = ['DRAFT', 'OPEN', 'LIVE', 'COMPLETED'].indexOf(selectedMatchday.status) > i;
                  return (
                    <React.Fragment key={st}>
                      {i > 0 && <View style={[s.stateFlowLine, { backgroundColor: isPast ? colors.accent : colors.border }]} />}
                      <View style={[
                        s.stateFlowDot,
                        { borderColor: isCurrent ? colors.accent : isPast ? colors.accent : colors.border },
                        (isCurrent || isPast) && { backgroundColor: isCurrent ? colors.accent : `${colors.accent}40` }
                      ]}>
                        {isPast && <Ionicons name="checkmark" size={10} color={colors.accent} />}
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={s.stateLabels}>
                {['BOZZA', 'APERTA', 'LIVE', 'COMPLETATA'].map((label, i) => (
                  <Text key={label} style={[s.stateLabel, { color: ['DRAFT', 'OPEN', 'LIVE', 'COMPLETED'].indexOf(selectedMatchday.status) >= i ? colors.text : colors.textSecondary }]}>
                    {label}
                  </Text>
                ))}
              </View>

              {/* Auto-status info banner */}
              {isOpen && selectedMatchday.first_kickoff && (
                <View style={[s.autoStatusBanner, { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }]}>
                  <Ionicons name="time-outline" size={18} color="rgba(59,130,246,0.9)" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.autoStatusTitle, { color: colors.textPrimary }]}>Pronostici aperti</Text>
                    <Text style={[s.autoStatusDesc, { color: colors.textSecondary }]}>
                      Diventerà LIVE automaticamente al primo fischio:{'\n'}
                      {new Date(selectedMatchday.first_kickoff).toLocaleString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              )}
              {isOpen && !selectedMatchday.first_kickoff && (
                <View style={[s.autoStatusBanner, { backgroundColor: 'rgba(245,166,35,0.1)', borderColor: 'rgba(245,166,35,0.3)' }]}>
                  <Ionicons name="warning-outline" size={18} color="rgba(245,166,35,0.9)" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.autoStatusTitle, { color: colors.textPrimary }]}>Nessun orario kickoff</Text>
                    <Text style={[s.autoStatusDesc, { color: colors.textSecondary }]}>
                      Le partite non hanno un orario di inizio. La transizione LIVE non avverrà automaticamente.
                    </Text>
                  </View>
                </View>
              )}
              {isLive && (
                <View style={[s.autoStatusBanner, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
                  <Ionicons name="radio" size={18} color="rgba(239,68,68,0.9)" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.autoStatusTitle, { color: colors.textPrimary }]}>Giornata in corso</Text>
                    <Text style={[s.autoStatusDesc, { color: colors.textSecondary }]}>
                      Diventerà COMPLETATA automaticamente quando tutte le partite saranno finite.
                    </Text>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              <View style={s.transitionActions}>
                {transitionInfo && (
                  <TouchableOpacity
                    data-testid="transition-btn"
                    style={[s.transitionBtn, { backgroundColor: getStatusColor(transitionInfo.target) }]}
                    onPress={() => doTransition(transitionInfo.target)}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={transitionInfo.icon as React.ComponentProps<typeof Ionicons>['name']} size={22} color="#fff" />
                    <Text style={s.transitionBtnText}>{transitionInfo.label}</Text>
                  </TouchableOpacity>
                )}

                {isCompleted && isSuperAdmin && (
                  <TouchableOpacity
                    data-testid="recalculate-btn"
                    style={[s.transitionBtn, { backgroundColor: 'rgba(59,130,246,0.9)' }]}
                    onPress={doRecalculate}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh" size={22} color="#fff" />
                    <Text style={s.transitionBtnText}>Ricalcola Giornata</Text>
                  </TouchableOpacity>
                )}

                {/* SUPER_ADMIN Override */}
                {isSuperAdmin && !isCompleted && (
                  <TouchableOpacity
                    data-testid="override-btn"
                    style={[s.overrideBtn, { borderColor: 'rgba(245,166,35,0.5)' }]}
                    onPress={() => setShowOverrideModal(true)}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="shield" size={16} color="rgba(245,166,35,0.9)" />
                    <Text style={[s.overrideBtnText, { color: 'rgba(245,166,35,0.9)' }]}>Override Super Admin</Text>
                  </TouchableOpacity>
                )}

                {isDraft && (
                  <TouchableOpacity
                    data-testid="delete-matchday-btn"
                    style={[s.deleteBtn]}
                    onPress={deleteMatchday}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={[s.deleteBtnText, { color: colors.error }]}>Elimina Giornata</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* PARTITE Section */}
            <View style={[s.section, { backgroundColor: colors.card }]}>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: colors.accent }]}>
                  <Ionicons name="list" size={16} /> PARTITE ({matches.length}/{MAX_MATCHES})
                </Text>
                {canEditMatches && matches.length < MAX_MATCHES && (
                  <TouchableOpacity
                    data-testid="add-match-btn"
                    style={[s.addBtn, { backgroundColor: colors.accent }]}
                    onPress={() => setShowAddMatch(true)}
                  >
                    <Ionicons name="add" size={18} color={colors.background} />
                    <Text style={[s.addBtnText, { color: colors.background }]}>Aggiungi</Text>
                  </TouchableOpacity>
                )}
                {canEditMatches && matches.length >= MAX_MATCHES && (
                  <View style={[s.addBtn, { backgroundColor: colors.border }]}>
                    <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                    <Text style={[s.addBtnText, { color: colors.textSecondary }]}>Max {MAX_MATCHES}</Text>
                  </View>
                )}
              </View>

              {/* Results progress */}
              {matches.length > 0 && (
                <View style={s.progressRow}>
                  <Text style={[s.progressText, { color: colors.textSecondary }]}>
                    Risultati inseriti: {resultsInserted} / {matches.length}
                  </Text>
                  <View style={[s.progressBar, { backgroundColor: colors.border }]}>
                    <View style={[s.progressFill, { backgroundColor: colors.accent, width: `${matches.length > 0 ? (resultsInserted / matches.length) * 100 : 0}%` }]} />
                  </View>
                </View>
              )}

              {matches.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>Nessuna partita</Text>
              ) : (
                <>
                  {matches.map((match) => {
                    const isModified = modifiedMatches.has(match.id);
                    const matchTime = match.start_time ? new Date(match.start_time) : null;
                    return (
                      <View key={match.id} style={[
                        s.matchCard,
                        { borderColor: match.is_special ? colors.accent : isModified ? colors.accent : colors.border },
                        (isModified || match.is_special) && { borderWidth: 2 }
                      ]}>
                        <View style={s.matchTeamsRow}>
                          {match.is_special && (
                            <View style={[s.specialBadge, { backgroundColor: colors.accent }]}>
                              <Text style={s.specialBadgeText}>X3</Text>
                            </View>
                          )}
                          <Text style={[s.teamName, { color: colors.textPrimary }]} numberOfLines={1}>{match.home_team}</Text>
                          <Text style={[s.vsText, { color: colors.textSecondary }]}>vs</Text>
                          <Text style={[s.teamName, { color: colors.textPrimary }]} numberOfLines={1}>{match.away_team}</Text>
                          {canEditMatches && (
                            <TouchableOpacity onPress={() => deleteMatch(match.id)} data-testid={`delete-match-${match.id}`}>
                              <Ionicons name="close-circle" size={22} color={colors.error} />
                            </TouchableOpacity>
                          )}
                        </View>
                        {matchTime && (
                          <View style={s.matchTimeRow}>
                            <Ionicons name="time-outline" size={14} color={colors.accent} />
                            <Text style={[s.matchTimeText, { color: colors.accent }]}>
                              {matchTime.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })} {matchTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        )}
                        {/* Score inputs */}
                        <View style={s.matchControlsRow}>
                          <TextInput
                            data-testid={`score-home-${match.id}`}
                            style={[s.scoreInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            keyboardType="numeric" placeholder="H" placeholderTextColor={colors.textSecondary}
                            value={editingResults[match.id]?.home || ''} editable={!isCompleted}
                            onChangeText={(t) => updateMatchResult(match.id, 'home', t)}
                          />
                          <Text style={[s.scoreDash, { color: colors.textSecondary }]}>-</Text>
                          <TextInput
                            data-testid={`score-away-${match.id}`}
                            style={[s.scoreInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            keyboardType="numeric" placeholder="A" placeholderTextColor={colors.textSecondary}
                            value={editingResults[match.id]?.away || ''} editable={!isCompleted}
                            onChangeText={(t) => updateMatchResult(match.id, 'away', t)}
                          />
                          <TouchableOpacity
                            style={[s.statusSelector, { backgroundColor: getMatchStatusColor(editingResults[match.id]?.status || match.status) }]}
                            onPress={() => !isCompleted && setShowMatchStatusPicker(match.id)}
                            disabled={isCompleted}
                          >
                            <Text style={s.statusSelectorText}>{(editingResults[match.id]?.status || match.status).toUpperCase().slice(0, 4)}</Text>
                          </TouchableOpacity>
                        </View>
                        {/* X3 Toggle + Modified indicator */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <Text style={[s.matchMeta, { color: colors.textSecondary }]}>{isModified && 'Modificato'}</Text>
                          {!isCompleted && (
                            <TouchableOpacity
                              data-testid={`special-toggle-${match.id}`}
                              style={[s.specialToggle, match.is_special && { backgroundColor: `${colors.accent}15`, borderColor: colors.accent }]}
                              onPress={async () => {
                                try {
                                  await apiCall(`/admin/matches/${match.id}/special`, {
                                    method: 'POST', token,
                                    body: { is_special: !match.is_special },
                                  });
                                  await loadMatchdays(selectedLeague!.id);
                                  await loadMatches(selectedMatchday!.id);
                                } catch (e: any) { showAlert('Errore', e.message); }
                              }}
                            >
                              <Ionicons name={match.is_special ? 'star' : 'star-outline'} size={14} color={match.is_special ? colors.accent : colors.textSecondary} />
                              <Text style={[s.specialToggleText, { color: match.is_special ? colors.accent : colors.textSecondary }]}>
                                {match.is_special ? 'Partita X3' : 'Imposta X3'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}

                  {/* Save Results button */}
                  {!isCompleted && (
                    <TouchableOpacity
                      data-testid="save-results-btn"
                      style={[s.saveAllBtn, { backgroundColor: modifiedMatches.size > 0 ? colors.accent : colors.border }]}
                      onPress={saveAllResults} disabled={modifiedMatches.size === 0}
                    >
                      <Ionicons name="save" size={20} color={modifiedMatches.size > 0 ? colors.background : colors.textSecondary} />
                      <Text style={[s.saveAllBtnText, { color: modifiedMatches.size > 0 ? colors.background : colors.textSecondary }]}>
                        SALVA RISULTATI ({modifiedMatches.size} modifiche)
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* IMPORTA PARTITE REALI Section - disponibile per leghe che gestiscono partite proprie */}
            {(selectedLeague._is_national || ['api', 'custom', 'national'].includes(selectedLeague.match_source_type ?? '')) && selectedMatchday && selectedMatchday.status !== 'COMPLETED' && (
              <ImportFixtures
                leagueId={selectedLeague.id}
                matchdayId={selectedMatchday.id}
                matchdayLabel={selectedMatchday.label || `Giornata ${selectedMatchday.number}`}
                currentMatchCount={matches.length}
                token={token!}
                colors={colors}
                onImportComplete={async () => {
                  await loadMatches(selectedMatchday.id);
                  await loadMatchdays(selectedLeague.id);
                }}
              />
            )}

            {/* AGGIORNA RISULTATI LIVE - for national league OR api-type leagues with super admin */}
            {(selectedLeague._is_national || selectedLeague.match_source_type === 'api') && isSuperAdmin && (
              <View style={[s.section, { backgroundColor: colors.card }]}>
                <Text style={[s.sectionTitle, { color: colors.accent, marginBottom: 12 }]}>
                  <Ionicons name="sync" size={16} /> RISULTATI LIVE
                </Text>
                <Text style={[s.emptyText, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Aggiorna manualmente i risultati delle partite live dall'API.
                </Text>
                <TouchableOpacity
                  data-testid="refresh-live-btn"
                  style={[s.transitionBtn, { backgroundColor: liveRefreshing ? colors.border : '#059669' }]}
                  onPress={doRefreshLive}
                  disabled={liveRefreshing || actionLoading}
                  activeOpacity={0.7}
                >
                  {liveRefreshing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="sync" size={20} color="#fff" />
                  )}
                  <Text style={s.transitionBtnText}>
                    {liveRefreshing ? 'Aggiornamento...' : 'Aggiorna Risultati Live'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal: League Dropdown (solo super admin) */}
      {isSuperAdmin && (
      <Modal visible={showLeagueDropdown} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowLeagueDropdown(false)}>
          <View style={[s.dropdownModal, { backgroundColor: colors.card }]}>
            <View style={s.dropdownModalHandle} />
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Seleziona Lega</Text>
            <ScrollView style={s.dropdownList}>
              {leagues.filter(l => l._is_national).map(lg => (
                <TouchableOpacity
                  key={lg.id}
                  style={[s.dropdownItem, { borderColor: colors.border }, selectedLeague?.id === lg.id && { borderColor: colors.accent, backgroundColor: `${colors.accent}10` }]}
                  onPress={() => { setSelectedLeague(lg); setShowLeagueDropdown(false); }}
                >
                  <Ionicons name="trophy" size={20} color={colors.accent} />
                  <Text style={[s.dropdownItemText, { color: colors.text, flex: 1 }]}>{lg.name}</Text>
                  <View style={[s.nationalBadge, { backgroundColor: colors.accent }]}><Text style={s.nationalBadgeText}>NAZIONALE</Text></View>
                  {selectedLeague?.id === lg.id && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </TouchableOpacity>
              ))}
              {leagues.some(l => l._is_national) && leagues.some(l => !l._is_national) && (
                <View style={[s.divider, { backgroundColor: colors.border }]} />
              )}
              {leagues.filter(l => !l._is_national).map(lg => (
                <TouchableOpacity
                  key={lg.id}
                  style={[s.dropdownItem, { borderColor: colors.border }, selectedLeague?.id === lg.id && { borderColor: colors.accent, backgroundColor: `${colors.accent}10` }]}
                  onPress={() => { setSelectedLeague(lg); setShowLeagueDropdown(false); }}
                >
                  <Ionicons name="shield" size={20} color={colors.textSecondary} />
                  <Text style={[s.dropdownItemText, { color: colors.text, flex: 1 }]}>{lg.name}</Text>
                  {selectedLeague?.id === lg.id && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      )}

      {/* Modal: Matchday Dropdown */}
      <Modal visible={showMatchdayDropdown} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowMatchdayDropdown(false)}>
          <View style={[s.dropdownModal, { backgroundColor: colors.card }]}>
            <View style={s.dropdownModalHandle} />
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Seleziona Giornata</Text>
            <ScrollView style={s.dropdownList}>
              {matchdays.map(md => {
                const isSelected = selectedMatchday?.id === md.id;
                return (
                  <TouchableOpacity
                    key={md.id}
                    style={[s.dropdownItem, { borderColor: colors.border }, isSelected && { borderColor: colors.accent, backgroundColor: `${colors.accent}10` }]}
                    onPress={() => { setSelectedMatchday(md); setShowMatchdayDropdown(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.dropdownItemText, { color: colors.textPrimary }]}>{md.label || `Giornata ${md.number}`}</Text>
                      <Text style={[s.dropdownItemMeta, { color: colors.textSecondary }]}>
                        {md.match_count} partite | {md.results_count}/{md.match_count} risultati | {md.predictions_user_count} pronostici
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: getStatusColor(md.status) }]}>
                      <Text style={s.statusBadgeText}>{STATUS_LABELS[md.status] || md.status}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Match Status Picker */}
      <Modal visible={!!showMatchStatusPicker} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowMatchStatusPicker(null)}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Stato Partita</Text>
            {MATCH_STATUS_OPTIONS.map(st => (
              <TouchableOpacity key={st} style={[s.modalOption, { borderColor: colors.border }]}
                onPress={() => { updateMatchResult(showMatchStatusPicker!, 'status', st); setShowMatchStatusPicker(null); }}>
                <View style={[s.statusDot, { backgroundColor: getMatchStatusColor(st) }]} />
                <Text style={[s.modalOptionText, { color: colors.textPrimary }]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Create Matchday (Simplified - no date/time, auto-computed from matches) */}
      <Modal visible={showCreateMatchday} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ padding: 0 }} keyboardShouldPersistTaps="handled">
            <View style={[s.modalForm, { backgroundColor: colors.card }]}>
              <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Nuova Giornata</Text>
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Numero *</Text>
              <TouchableOpacity
                style={[s.formInput, { borderColor: showNumberPicker ? colors.accent : colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setShowNumberPicker(v => !v)}>
                <Text style={{ color: newMatchday.number ? colors.text : colors.textSecondary, fontSize: 15 }}>
                  {newMatchday.number ? `Giornata ${newMatchday.number}` : 'Seleziona numero...'}
                </Text>
                <Ionicons name={showNumberPicker ? "chevron-up" : "chevron-down"} size={20} color={colors.accent} />
              </TouchableOpacity>
              {showNumberPicker && (
                <ScrollView style={[s.inlinePickerList, { borderColor: colors.accent, backgroundColor: colors.background }]} nestedScrollEnabled>
                  {getAvailableNumbers().length === 0 ? (
                    <Text style={[s.inlinePickerEmpty, { color: colors.textSecondary }]}>Tutti i numeri in uso</Text>
                  ) : (
                    getAvailableNumbers().map(num => (
                      <TouchableOpacity key={num} style={[s.inlinePickerItem, { borderBottomColor: colors.border }]}
                        onPress={() => { setNewMatchday(p => ({ ...p, number: String(num), label: `Giornata ${num}` })); setShowNumberPicker(false); }}>
                        <Text style={[s.inlinePickerItemText, { color: colors.textPrimary }]}>Giornata {num}</Text>
                        {newMatchday.number === String(num) && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Etichetta (opzionale)</Text>
              <TextInput style={[s.formInput, { color: colors.text, borderColor: colors.border }]} placeholder="Es: Giornata 12" placeholderTextColor={colors.textSecondary}
                value={newMatchday.label} onChangeText={t => setNewMatchday(p => ({ ...p, label: t }))} />
              <View style={[s.autoStatusBanner, { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', marginTop: 12 }]}>
                <Ionicons name="information-circle" size={18} color="rgba(59,130,246,0.9)" />
                <Text style={[s.autoStatusDesc, { color: colors.textSecondary }]}>
                  L'orario del primo fischio verrà calcolato automaticamente dalle partite che aggiungerai.
                </Text>
              </View>
              <View style={s.modalBtns}>
                <TouchableOpacity style={[s.modalBtn, { borderColor: colors.border }]}
                  onPress={() => { setShowCreateMatchday(false); setNewMatchday({ number: '', label: '' }); setShowNumberPicker(false); }}>
                  <Text style={[s.modalBtnText, { color: colors.textSecondary }]}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.accent }]} onPress={createMatchday}>
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
              <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Aggiungi Partita</Text>
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Squadra Casa *</Text>
              <TextInput style={[s.formInput, { color: colors.text, borderColor: colors.border }]} placeholder="Es: Juventus" placeholderTextColor={colors.textSecondary}
                value={newMatch.home_team} onChangeText={t => setNewMatch(p => ({ ...p, home_team: t }))} />
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Squadra Ospite *</Text>
              <TextInput style={[s.formInput, { color: colors.text, borderColor: colors.border }]} placeholder="Es: Inter" placeholderTextColor={colors.textSecondary}
                value={newMatch.away_team} onChangeText={t => setNewMatch(p => ({ ...p, away_team: t }))} />
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Competizione</Text>
              <TextInput style={[s.formInput, { color: colors.text, borderColor: colors.border }]} placeholder="Es: Serie A" placeholderTextColor={colors.textSecondary}
                value={newMatch.competition} onChangeText={t => setNewMatch(p => ({ ...p, competition: t }))} />
              <Text style={[s.inputLabel, { color: colors.textSecondary }]}>Data e Ora *</Text>
              <View style={s.dateTimeRow}>
                <TouchableOpacity style={[s.dateTimeBtn, { borderColor: colors.border }]} onPress={() => setShowMatchDatePicker(true)}>
                  <Ionicons name="calendar" size={20} color={colors.accent} />
                  <Text style={[s.dateTimeBtnText, { color: colors.textPrimary }]}>{matchDate.toLocaleDateString('it-IT')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.dateTimeBtn, { borderColor: colors.border }]} onPress={() => setShowMatchTimePicker(true)}>
                  <Ionicons name="time" size={20} color={colors.accent} />
                  <Text style={[s.dateTimeBtnText, { color: colors.textPrimary }]}>{matchDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>
              {showMatchDatePicker && (isWeb
                ? <WebDateTimePicker value={matchDate} mode="date" onChange={d => { setMatchDate(d); setShowMatchDatePicker(false); }} />
                : <DateTimePicker value={matchDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, d) => { if (Platform.OS === 'android') setShowMatchDatePicker(false); if (d) setMatchDate(d); }} />
              )}
              {showMatchTimePicker && (isWeb
                ? <WebDateTimePicker value={matchDate} mode="time" onChange={d => { const n = new Date(matchDate); n.setHours(d.getHours(), d.getMinutes()); setMatchDate(n); setShowMatchTimePicker(false); }} />
                : <DateTimePicker value={matchDate} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} is24Hour onChange={(_, d) => { if (Platform.OS === 'android') setShowMatchTimePicker(false); if (d) { const n = new Date(matchDate); n.setHours(d.getHours(), d.getMinutes()); setMatchDate(n); }}} />
              )}
              {Platform.OS === 'ios' && (showMatchDatePicker || showMatchTimePicker) && (
                <TouchableOpacity style={[s.donePickerBtn, { backgroundColor: colors.accent }]} onPress={() => { setShowMatchDatePicker(false); setShowMatchTimePicker(false); }}>
                  <Text style={[s.donePickerBtnText, { color: colors.background }]}>Fatto</Text>
                </TouchableOpacity>
              )}
              <View style={s.modalBtns}>
                <TouchableOpacity style={[s.modalBtn, { borderColor: colors.border }]} onPress={() => { setShowAddMatch(false); setShowMatchDatePicker(false); setShowMatchTimePicker(false); }}>
                  <Text style={[s.modalBtnText, { color: colors.textSecondary }]}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.accent }]} onPress={addMatch}>
                  <Text style={[s.modalBtnText, { color: colors.background }]}>Aggiungi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Super Admin Override */}
      <Modal visible={showOverrideModal} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowOverrideModal(false)}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="shield" size={22} color="rgba(245,166,35,0.9)" />
              <Text style={[s.modalTitle, { color: colors.text, marginBottom: 0 }]}>Override Super Admin</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
              Forza lo stato della giornata. Usa solo in caso di emergenza.
            </Text>
            {['DRAFT', 'OPEN', 'LIVE', 'COMPLETED'].map((st) => (
              <TouchableOpacity key={st} style={[s.modalOption, { borderColor: colors.border }]}
                onPress={() => doOverride(st)}>
                <View style={[s.statusDot, { backgroundColor: getStatusColor(st) }]} />
                <Text style={[s.modalOptionText, { color: colors.textPrimary }]}>{STATUS_LABELS[st] || st}</Text>
                {selectedMatchday?.status === st && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.modalOption, { borderColor: colors.border }]}
              onPress={() => doOverride(null)}>
              <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
              <Text style={[s.modalOptionText, { color: colors.textSecondary }]}>Rimuovi Override (stato automatico)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Confirmation Dialog */}
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setConfirmModal(p => ({ ...p, visible: false }))}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>{confirmModal.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 20 }}>{confirmModal.message}</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, { borderColor: colors.border }]}
                onPress={() => setConfirmModal(p => ({ ...p, visible: false }))}>
                <Text style={[s.modalBtnText, { color: colors.textSecondary }]}>Chiudi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.accent }]}
                onPress={confirmModal.onConfirm}>
                <Text style={[s.modalBtnText, { color: colors.background }]}>Conferma</Text>
              </TouchableOpacity>
            </View>
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
  errorText: { fontSize: 16, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },

  leagueSelector: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, gap: 10 },
  leagueSelectorText: { flex: 1, fontSize: 15, fontWeight: '600' },
  nationalBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  nationalBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  scrollContent: { padding: 16, paddingBottom: 100 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '500' },

  section: { borderRadius: 14, padding: 14, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 14, fontStyle: 'italic', padding: 8, textAlign: 'center' },

  dropdownSelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderRadius: 12, marginBottom: 12, gap: 10 },
  dropdownText: { flex: 1, fontSize: 15, fontWeight: '600' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Stats row
  statsRow: { flexDirection: 'row', borderRadius: 14, padding: 16, marginBottom: 16, justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  statDivider: { width: 1, height: 32 },

  // State flow
  stateFlow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4, paddingHorizontal: 8 },
  stateFlowLine: { flex: 1, height: 2 },
  stateFlowDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stateLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 0 },
  stateLabel: { fontSize: 9, fontWeight: '600', textAlign: 'center', width: 60 },

  transitionActions: { gap: 10 },
  transitionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 12 },
  transitionBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)' },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
  overrideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  overrideBtnText: { fontSize: 13, fontWeight: '600' },
  autoStatusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  autoStatusTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  autoStatusDesc: { fontSize: 12, lineHeight: 18 },

  // Progress
  progressRow: { marginBottom: 12 },
  progressText: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // Match card
  matchCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  specialBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 4 },
  specialBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  specialToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  specialToggleText: { fontSize: 12, fontWeight: '600' },
  matchTeamsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600' },
  vsText: { fontSize: 12 },
  matchTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  matchTimeText: { fontSize: 12, fontWeight: '600' },
  matchControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  scoreInput: { width: 48, height: 44, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  scoreDash: { fontSize: 20 },
  statusSelector: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginLeft: 'auto' },
  statusSelectorText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  matchMeta: { fontSize: 11 },

  saveAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  saveAllBtnText: { fontSize: 15, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalForm: { width: '100%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  modalOptionText: { flex: 1, fontSize: 16 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },

  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 4 },
  dateTimeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 10 },
  dateTimeBtnText: { fontSize: 15, fontWeight: '500' },
  donePickerBtn: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 8, marginBottom: 8 },
  donePickerBtnText: { fontSize: 15, fontWeight: '600' },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },

  inlinePickerList: { borderWidth: 1.5, borderRadius: 10, marginBottom: 8, maxHeight: 220, overflow: 'hidden' },
  inlinePickerEmpty: { fontSize: 13, padding: 14, textAlign: 'center', fontStyle: 'italic' },
  inlinePickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  inlinePickerItemText: { fontSize: 15, fontWeight: '600' },

  dropdownModal: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' },
  dropdownModalHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  dropdownList: { maxHeight: 350 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8, gap: 10 },
  dropdownItemText: { fontSize: 15, fontWeight: '600' },
  dropdownItemMeta: { fontSize: 11, marginTop: 2 },
  divider: { height: 1, marginVertical: 8 },
});
