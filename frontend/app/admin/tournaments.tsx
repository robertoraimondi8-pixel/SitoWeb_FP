/**
 * Admin Tournaments Console — FantaPronostic
 * Gestione completa tornei: crea, apri iscrizioni, avvia, round, knockout.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import ImportFixtures from './ImportFixtures';
import { colors } from '../../src/theme/designSystem';

type Tournament = {
  id: string; name: string; status: string;
  max_participants: number; duration_rounds: number;
  groups_count: number; players_per_group: number;
  advance_count: number; entry_fee: number;
  current_round: number; registered_count: number;
  spots_left: number; created_at: string;
  rounds?: RoundInfo[];
};

type RoundInfo = {
  id: string; round_number: number; round_type: string;
  status: string; label: string;
};

type GroupData = {
  group_name: string; group_id: string;
  standings: Array<{
    user_id: string; username: string; played: number;
    wins: number; draws: number; losses: number;
    group_points: number; prediction_points: number;
  }>;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  draft: { label: 'BOZZA', color: '#6b7280', icon: 'document-outline' },
  registration: { label: 'ISCRIZIONI', color: '#3b82f6', icon: 'person-add' },
  groups: { label: 'GIRONI', color: '#22c55e', icon: 'grid' },
  knockout: { label: 'KNOCKOUT', color: '#f59e0b', icon: 'flash' },
  completed: { label: 'CONCLUSO', color: '#6b7280', icon: 'checkmark-circle' },
};

const PRESETS = [
  { label: '8 giocatori (2 gironi da 4)', max: 8, groups: 2, ppg: 4, adv: 2, rounds: 3 },
  { label: '16 giocatori (4 gironi da 4)', max: 16, groups: 4, ppg: 4, adv: 2, rounds: 3 },
  { label: '32 giocatori (8 gironi da 4)', max: 32, groups: 8, ppg: 4, adv: 2, rounds: 3 },
];

export default function AdminTournaments() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Data
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [groupStandings, setGroupStandings] = useState<GroupData[]>([]);
  const [roundMatches, setRoundMatches] = useState<any[]>([]);
  const [selectedRound, setSelectedRound] = useState<RoundInfo | null>(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showAlert, setShowAlert] = useState<{ title: string; message: string } | null>(null);
  const [showCreateRound, setShowCreateRound] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', max_participants: 8, groups_count: 2, players_per_group: 4, advance_count: 2, duration_rounds: 3, entry_fee: 0 });

  const isSuperAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const alert = (title: string, message: string) => setShowAlert({ title, message });

  const fetchTournaments = useCallback(async () => {
    if (!token) return;
    try {
      // Admin uses same endpoint - gets all non-draft tournaments
      // But we also want drafts for admin, so we use a direct DB call via admin endpoint
      // For now, use the user endpoint which returns all non-draft tournaments
      const data = await apiCall<Tournament[]>('/tournaments?include_drafts=true', { token });
      setTournaments(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const fetchDetail = async (id: string) => {
    if (!token) return;
    try {
      const [detail, groups] = await Promise.all([
        apiCall<Tournament>(`/tournaments/${id}`, { token }),
        apiCall<GroupData[]>(`/tournaments/${id}/groups`, { token }).catch(() => []),
      ]);
      setSelected(detail);
      setGroupStandings(groups);
      setSelectedRound(null);
      setRoundMatches([]);
    } catch (e: any) {
      alert('Errore', e.message);
    }
  };

  const fetchRoundMatches = async (roundId: string) => {
    if (!token || !selected) return;
    try {
      const data = await apiCall<any>(`/tournaments/${selected.id}/rounds/${roundId}`, { token });
      setRoundMatches(data.matches || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  // ADMIN ACTIONS
  const createTournament = async () => {
    if (!token || !form.name.trim()) { alert('Errore', 'Inserisci il nome del torneo'); return; }
    setActionLoading(true);
    try {
      await apiCall('/tournaments', {
        method: 'POST', token,
        body: form,
      });
      alert('Fatto', 'Torneo creato in bozza');
      setShowCreate(false);
      setForm({ name: '', max_participants: 8, groups_count: 2, players_per_group: 4, advance_count: 2, duration_rounds: 3, entry_fee: 0 });
      fetchTournaments();
    } catch (e: any) {
      alert('Errore', e.message);
    } finally { setActionLoading(false); }
  };

  const openRegistration = async () => {
    if (!token || !selected) return;
    setActionLoading(true);
    try {
      await apiCall(`/tournaments/${selected.id}/open`, { method: 'POST', token });
      alert('Fatto', 'Iscrizioni aperte');
      fetchDetail(selected.id);
      fetchTournaments();
    } catch (e: any) {
      alert('Errore', e.message);
    } finally { setActionLoading(false); }
  };

  const startTournament = async () => {
    if (!token || !selected) return;
    setActionLoading(true);
    try {
      const res = await apiCall<any>(`/tournaments/${selected.id}/start`, { method: 'POST', token });
      alert('Torneo avviato', `${res.matchups_created} sfide create in ${res.groups.length} gironi`);
      fetchDetail(selected.id);
      fetchTournaments();
    } catch (e: any) {
      alert('Errore', e.message);
    } finally { setActionLoading(false); }
  };

  const createRound = async (roundType: string) => {
    if (!token || !selected) return;
    setActionLoading(true);
    try {
      await apiCall(`/tournaments/${selected.id}/rounds`, {
        method: 'POST', token,
        body: { round_type: roundType },
      });
      alert('Fatto', 'Round creato');
      setShowCreateRound(false);
      fetchDetail(selected.id);
    } catch (e: any) {
      alert('Errore', e.message);
    } finally { setActionLoading(false); }
  };

  const openRound = async (roundId: string) => {
    if (!token || !selected) return;
    setActionLoading(true);
    try {
      await apiCall(`/tournaments/${selected.id}/rounds/${roundId}/open`, { method: 'POST', token });
      alert('Fatto', 'Round aperto per i pronostici');
      fetchDetail(selected.id);
    } catch (e: any) {
      alert('Errore', e.message);
    } finally { setActionLoading(false); }
  };

  const completeRound = async (roundId: string) => {
    if (!token || !selected) return;
    setActionLoading(true);
    try {
      const res = await apiCall<any>(`/tournaments/${selected.id}/rounds/${roundId}/complete`, { method: 'POST', token });
      alert('Round completato', `Sfide aggiornate: ${res.matchups_updated}`);
      fetchDetail(selected.id);
    } catch (e: any) {
      alert('Errore', e.message);
    } finally { setActionLoading(false); }
  };

  const generateKnockout = async () => {
    if (!token || !selected) return;
    setActionLoading(true);
    try {
      const res = await apiCall<any>(`/tournaments/${selected.id}/generate-knockout`, {
        method: 'POST', token,
        body: { matchup_rules: '1v2' },
      });
      alert('Tabellone generato', `${res.knockout_matchups.length} sfide nel tabellone knockout`);
      fetchDetail(selected.id);
      fetchTournaments();
    } catch (e: any) {
      alert('Errore', e.message);
    } finally { setActionLoading(false); }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  // DETAIL VIEW
  if (selected) {
    const st = STATUS_MAP[selected.status] || STATUS_MAP.draft;
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setSelected(null); setGroupStandings([]); setSelectedRound(null); }} style={s.backBtn} data-testid="tournament-admin-back">
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{selected.name}</Text>
          {actionLoading && <ActivityIndicator size="small" color={colors.accent} />}
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDetail(selected.id).then(() => setRefreshing(false)); }} tintColor={colors.accent} />}>
          {/* Status + Info */}
          <View style={s.card}>
            <View style={s.row}>
              <View style={[s.statusPill, { backgroundColor: st.color + '20' }]}>
                <Ionicons name={st.icon as any} size={14} color={st.color} />
                <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
              </View>
              <Text style={s.infoSmall}>{selected.registered_count}/{selected.max_participants} iscritti</Text>
            </View>
            <View style={s.infoGrid}>
              <View style={s.infoItem}><Text style={s.infoVal}>{selected.groups_count}x{selected.players_per_group}</Text><Text style={s.infoLbl}>Gironi</Text></View>
              <View style={s.infoItem}><Text style={s.infoVal}>{selected.advance_count}</Text><Text style={s.infoLbl}>Passano</Text></View>
              <View style={s.infoItem}><Text style={s.infoVal}>{selected.duration_rounds}</Text><Text style={s.infoLbl}>Giornate</Text></View>
              <View style={s.infoItem}><Text style={s.infoVal}>{selected.current_round}</Text><Text style={s.infoLbl}>Round att.</Text></View>
            </View>
          </View>

          {/* Action Buttons based on status */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>AZIONI</Text>

            {selected.status === 'draft' && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={openRegistration} disabled={actionLoading} data-testid="open-registration-btn">
                <Ionicons name="megaphone" size={18} color="#fff" />
                <Text style={s.actionBtnText}>Apri Iscrizioni</Text>
              </TouchableOpacity>
            )}

            {selected.status === 'registration' && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: selected.registered_count >= selected.max_participants ? '#22c55e' : colors.border }]}
                onPress={startTournament}
                disabled={actionLoading || selected.registered_count < selected.max_participants}
                data-testid="start-tournament-btn"
              >
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={s.actionBtnText}>
                  {selected.registered_count < selected.max_participants
                    ? `Servono ${selected.max_participants - selected.registered_count} iscritti`
                    : 'Avvia Torneo (genera gironi)'}
                </Text>
              </TouchableOpacity>
            )}

            {(selected.status === 'groups' || selected.status === 'knockout') && (
              <>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={() => setShowCreateRound(true)} disabled={actionLoading} data-testid="create-round-btn">
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={s.actionBtnText}>Crea Nuovo Round</Text>
                </TouchableOpacity>

                {selected.status === 'groups' && (
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#f59e0b' }]} onPress={generateKnockout} disabled={actionLoading} data-testid="generate-knockout-btn">
                    <Ionicons name="git-network" size={18} color="#fff" />
                    <Text style={s.actionBtnText}>Genera Tabellone Knockout</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Rounds management */}
          {selected.rounds && selected.rounds.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>ROUND ({selected.rounds.length})</Text>
              {selected.rounds.map(r => {
                const isSelected = selectedRound?.id === r.id;
                return (
                  <View key={r.id}>
                    <TouchableOpacity
                      style={[s.roundCard, isSelected && { borderColor: colors.accent, borderWidth: 2 }]}
                      onPress={() => { setSelectedRound(isSelected ? null : r); if (!isSelected) fetchRoundMatches(r.id); }}
                      data-testid={`round-${r.id}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.roundLabel}>{r.label}</Text>
                        <Text style={s.roundMeta}>{r.round_type} - Round {r.round_number}</Text>
                      </View>
                      <View style={[s.roundStatusBadge, { backgroundColor: r.status === 'COMPLETED' ? '#22c55e20' : r.status === 'OPEN' ? '#3b82f620' : '#6b728020' }]}>
                        <Text style={[s.roundStatusText, { color: r.status === 'COMPLETED' ? '#22c55e' : r.status === 'OPEN' ? '#3b82f6' : '#6b7280' }]}>
                          {r.status}
                        </Text>
                      </View>
                      <Ionicons name={isSelected ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                    </TouchableOpacity>

                    {/* Expanded round actions */}
                    {isSelected && (
                      <View style={s.roundExpanded}>
                        <View style={s.roundActions}>
                          {r.status === 'PENDING' && (
                            <TouchableOpacity style={[s.smallBtn, { backgroundColor: '#3b82f6' }]} onPress={() => openRound(r.id)} data-testid={`open-round-${r.id}`}>
                              <Ionicons name="lock-open" size={14} color="#fff" />
                              <Text style={s.smallBtnText}>Apri per Pronostici</Text>
                            </TouchableOpacity>
                          )}
                          {r.status === 'OPEN' && (
                            <TouchableOpacity style={[s.smallBtn, { backgroundColor: '#22c55e' }]} onPress={() => completeRound(r.id)} data-testid={`complete-round-${r.id}`}>
                              <Ionicons name="checkmark-circle" size={14} color="#fff" />
                              <Text style={s.smallBtnText}>Completa Round</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Matches in this round */}
                        <Text style={s.roundMatchesTitle}>Partite ({roundMatches.length})</Text>
                        {roundMatches.length === 0 ? (
                          <Text style={s.emptyText}>Nessuna partita importata per questo round</Text>
                        ) : (
                          roundMatches.map((m: any) => (
                            <View key={m.id} style={s.matchRow}>
                              <Text style={s.matchTeam} numberOfLines={1}>{m.home_team}</Text>
                              <Text style={s.matchScore}>
                                {m.home_score !== null ? `${m.home_score} - ${m.away_score}` : 'vs'}
                              </Text>
                              <Text style={s.matchTeam} numberOfLines={1}>{m.away_team}</Text>
                            </View>
                          ))
                        )}

                        {/* Import fixtures for this round */}
                        {r.status !== 'COMPLETED' && selected && (
                          <ImportFixtures
                            leagueId={selected.id}
                            matchdayId={r.id}
                            matchdayLabel={r.label}
                            currentMatchCount={roundMatches.length}
                            token={token!}
                            colors={colors}
                            onImportComplete={() => fetchRoundMatches(r.id)}
                          />
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Group standings */}
          {groupStandings.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>CLASSIFICA GIRONI</Text>
              {groupStandings.map(g => (
                <View key={g.group_id} style={s.groupBlock}>
                  <Text style={s.groupTitle}>Girone {g.group_name}</Text>
                  <View style={s.tableHeader}>
                    <Text style={[s.cell, { flex: 2.5 }]}>Giocatore</Text>
                    <Text style={s.cell}>G</Text>
                    <Text style={s.cell}>V</Text>
                    <Text style={s.cell}>P</Text>
                    <Text style={s.cell}>S</Text>
                    <Text style={[s.cell, { fontWeight: '800' }]}>Pt</Text>
                  </View>
                  {g.standings.map((st, idx) => {
                    const qualifies = idx < selected.advance_count;
                    return (
                      <View key={st.user_id} style={[s.tableRow, qualifies && { borderLeftWidth: 3, borderLeftColor: '#22c55e', paddingLeft: 4 }]}>
                        <View style={[s.cell, { flex: 2.5, flexDirection: 'row', gap: 4 }]}>
                          <Text style={s.posNum}>{idx + 1}</Text>
                          <Text style={s.userName} numberOfLines={1}>{st.username}</Text>
                        </View>
                        <Text style={s.cell}>{st.played}</Text>
                        <Text style={[s.cell, { color: '#22c55e' }]}>{st.wins}</Text>
                        <Text style={s.cell}>{st.draws}</Text>
                        <Text style={[s.cell, { color: '#ef4444' }]}>{st.losses}</Text>
                        <Text style={[s.cell, { fontWeight: '800' }]}>{st.group_points}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Create Round Modal */}
        <Modal visible={showCreateRound} transparent animationType="fade">
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowCreateRound(false)}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Crea Nuovo Round</Text>
              {['group', 'quarterfinal', 'semifinal', 'final'].map(rt => (
                <TouchableOpacity key={rt} style={s.modalOption} onPress={() => createRound(rt)} data-testid={`create-round-type-${rt}`}>
                  <Ionicons name={rt === 'group' ? 'grid' : 'flash'} size={18} color={colors.accent} />
                  <Text style={s.modalOptionText}>
                    {rt === 'group' ? 'Fase a gironi' : rt === 'quarterfinal' ? 'Quarti di finale' : rt === 'semifinal' ? 'Semifinali' : 'Finale'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Alert Modal */}
        {showAlert && (
          <Modal visible transparent animationType="fade">
            <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAlert(null)}>
              <View style={s.modalContent}>
                <Text style={s.modalTitle}>{showAlert.title}</Text>
                <Text style={s.modalMessage}>{showAlert.message}</Text>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.accent }]} onPress={() => setShowAlert(null)}>
                  <Text style={s.actionBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </SafeAreaView>
    );
  }

  // LIST VIEW
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="tournaments-admin-back">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Gestione Tornei</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={s.headerAction} data-testid="create-tournament-btn">
          <Ionicons name="add-circle" size={26} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTournaments(); }} tintColor={colors.accent} />}
      >
        {tournaments.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Nessun torneo</Text>
            <Text style={s.emptyText}>Crea il primo torneo con il pulsante +</Text>
          </View>
        ) : (
          tournaments.map(t => {
            const st = STATUS_MAP[t.status] || STATUS_MAP.draft;
            return (
              <TouchableOpacity
                key={t.id} style={s.card}
                activeOpacity={0.8}
                onPress={() => fetchDetail(t.id)}
                data-testid={`admin-tournament-${t.id}`}
              >
                <View style={s.row}>
                  <Text style={s.cardName} numberOfLines={1}>{t.name}</Text>
                  <View style={[s.statusPill, { backgroundColor: st.color + '20' }]}>
                    <Ionicons name={st.icon as any} size={12} color={st.color} />
                    <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={s.cardMeta}>
                  <Text style={s.metaText}>{t.registered_count}/{t.max_participants} iscritti</Text>
                  <Text style={s.metaDot}> </Text>
                  <Text style={s.metaText}>{t.groups_count}x{t.players_per_group} gironi</Text>
                  <Text style={s.metaDot}> </Text>
                  <Text style={s.metaText}>{t.duration_rounds} round</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ position: 'absolute', right: 16, top: '50%' }} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Create Tournament Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
            <View style={s.modalForm}>
              <Text style={s.modalTitle}>Crea Nuovo Torneo</Text>

              <Text style={s.inputLabel}>Nome *</Text>
              <TextInput style={s.formInput} placeholder="Es: Torneo Primavera 2026" placeholderTextColor={colors.textMuted}
                value={form.name} onChangeText={t => setForm(p => ({ ...p, name: t }))} data-testid="tournament-name-input" />

              <Text style={s.inputLabel}>Preset rapido</Text>
              <View style={s.presetRow}>
                {PRESETS.map(p => (
                  <TouchableOpacity key={p.max} style={[s.presetBtn, form.max_participants === p.max && s.presetBtnActive]}
                    onPress={() => setForm(f => ({ ...f, max_participants: p.max, groups_count: p.groups, players_per_group: p.ppg, advance_count: p.adv, duration_rounds: p.rounds }))}
                    data-testid={`preset-${p.max}`}
                  >
                    <Text style={[s.presetBtnText, form.max_participants === p.max && s.presetBtnTextActive]}>{p.max}</Text>
                    <Text style={[s.presetBtnSub, form.max_participants === p.max && s.presetBtnSubActive]}>{p.label.split('(')[1]?.replace(')', '') || ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.formRow}>
                <View style={s.formCol}>
                  <Text style={s.inputLabel}>Gironi</Text>
                  <TextInput style={s.formInput} keyboardType="numeric" value={String(form.groups_count)}
                    onChangeText={t => setForm(p => ({ ...p, groups_count: parseInt(t) || 0 }))} />
                </View>
                <View style={s.formCol}>
                  <Text style={s.inputLabel}>Per girone</Text>
                  <TextInput style={s.formInput} keyboardType="numeric" value={String(form.players_per_group)}
                    onChangeText={t => setForm(p => ({ ...p, players_per_group: parseInt(t) || 0 }))} />
                </View>
              </View>

              <View style={s.formRow}>
                <View style={s.formCol}>
                  <Text style={s.inputLabel}>Passano</Text>
                  <TextInput style={s.formInput} keyboardType="numeric" value={String(form.advance_count)}
                    onChangeText={t => setForm(p => ({ ...p, advance_count: parseInt(t) || 0 }))} />
                </View>
                <View style={s.formCol}>
                  <Text style={s.inputLabel}>Giornate</Text>
                  <TextInput style={s.formInput} keyboardType="numeric" value={String(form.duration_rounds)}
                    onChangeText={t => setForm(p => ({ ...p, duration_rounds: parseInt(t) || 0 }))} />
                </View>
              </View>

              <View style={s.formSummary}>
                <Text style={s.formSummaryText}>
                  Totale: {form.groups_count * form.players_per_group} partecipanti = {form.groups_count} gironi x {form.players_per_group} giocatori
                </Text>
              </View>

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={s.cancelBtnText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.accent, flex: 1 }]} onPress={createTournament} disabled={actionLoading} data-testid="confirm-create-btn">
                  {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name="trophy" size={18} color="#fff" />
                      <Text style={s.actionBtnText}>Crea Torneo</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Alert Modal */}
      {showAlert && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAlert(null)}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>{showAlert.title}</Text>
              <Text style={s.modalMessage}>{showAlert.message}</Text>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.accent }]} onPress={() => setShowAlert(null)}>
                <Text style={s.actionBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1, textAlign: 'center' },
  headerAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  // Cards
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 2 },
  cardName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, flex: 1, marginRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  metaDot: { fontSize: 12, color: colors.textMuted },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  // Info grid
  infoGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  infoItem: { alignItems: 'center', gap: 2 },
  infoVal: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  infoLbl: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  infoSmall: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Section
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  // Actions
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, marginBottom: 8 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Rounds
  roundCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 6, gap: 8 },
  roundLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  roundMeta: { fontSize: 11, color: colors.textMuted },
  roundStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roundStatusText: { fontSize: 10, fontWeight: '700' },
  roundExpanded: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background, borderRadius: 8, marginBottom: 8 },
  roundActions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  roundMatchesTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },

  // Matches
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  matchTeam: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  matchScore: { fontSize: 13, fontWeight: '800', color: colors.accent, paddingHorizontal: 10, textAlign: 'center', minWidth: 50 },

  // Groups
  groupBlock: { marginBottom: 14 },
  groupTitle: { fontSize: 14, fontWeight: '800', color: colors.accent, marginBottom: 6 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cell: { flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  posNum: { fontSize: 12, fontWeight: '700', color: colors.textMuted, width: 18 },
  userName: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, flex: 1 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalForm: { backgroundColor: colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 500 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 },
  modalMessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalOptionText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },

  // Form
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  formInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  formRow: { flexDirection: 'row', gap: 10 },
  formCol: { flex: 1 },
  formSummary: { backgroundColor: '#3b82f610', borderRadius: 8, padding: 10, marginTop: 10 },
  formSummaryText: { fontSize: 13, fontWeight: '600', color: '#3b82f6', textAlign: 'center' },

  presetRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  presetBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  presetBtnActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' },
  presetBtnText: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  presetBtnTextActive: { color: colors.accent },
  presetBtnSub: { fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  presetBtnSubActive: { color: colors.accent },

  cancelBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});
