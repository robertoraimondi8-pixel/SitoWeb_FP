/**
 * ImportFixtures — Sezione admin per importare partite reali da API-Football.
 * Flusso: Campionato → Date → Cerca → Seleziona → Importa
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/api/client';

interface ApiLeague {
  league_id: number;
  name: string;
  country: string;
  logo: string | null;
  current_season: number | null;
}

interface Fixture {
  fixture_id: number;
  date: string;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  home_goals: number | null;
  away_goals: number | null;
  status_short: string;
  status_long: string;
  round: string | null;
}

interface Props {
  leagueId: string;
  matchdayId: string;
  matchdayLabel: string;
  currentMatchCount: number;
  token: string;
  colors: Record<string, string>;
  onImportComplete: () => void;
}

const MAX_IMPORT = 10;

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    from: mon.toISOString().slice(0, 10),
    to: sun.toISOString().slice(0, 10),
  };
}

function formatFixtureDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(s: string): { text: string; color: string } {
  switch (s) {
    case 'NS': case 'TBD': return { text: 'Non iniziata', color: 'rgba(59,130,246,0.9)' };
    case '1H': case '2H': case 'HT': case 'ET': case 'LIVE': return { text: 'IN CORSO', color: 'rgba(239,68,68,0.9)' };
    case 'FT': case 'AET': case 'PEN': return { text: 'Terminata', color: 'rgba(34,197,94,0.9)' };
    case 'PST': return { text: 'Rinviata', color: 'rgba(245,166,35,0.9)' };
    default: return { text: s, color: 'rgba(107,114,128,0.9)' };
  }
}

export default function ImportFixtures({ leagueId, matchdayId, matchdayLabel, currentMatchCount, token, colors, onImportComplete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [apiLeagues, setApiLeagues] = useState<ApiLeague[]>([]);
  const [selectedApiLeague, setSelectedApiLeague] = useState<ApiLeague | null>(null);
  const [showLeaguePicker, setShowLeaguePicker] = useState(false);

  const [dateFrom, setDateFrom] = useState(getWeekRange().from);
  const [dateTo, setDateTo] = useState(getWeekRange().to);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempFrom, setTempFrom] = useState(dateFrom);
  const [tempTo, setTempTo] = useState(dateTo);

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const maxCanSelect = MAX_IMPORT - currentMatchCount;

  // Load API leagues on expand
  useEffect(() => {
    if (expanded && apiLeagues.length === 0) {
      loadApiLeagues();
    }
  }, [expanded]);

  const loadApiLeagues = async () => {
    setLoadingLeagues(true);
    setError('');
    try {
      const data = await apiCall('/admin/real-fixtures/leagues', { token });
      setApiLeagues(data);
      if (data.length > 0) setSelectedApiLeague(data[0]);
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('suspended') || msg.includes('API-Football')) {
        setError('Dati calcio temporaneamente non disponibili. La quota API potrebbe essere esaurita.');
      } else {
        setError('Errore caricamento campionati');
      }
    } finally {
      setLoadingLeagues(false);
    }
  };

  const searchFixtures = async () => {
    if (!selectedApiLeague) return;
    setSearching(true);
    setError('');
    setSuccessMsg('');
    setFixtures([]);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({
        league: String(selectedApiLeague.league_id),
        season: String(selectedApiLeague.current_season),
        from: dateFrom,
        to: dateTo,
      });
      const data = await apiCall(`/admin/real-fixtures/search?${params}`, { token });
      setFixtures(data);
      if (data.length === 0) setError('Nessuna partita trovata per questo periodo');
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('suspended') || msg.includes('API-Football')) {
        setError('Dati calcio temporaneamente non disponibili. La quota API potrebbe essere esaurita.');
      } else {
        setError('Errore durante la ricerca');
      }
    } finally {
      setSearching(false);
    }
  };

  const toggleFixture = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= maxCanSelect) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const toSelect = fixtures.slice(0, maxCanSelect).map(f => f.fixture_id);
    setSelectedIds(new Set(toSelect));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const doImport = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await apiCall('/admin/real-fixtures/import', {
        method: 'POST',
        token,
        body: {
          league_id: leagueId,
          matchday_id: matchdayId,
          fixture_ids: Array.from(selectedIds),
        },
      });
      const imported = result.imported || 0;
      const skipped = result.skipped || 0;
      let msg = `${imported} partite importate con successo!`;
      if (skipped > 0) msg += ` (${skipped} già presenti, saltate)`;
      setSuccessMsg(msg);
      setFixtures([]);
      setSelectedIds(new Set());
      onImportComplete();
    } catch (e: unknown) {
      setError((e as Error).message || 'Errore durante l\'importazione');
    } finally {
      setImporting(false);
    }
  };

  const applyDatePreset = (preset: 'week' | 'next_week' | 'next_3_days') => {
    const now = new Date();
    let from: Date, to: Date;
    if (preset === 'week') {
      const range = getWeekRange();
      setDateFrom(range.from);
      setDateTo(range.to);
      return;
    } else if (preset === 'next_week') {
      const day = now.getDay();
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + (7 - (day === 0 ? 6 : day - 1)));
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6);
      from = nextMon;
      to = nextSun;
    } else {
      from = now;
      to = new Date(now);
      to.setDate(now.getDate() + 3);
    }
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
  };

  return (
    <View style={[st.container, { backgroundColor: colors.card }]} data-testid="import-fixtures-section">
      {/* Header - Collapsible */}
      <TouchableOpacity
        style={st.sectionHeader}
        onPress={() => setExpanded(!expanded)}
        data-testid="import-fixtures-toggle"
      >
        <View style={st.headerLeft}>
          <Ionicons name="cloud-download" size={16} color={colors.accent} />
          <Text style={[st.sectionTitle, { color: colors.accent }]}>IMPORTA PARTITE REALI</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.accent} />
      </TouchableOpacity>

      {expanded && (
        <View style={st.body}>
          {/* API Error Banner */}
          {error ? (
            <View style={[st.banner, { backgroundColor: 'rgba(239,68,68,0.12)' }]} data-testid="import-error-banner">
              <Ionicons name="warning" size={18} color={colors.error} />
              <Text style={[st.bannerText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Success Banner */}
          {successMsg ? (
            <View style={[st.banner, { backgroundColor: 'rgba(34,197,94,0.12)' }]} data-testid="import-success-banner">
              <Ionicons name="checkmark-circle" size={18} color="rgb(34,197,94)" />
              <Text style={[st.bannerText, { color: 'rgb(34,197,94)' }]}>{successMsg}</Text>
            </View>
          ) : null}

          {loadingLeagues ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* Destination info */}
              <View style={[st.infoRow, { backgroundColor: `${colors.accent}12` }]}>
                <Ionicons name="arrow-forward-circle" size={16} color={colors.accent} />
                <Text style={[st.infoText, { color: colors.text }]}>
                  Destinazione: <Text style={{ fontWeight: '700' }}>{matchdayLabel}</Text> ({currentMatchCount}/{MAX_IMPORT} partite)
                </Text>
              </View>

              {maxCanSelect <= 0 ? (
                <View style={[st.banner, { backgroundColor: 'rgba(245,166,35,0.12)' }]}>
                  <Ionicons name="lock-closed" size={18} color="rgb(245,166,35)" />
                  <Text style={[st.bannerText, { color: 'rgb(245,166,35)' }]}>
                    Giornata piena — massimo {MAX_IMPORT} partite raggiunto
                  </Text>
                </View>
              ) : (
                <>
                  {/* Championship picker */}
                  <Text style={[st.label, { color: colors.textSecondary }]}>Campionato</Text>
                  <TouchableOpacity
                    style={[st.picker, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => setShowLeaguePicker(true)}
                    data-testid="api-league-picker"
                  >
                    <Ionicons name="trophy" size={18} color={colors.accent} />
                    <Text style={[st.pickerText, { color: colors.text }]}>
                      {selectedApiLeague ? `${selectedApiLeague.name} (${selectedApiLeague.country})` : 'Seleziona campionato...'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {/* Date range */}
                  <Text style={[st.label, { color: colors.textSecondary }]}>Periodo</Text>
                  <View style={st.dateRow}>
                    <View style={[st.dateBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[st.dateLabel, { color: colors.textSecondary }]}>Da</Text>
                      <Text style={[st.dateValue, { color: colors.text }]}>{dateFrom}</Text>
                    </View>
                    <Text style={{ color: colors.textSecondary }}>→</Text>
                    <View style={[st.dateBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[st.dateLabel, { color: colors.textSecondary }]}>A</Text>
                      <Text style={[st.dateValue, { color: colors.text }]}>{dateTo}</Text>
                    </View>
                  </View>
                  <View style={st.presetRow}>
                    {[
                      { key: 'week' as const, label: 'Questa settimana' },
                      { key: 'next_week' as const, label: 'Prossima' },
                      { key: 'next_3_days' as const, label: 'Prossimi 3gg' },
                    ].map(p => (
                      <TouchableOpacity
                        key={p.key}
                        style={[st.presetBtn, { borderColor: colors.border }]}
                        onPress={() => applyDatePreset(p.key)}
                      >
                        <Text style={[st.presetText, { color: colors.accent }]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[st.presetBtn, { borderColor: colors.border }]}
                      onPress={() => { setTempFrom(dateFrom); setTempTo(dateTo); setShowDateModal(true); }}
                    >
                      <Ionicons name="calendar" size={14} color={colors.accent} />
                      <Text style={[st.presetText, { color: colors.accent }]}>Personalizza</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Search button */}
                  <TouchableOpacity
                    style={[st.searchBtn, { backgroundColor: colors.accent, opacity: searching || !selectedApiLeague ? 0.5 : 1 }]}
                    onPress={searchFixtures}
                    disabled={searching || !selectedApiLeague}
                    data-testid="search-fixtures-btn"
                  >
                    {searching ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Ionicons name="search" size={18} color={colors.background} />
                    )}
                    <Text style={[st.searchBtnText, { color: colors.background }]}>
                      {searching ? 'Ricerca in corso...' : 'Cerca partite'}
                    </Text>
                  </TouchableOpacity>

                  {/* Results */}
                  {fixtures.length > 0 && (
                    <View style={st.resultsSection}>
                      <View style={st.resultsHeader}>
                        <Text style={[st.resultsCount, { color: colors.text }]}>
                          {fixtures.length} partite trovate
                        </Text>
                        <View style={st.selectActions}>
                          <TouchableOpacity onPress={selectAll}>
                            <Text style={[st.selectLink, { color: colors.accent }]}>Seleziona tutte</Text>
                          </TouchableOpacity>
                          <Text style={{ color: colors.textSecondary }}>|</Text>
                          <TouchableOpacity onPress={deselectAll}>
                            <Text style={[st.selectLink, { color: colors.accent }]}>Deseleziona</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {selectedIds.size >= maxCanSelect && (
                        <View style={[st.banner, { backgroundColor: 'rgba(245,166,35,0.12)', marginBottom: 8 }]}>
                          <Ionicons name="information-circle" size={16} color="rgb(245,166,35)" />
                          <Text style={[st.bannerText, { color: 'rgb(245,166,35)', fontSize: 12 }]}>
                            Puoi importare max {maxCanSelect} partite in questa giornata
                          </Text>
                        </View>
                      )}

                      {fixtures.map(f => {
                        const selected = selectedIds.has(f.fixture_id);
                        const disabled = !selected && selectedIds.size >= maxCanSelect;
                        const stat = statusLabel(f.status_short);
                        return (
                          <TouchableOpacity
                            key={f.fixture_id}
                            style={[
                              st.fixtureCard,
                              { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.background },
                              selected && { borderWidth: 2 },
                              disabled && { opacity: 0.4 },
                            ]}
                            onPress={() => !disabled && toggleFixture(f.fixture_id)}
                            disabled={disabled && !selected}
                            data-testid={`fixture-${f.fixture_id}`}
                          >
                            <View style={st.fixtureCheck}>
                              <Ionicons
                                name={selected ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={selected ? colors.accent : colors.textSecondary}
                              />
                            </View>
                            <View style={st.fixtureInfo}>
                              <Text style={[st.fixtureTeams, { color: colors.text }]}>
                                {f.home_team} vs {f.away_team}
                              </Text>
                              <View style={st.fixtureMeta}>
                                <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                                <Text style={[st.fixtureMetaText, { color: colors.textSecondary }]}>
                                  {formatFixtureDate(f.date)}
                                </Text>
                                {f.round && (
                                  <Text style={[st.fixtureMetaText, { color: colors.textSecondary }]}>
                                    | {f.round}
                                  </Text>
                                )}
                              </View>
                              {(f.home_goals !== null && f.away_goals !== null) && (
                                <Text style={[st.fixtureScore, { color: colors.text }]}>
                                  {f.home_goals} - {f.away_goals}
                                </Text>
                              )}
                            </View>
                            <View style={[st.fixtureStatus, { backgroundColor: stat.color }]}>
                              <Text style={st.fixtureStatusText}>{stat.text}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}

                      {/* Import button */}
                      <TouchableOpacity
                        style={[st.importBtn, { backgroundColor: selectedIds.size > 0 ? colors.accent : colors.border }]}
                        onPress={doImport}
                        disabled={selectedIds.size === 0 || importing}
                        data-testid="import-fixtures-btn"
                      >
                        {importing ? (
                          <ActivityIndicator size="small" color={colors.background} />
                        ) : (
                          <Ionicons name="download" size={20} color={selectedIds.size > 0 ? colors.background : colors.textSecondary} />
                        )}
                        <Text style={[st.importBtnText, { color: selectedIds.size > 0 ? colors.background : colors.textSecondary }]}>
                          {importing ? 'Importazione...' : `IMPORTA ${selectedIds.size} PARTITE`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* Modal: League picker */}
      <Modal visible={showLeaguePicker} transparent animationType="fade">
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowLeaguePicker(false)}>
          <View style={[st.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[st.modalTitle, { color: colors.text }]}>Seleziona Campionato</Text>
            {apiLeagues.map(lg => (
              <TouchableOpacity
                key={lg.league_id}
                style={[
                  st.modalOption,
                  { borderColor: colors.border },
                  selectedApiLeague?.league_id === lg.league_id && { borderColor: colors.accent, backgroundColor: `${colors.accent}10` },
                ]}
                onPress={() => { setSelectedApiLeague(lg); setShowLeaguePicker(false); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[st.modalOptionText, { color: colors.text }]}>{lg.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {lg.country} — Stagione {lg.current_season}/{(lg.current_season || 0) + 1}
                  </Text>
                </View>
                {selectedApiLeague?.league_id === lg.league_id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Custom date range */}
      <Modal visible={showDateModal} transparent animationType="fade">
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowDateModal(false)}>
          <View style={[st.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[st.modalTitle, { color: colors.text }]}>Seleziona Periodo</Text>
            <Text style={[st.label, { color: colors.textSecondary }]}>Da (YYYY-MM-DD)</Text>
            <View style={[st.dateInput, { borderColor: colors.border }]}>
              <Text
                style={[st.dateInputText, { color: colors.text }]}
                onPress={() => {}}
              >{tempFrom}</Text>
            </View>
            <View style={st.dateAdjustRow}>
              {[-7, -1, 1, 7].map(d => (
                <TouchableOpacity
                  key={`from_${d}`}
                  style={[st.dateAdjBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    const dt = new Date(tempFrom);
                    dt.setDate(dt.getDate() + d);
                    setTempFrom(dt.toISOString().slice(0, 10));
                  }}
                >
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                    {d > 0 ? `+${d}g` : `${d}g`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[st.label, { color: colors.textSecondary, marginTop: 12 }]}>A (YYYY-MM-DD)</Text>
            <View style={[st.dateInput, { borderColor: colors.border }]}>
              <Text style={[st.dateInputText, { color: colors.text }]}>{tempTo}</Text>
            </View>
            <View style={st.dateAdjustRow}>
              {[-7, -1, 1, 7].map(d => (
                <TouchableOpacity
                  key={`to_${d}`}
                  style={[st.dateAdjBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    const dt = new Date(tempTo);
                    dt.setDate(dt.getDate() + d);
                    setTempTo(dt.toISOString().slice(0, 10));
                  }}
                >
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                    {d > 0 ? `+${d}g` : `${d}g`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={st.modalBtns}>
              <TouchableOpacity
                style={[st.modalBtn, { borderColor: colors.border }]}
                onPress={() => setShowDateModal(false)}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalBtn, { backgroundColor: colors.accent }]}
                onPress={() => { setDateFrom(tempFrom); setDateTo(tempTo); setShowDateModal(false); }}
              >
                <Text style={{ color: colors.background, fontWeight: '600' }}>Applica</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { borderRadius: 14, padding: 14, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  body: { marginTop: 14 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '500' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, marginBottom: 12 },
  infoText: { fontSize: 13 },

  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },

  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  pickerText: { flex: 1, fontSize: 14, fontWeight: '600' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dateBox: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  dateLabel: { fontSize: 10, fontWeight: '600' },
  dateValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  presetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 6 },
  presetText: { fontSize: 12, fontWeight: '600' },

  searchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, marginBottom: 12 },
  searchBtnText: { fontSize: 15, fontWeight: '700' },

  resultsSection: { marginTop: 4 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resultsCount: { fontSize: 14, fontWeight: '700' },
  selectActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectLink: { fontSize: 12, fontWeight: '600' },

  fixtureCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  fixtureCheck: { marginRight: 10 },
  fixtureInfo: { flex: 1 },
  fixtureTeams: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  fixtureMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fixtureMetaText: { fontSize: 11 },
  fixtureScore: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  fixtureStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  fixtureStatusText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  importBtnText: { fontSize: 15, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, marginBottom: 8, gap: 10 },
  modalOptionText: { fontSize: 15, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center', borderColor: 'transparent' },

  dateInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  dateInputText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  dateAdjustRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 6 },
  dateAdjBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderRadius: 6 },
});
