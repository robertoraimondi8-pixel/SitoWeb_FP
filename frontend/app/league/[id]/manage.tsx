import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { apiCall, isAuthError } from '../../../src/api/client';
import { LeagueDetail, getErrorMessage } from '../../../src/types/api';
import { Ionicons } from '@expo/vector-icons';

export default function LeagueManageScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token, user, handleAuthError } = useAuth();
  const router = useRouter();

  const [league, setLeague]       = useState<LeagueDetail | null>(null);
  const [matchdays, setMatchdays] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedMd, setExpandedMd] = useState<string | null>(null);
  const [mdMatches, setMdMatches] = useState<Record<string, any[]>>({});

  // New matchday form
  const [showAddMd, setShowAddMd]     = useState(false);
  const [newMdNumber, setNewMdNumber] = useState('');
  const [newMdLabel, setNewMdLabel]   = useState('');
  const [newMdKickoff, setNewMdKickoff] = useState('');
  const [savingMd, setSavingMd]       = useState(false);

  // New match form
  const [addMatchFor, setAddMatchFor] = useState<string | null>(null);
  const [newHome, setNewHome]         = useState('');
  const [newAway, setNewAway]         = useState('');
  const [newKickoff, setNewKickoff]   = useState('');
  const [savingMatch, setSavingMatch] = useState(false);

  const s = makeStyles(colors);

  const load = useCallback(async () => {
    if (!token || !leagueId) return;
    try {
      const [lg, mds] = await Promise.all([
        apiCall(`/leagues/${leagueId}`, { token }),
        apiCall(`/leagues/${leagueId}/matchdays`, { token }),
      ]);
      setLeague(lg);
      setMatchdays(mds);
    } catch (e: unknown) {
      if (isAuthError(e)) { const d = await handleAuthError(e); if (d) router.replace('/(auth)/login'); }
    } finally {
      setLoading(false);
    }
  }, [token, leagueId]);

  useEffect(() => { load(); }, [load]);

  const loadMatches = async (mdId: string) => {
    if (mdMatches[mdId]) return;
    try {
      const m = await apiCall(`/leagues/${leagueId}/matchdays/${mdId}/matches`, { token });
      setMdMatches(prev => ({ ...prev, [mdId]: m }));
    } catch (_) {}
  };

  const handleAddMatchday = async () => {
    const num = parseInt(newMdNumber);
    if (!num || num < 1 || num > 38) { Alert.alert('Errore', 'Giornata tra 1 e 38'); return; }
    setSavingMd(true);
    try {
      const md = await apiCall(`/leagues/${leagueId}/matchdays`, {
        method: 'POST', token,
        body: { number: num, label: newMdLabel || `Giornata ${num}`, half: 1, first_kickoff: newMdKickoff || null, season_id: league?.season_id },
      });
      setMatchdays(prev => [...prev, md].sort((a, b) => a.number - b.number));
      setShowAddMd(false); setNewMdNumber(''); setNewMdLabel(''); setNewMdKickoff('');
    } catch (e: unknown) { Alert.alert('Errore', e.message); }
    finally { setSavingMd(false); }
  };

  const handleDeleteMatchday = (mdId: string, num: number) => {
    Alert.alert('Elimina Giornata', `Eliminare la giornata ${num} e tutte le sue partite?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive', onPress: async () => {
          await apiCall(`/leagues/${leagueId}/matchdays/${mdId}`, { method: 'DELETE', token });
          setMatchdays(prev => prev.filter(m => m.id !== mdId));
          setMdMatches(prev => { const n = { ...prev }; delete n[mdId]; return n; });
        },
      },
    ]);
  };

  const handleAddMatch = async (mdId: string) => {
    if (!newHome.trim() || !newAway.trim()) { Alert.alert('Errore', 'Inserisci entrambe le squadre'); return; }
    setSavingMatch(true);
    try {
      const m = await apiCall(`/leagues/${leagueId}/matchdays/${mdId}/matches`, {
        method: 'POST', token,
        body: {
          home_team: newHome.trim(), away_team: newAway.trim(),
          start_time: newKickoff || null, competition: '', market_type: '1X2', status: 'PENDING',
        },
      });
      setMdMatches(prev => ({ ...prev, [mdId]: [...(prev[mdId] || []), m] }));
      setMatchdays(prev => prev.map(md => md.id === mdId ? { ...md, match_count: (md.match_count || 0) + 1 } : md));
      setAddMatchFor(null); setNewHome(''); setNewAway(''); setNewKickoff('');
    } catch (e: unknown) { Alert.alert('Errore', e.message); }
    finally { setSavingMatch(false); }
  };

  const handleDeleteMatch = (mdId: string, matchId: string) => {
    Alert.alert('Elimina Partita', 'Eliminare questa partita?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive', onPress: async () => {
          await apiCall(`/leagues/${leagueId}/matchdays/${mdId}/matches/${matchId}`, { method: 'DELETE', token });
          setMdMatches(prev => ({ ...prev, [mdId]: (prev[mdId] || []).filter(m => m.id !== matchId) }));
          setMatchdays(prev => prev.map(md => md.id === mdId ? { ...md, match_count: Math.max(0, (md.match_count || 1) - 1) } : md));
        },
      },
    ]);
  };

  if (loading) return <View style={[s.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.accent} /></View>;

  const isOwner = league?.owner_id === user?.id;
  const isManual = league?.match_source_type === 'manual';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: colors.text }]}>{league?.name}</Text>
            <Text style={[s.headerSub, { color: colors.textSecondary }]}>Creator Console</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Source type info */}
          {!isManual ? (
            <View style={[s.infoBox, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '44' }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
              <Text style={[s.infoText, { color: colors.text }]}>
                Questa lega usa le partite della Lega Nazionale. Le partite si aggiornano automaticamente.
              </Text>
            </View>
          ) : !isOwner ? (
            <View style={[s.infoBox, { backgroundColor: colors.border, borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <Text style={[s.infoText, { color: colors.textSecondary }]}>Solo il creatore può gestire le partite.</Text>
            </View>
          ) : null}

          {isManual && isOwner && (
            <>
              {/* Add Matchday */}
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Giornate ({matchdays.length})</Text>
                <TouchableOpacity
                  style={[s.addBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setShowAddMd(!showAddMd)}
                >
                  <Ionicons name={showAddMd ? 'close' : 'add'} size={18} color={colors.background} />
                  <Text style={[s.addBtnText, { color: colors.background }]}>{showAddMd ? 'Annulla' : 'Aggiungi'}</Text>
                </TouchableOpacity>
              </View>

              {showAddMd && (
                <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.formTitle, { color: colors.text }]}>Nuova Giornata</Text>
                  <View style={s.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Numero *</Text>
                      <TextInput style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        placeholder="Es: 1" placeholderTextColor={colors.textSecondary} value={newMdNumber} onChangeText={setNewMdNumber} keyboardType="number-pad" maxLength={2} />
                    </View>
                    <View style={{ flex: 2, marginLeft: 12 }}>
                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Etichetta</Text>
                      <TextInput style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                        placeholder="Es: Giornata 1" placeholderTextColor={colors.textSecondary} value={newMdLabel} onChangeText={setNewMdLabel} />
                    </View>
                  </View>
                  <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Data/Ora primo fischio (ISO)</Text>
                  <TextInput style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    placeholder="Es: 2025-10-05T15:00:00" placeholderTextColor={colors.textSecondary} value={newMdKickoff} onChangeText={setNewMdKickoff} />
                  <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.accent }]} onPress={handleAddMatchday} disabled={savingMd}>
                    {savingMd ? <ActivityIndicator color={colors.background} /> : <Text style={[s.submitBtnText, { color: colors.background }]}>Crea Giornata</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* Matchdays list */}
              {matchdays.map(md => (
                <View key={md.id} style={[s.mdCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={s.mdHeader}
                    onPress={() => {
                      const next = expandedMd === md.id ? null : md.id;
                      setExpandedMd(next);
                      if (next) loadMatches(md.id);
                    }}
                  >
                    <View style={[s.mdNumBadge, { backgroundColor: colors.accent + '20' }]}>
                      <Text style={[s.mdNumText, { color: colors.accent }]}>{md.number}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mdLabel, { color: colors.text }]}>{md.label || `Giornata ${md.number}`}</Text>
                      <Text style={[s.mdMeta, { color: colors.textSecondary }]}>{md.match_count || 0} partite</Text>
                    </View>
                    <TouchableOpacity
                      style={s.deleteMdBtn}
                      onPress={() => handleDeleteMatchday(md.id, md.number)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error || '#EF4444'} />
                    </TouchableOpacity>
                    <Ionicons name={expandedMd === md.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {expandedMd === md.id && (
                    <View style={s.matchList}>
                      {(mdMatches[md.id] || []).map(match => (
                        <View key={match.id} style={[s.matchRow, { borderTopColor: colors.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.matchTeams, { color: colors.text }]}>{match.home_team} – {match.away_team}</Text>
                            {match.start_time && <Text style={[s.matchKickoff, { color: colors.textSecondary }]}>{match.start_time}</Text>}
                          </View>
                          <TouchableOpacity onPress={() => handleDeleteMatch(md.id, match.id)} style={s.deleteMatchBtn}>
                            <Ionicons name="close-circle-outline" size={20} color={colors.error || '#EF4444'} />
                          </TouchableOpacity>
                        </View>
                      ))}

                      {addMatchFor === md.id ? (
                        <View style={[s.addMatchForm, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                          <Text style={[s.formTitle, { color: colors.text }]}>Nuova Partita</Text>
                          <View style={s.formRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Casa *</Text>
                              <TextInput style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                                placeholder="Milan" placeholderTextColor={colors.textSecondary} value={newHome} onChangeText={setNewHome} />
                            </View>
                            <Text style={[s.vsLabel, { color: colors.textSecondary }]}>vs</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Trasferta *</Text>
                              <TextInput style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                                placeholder="Inter" placeholderTextColor={colors.textSecondary} value={newAway} onChangeText={setNewAway} />
                            </View>
                          </View>
                          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Fischio d'inizio (ISO)</Text>
                          <TextInput style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                            placeholder="2025-10-05T20:45:00" placeholderTextColor={colors.textSecondary} value={newKickoff} onChangeText={setNewKickoff} />
                          <View style={s.formRow}>
                            <TouchableOpacity style={[s.submitBtn, { flex: 1, backgroundColor: colors.accent }]} onPress={() => handleAddMatch(md.id)} disabled={savingMatch}>
                              {savingMatch ? <ActivityIndicator color={colors.background} /> : <Text style={[s.submitBtnText, { color: colors.background }]}>Aggiungi</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.cancelBtn, { flex: 1, borderColor: colors.border }]} onPress={() => { setAddMatchFor(null); setNewHome(''); setNewAway(''); setNewKickoff(''); }}>
                              <Text style={[s.cancelBtnText, { color: colors.text }]}>Annulla</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[s.addMatchBtn, { borderColor: colors.accent + '55' }]}
                          onPress={() => { setAddMatchFor(md.id); setNewHome(''); setNewAway(''); setNewKickoff(''); }}
                        >
                          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                          <Text style={[s.addMatchBtnText, { color: colors.accent }]}>Aggiungi partita</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}

              {matchdays.length === 0 && (
                <View style={[s.emptyState, { borderColor: colors.border }]}>
                  <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
                  <Text style={[s.emptyText, { color: colors.textSecondary }]}>Nessuna giornata ancora.{"\n"}Aggiungi la prima giornata!</Text>
                </View>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: typeof import("../../../src/theme/designSystem").colors) => StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  formCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16, gap: 10 },
  formTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  formRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  submitBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { fontSize: 14, fontWeight: '700' },
  cancelBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginTop: 4 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  mdCard: { borderWidth: 1, borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  mdHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  mdNumBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  mdNumText: { fontSize: 15, fontWeight: '800' },
  mdLabel: { fontSize: 14, fontWeight: '600' },
  mdMeta: { fontSize: 12, marginTop: 2 },
  deleteMdBtn: { padding: 6 },
  matchList: { borderTopWidth: 1 },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  matchTeams: { fontSize: 13, fontWeight: '600' },
  matchKickoff: { fontSize: 11, marginTop: 2 },
  deleteMatchBtn: { padding: 4 },
  addMatchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' },
  addMatchBtnText: { fontSize: 14, fontWeight: '600' },
  addMatchForm: { padding: 14, borderTopWidth: 1 },
  vsLabel: { fontSize: 13, fontWeight: '700', paddingBottom: 10 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
