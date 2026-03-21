import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../api/client';
import { colors, typography, spacing, borderRadius } from '../theme/designSystem';

type FixtureEvent = {
  time_elapsed: number | null;
  time_extra: number | null;
  team_name: string;
  team_logo: string | null;
  player: string | null;
  assist: string | null;
  type: string;
  detail: string;
};

type TeamStat = {
  team_name: string;
  team_logo: string | null;
  stats: Record<string, any>;
};

type LineupPlayer = {
  name: string;
  number: number | null;
  pos: string | null;
};

type Lineup = {
  team_name: string;
  team_logo: string | null;
  formation: string | null;
  starters: LineupPlayer[];
  substitutes: LineupPlayer[];
  coach: string | null;
};

type FixtureInfo = {
  fixture_id: number;
  date: string;
  referee: string | null;
  venue: string | null;
  city: string | null;
  status_short: string;
  status_long: string;
  elapsed: number | null;
  home_team: string;
  home_logo: string | null;
  away_team: string;
  away_logo: string | null;
  home_goals: number | null;
  away_goals: number | null;
  halftime: { home: number | null; away: number | null } | null;
  fulltime: { home: number | null; away: number | null } | null;
};

type FixtureDetail = {
  fixture: FixtureInfo;
  events: FixtureEvent[];
  statistics: TeamStat[];
  lineups: Lineup[];
  preview?: any;
  teams?: { home?: { name?: string }; away?: { name?: string } };
};

type Tab = 'events' | 'stats' | 'lineups';

interface Props {
  fixtureId: number | null;
  token: string;
  visible: boolean;
  onClose: () => void;
}

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

export function MatchDetailSheet({ fixtureId, token, visible, onClose }: Props) {
  const [data, setData] = useState<FixtureDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('events');

  useEffect(() => {
    if (visible && fixtureId) {
      setLoading(true);
      setError(null);
      setData(null);
      setActiveTab('events');
      apiCall<FixtureDetail>(`/stats/fixture-detail/${fixtureId}`, { token })
        .then((res) => {
          // Sanitize response to prevent null access crashes
          const sanitized: FixtureDetail = {
            fixture: res?.fixture || {} as FixtureInfo,
            events: Array.isArray(res?.events) ? res.events : [],
            statistics: Array.isArray(res?.statistics) ? res.statistics : [],
            lineups: Array.isArray(res?.lineups) ? res.lineups : [],
            preview: res?.preview || null,
            teams: res?.teams || null,
          };
          setData(sanitized);
        })
        .catch(() => setError('Dati non disponibili'))
        .finally(() => setLoading(false));
    }
  }, [visible, fixtureId]);

  const fx = data?.fixture;
  const statusShort = fx?.status_short || '';
  const isLive = LIVE_STATUSES.has(statusShort);
  const isFinished = FINISHED_STATUSES.has(statusShort);

  // Safe score values
  const homeGoals = fx?.home_goals;
  const awayGoals = fx?.away_goals;
  const homeGoalsStr = homeGoals !== null && homeGoals !== undefined ? String(homeGoals) : '-';
  const awayGoalsStr = awayGoals !== null && awayGoals !== undefined ? String(awayGoals) : '-';

  // Safe halftime
  const htHome = fx?.halftime?.home;
  const htAway = fx?.halftime?.away;
  const hasHalftime = htHome !== null && htHome !== undefined;

  const TAB_LABELS: Record<Tab, string> = {
    events: 'Cronaca',
    stats: 'Statistiche',
    lineups: 'Formazioni',
  };
  const TAB_ICONS: Record<Tab, string> = {
    events: 'football-outline',
    stats: 'bar-chart-outline',
    lineups: 'people-outline',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          {/* Handle + Close */}
          <View style={s.sheetHeader}>
            <View style={s.handle} />
            <TouchableOpacity style={s.closeBtn} onPress={onClose} data-testid="match-detail-close">
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.loadingText}>Caricamento...</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.textMuted} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : data && fx ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
              {/* Score Header */}
              <View style={s.scoreHeader}>
                <View style={s.scoreTeam}>
                  {fx.home_logo ? (
                    <Image source={{ uri: fx.home_logo }} style={s.scoreLogo} />
                  ) : (
                    <View style={[s.scoreLogo, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="football-outline" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={s.scoreTeamName} numberOfLines={2}>{fx.home_team || 'Casa'}</Text>
                </View>
                <View style={s.scoreCenter}>
                  <View style={s.scoreBubble}>
                    <Text style={s.scoreText}>
                      {homeGoalsStr} - {awayGoalsStr}
                    </Text>
                  </View>
                  <View style={[s.statusPill, isLive && s.statusPillLive]}>
                    {isLive && <View style={s.liveDot} />}
                    <Text style={[s.statusPillText, isLive && s.statusPillTextLive]}>
                      {isLive ? `${fx.elapsed || 0}'` : statusShort || '-'}
                    </Text>
                  </View>
                  {hasHalftime && (
                    <Text style={s.halftimeText}>
                      HT: {htHome !== null && htHome !== undefined ? htHome : '-'} - {htAway !== null && htAway !== undefined ? htAway : '-'}
                    </Text>
                  )}
                </View>
                <View style={s.scoreTeam}>
                  {fx.away_logo ? (
                    <Image source={{ uri: fx.away_logo }} style={s.scoreLogo} />
                  ) : (
                    <View style={[s.scoreLogo, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="football-outline" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={s.scoreTeamName} numberOfLines={2}>{fx.away_team || 'Ospite'}</Text>
                </View>
              </View>

              {/* Match Info */}
              {(fx.venue || fx.referee) && (
                <View style={s.matchInfo}>
                  {fx.venue ? (
                    <View style={s.infoRow}>
                      <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                      <Text style={s.infoText}>{fx.venue}{fx.city ? `, ${fx.city}` : ''}</Text>
                    </View>
                  ) : null}
                  {fx.referee ? (
                    <View style={s.infoRow}>
                      <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                      <Text style={s.infoText}>{fx.referee}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Tab Selector */}
              <View style={s.tabBar}>
                {(['events', 'stats', 'lineups'] as Tab[]).map(tab => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[s.tabItem, isActive && s.tabItemActive]}
                      onPress={() => setActiveTab(tab)}
                      data-testid={`detail-tab-${tab}`}
                    >
                      <Ionicons name={TAB_ICONS[tab] as any} size={16} color={isActive ? colors.accent : colors.textMuted} />
                      <Text style={[s.tabText, isActive && s.tabTextActive]}>{TAB_LABELS[tab]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tab Content */}
              {activeTab === 'events' && (
                <EventsList
                  events={data.events}
                  homeTeam={fx.home_team || ''}
                  halftime={fx.halftime}
                />
              )}
              {activeTab === 'stats' && (
                <StatsComparison
                  stats={data.statistics}
                  preview={data.preview}
                  homeName={data.teams?.home?.name}
                  awayName={data.teams?.away?.name}
                />
              )}
              {activeTab === 'lineups' && (
                <LineupsView lineups={data.lineups} />
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/* ── Events List ── */
function EventsList({
  events,
  homeTeam,
  halftime,
}: {
  events: FixtureEvent[];
  homeTeam: string;
  halftime: { home: number | null; away: number | null } | null;
}) {
  if (!Array.isArray(events) || events.length === 0) {
    return <Text style={s.emptyText}>Nessun evento disponibile</Text>;
  }

  // Compute running score
  let homeScore = 0;
  let awayScore = 0;
  const enriched = events.map(ev => {
    const isHome = (ev?.team_name || '') === homeTeam;
    const evDetail = ev?.detail || '';
    const isGoal = ev?.type === 'Goal' && evDetail !== 'Missed Penalty';
    if (isGoal) {
      if (evDetail === 'Own Goal') { if (isHome) awayScore++; else homeScore++; }
      else { if (isHome) homeScore++; else awayScore++; }
    }
    return { ...ev, runningHome: homeScore, runningAway: awayScore };
  });

  const fh = enriched.filter(e => (e?.time_elapsed || 0) <= 45);
  const sh = enriched.filter(e => (e?.time_elapsed || 0) > 45);
  const htHome = halftime?.home;
  const htAway = halftime?.away;
  const htHomeStr = htHome !== null && htHome !== undefined ? String(htHome) : '-';
  const htAwayStr = htAway !== null && htAway !== undefined ? String(htAway) : '-';

  return (
    <View style={s.eventsContainer}>
      <View style={s.halfHeader}>
        <Text style={s.halfHeaderText}>1° TEMPO</Text>
        <Text style={s.halfHeaderScore}>{htHomeStr} - {htAwayStr}</Text>
      </View>
      {fh.length === 0 ? (
        <Text style={s.noEventsHalf}>Nessun evento</Text>
      ) : fh.map((ev, i) => <EventRow key={`fh-${i}`} ev={ev} homeTeam={homeTeam} />)}

      {sh.length > 0 && (
        <>
          <View style={s.halfHeader}>
            <Text style={s.halfHeaderText}>2° TEMPO</Text>
            <Text style={s.halfHeaderScore}>
              {fh.length > 0 ? `${fh[fh.length - 1].runningHome} - ${fh[fh.length - 1].runningAway}` : '0 - 0'}
            </Text>
          </View>
          {sh.map((ev, i) => <EventRow key={`sh-${i}`} ev={ev} homeTeam={homeTeam} />)}
        </>
      )}
    </View>
  );
}

/* ── Event Row ── */
function EventRow({
  ev,
  homeTeam,
}: {
  ev: FixtureEvent & { runningHome: number; runningAway: number };
  homeTeam: string;
}) {
  const isHome = (ev?.team_name || '') === homeTeam;
  const evType = ev?.type || '';
  const evDetail = ev?.detail || '';
  const isGoal = evType === 'Goal';
  const isSub = evType === 'subst';
  const isCard = evType === 'Card';
  const isVar = evType === 'Var';
  const timeStr = ev?.time_elapsed ? `${ev.time_elapsed}'${ev.time_extra ? `+${ev.time_extra}` : ''}` : '';

  const getDetailText = (detail: string): string => {
    if (!detail || detail === 'Normal Goal' || detail === 'Yellow Card') return '';
    if (detail === 'Own Goal') return 'Autogol';
    if (detail === 'Penalty') return 'Rigore';
    if (detail === 'Missed Penalty') return 'Rigore sbagliato';
    if (detail === 'Red Card') return 'Cartellino rosso';
    if (detail === 'Second Yellow card') return 'Secondo giallo';
    if (detail.includes('cancelled')) return 'Gol annullato';
    if (detail.startsWith('Substitution')) return '';
    return detail;
  };

  const renderIcon = () => {
    if (isGoal) {
      const bg = (evDetail === 'Own Goal' || evDetail === 'Missed Penalty') ? '#ef4444' : '#22c55e';
      return <View style={[s.evIcon, { backgroundColor: bg }]}><Ionicons name="football" size={11} color="#fff" /></View>;
    }
    if (isCard) {
      const bg = (evDetail === 'Red Card' || evDetail === 'Second Yellow card') ? '#ef4444' : '#f59e0b';
      return <View style={[s.evCardIcon, { backgroundColor: bg }]} />;
    }
    if (isSub) return <View style={[s.evIcon, { backgroundColor: '#60a5fa' }]}><Ionicons name="swap-horizontal" size={11} color="#fff" /></View>;
    if (isVar) return <View style={s.evVarBadge}><Text style={s.evVarText}>VAR</Text></View>;
    return <View style={[s.evIcon, { backgroundColor: colors.textMuted }]}><Ionicons name="ellipse" size={6} color="#fff" /></View>;
  };

  const detailText = getDetailText(evDetail);
  const showScore = isGoal && evDetail !== 'Missed Penalty';
  const playerName = ev?.player || '?';
  const assistName = ev?.assist || '';
  const isRedDetail = evDetail.includes('Red') || evDetail === 'Own Goal';

  if (isHome) {
    return (
      <View style={s.evRow}>
        <Text style={s.evTime}>{timeStr}</Text>
        {renderIcon()}
        {showScore && <Text style={s.evScore}>{ev.runningHome} - {ev.runningAway}</Text>}
        <View style={s.evPlayerArea}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Text style={[s.evPlayerName, isGoal && s.evPlayerGoal]}>{playerName}</Text>
            {assistName ? <Text style={s.evAssist}>({assistName})</Text> : null}
          </View>
          {detailText ? <Text style={[s.evDetailTag, isRedDetail && { color: '#ef4444' }]}>{detailText}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.evRow, s.evRowAway]}>
      <View style={[s.evPlayerArea, { alignItems: 'flex-end' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {assistName ? <Text style={s.evAssist}>({assistName})</Text> : null}
          <Text style={[s.evPlayerName, isGoal && s.evPlayerGoal]}>{playerName}</Text>
        </View>
        {detailText ? <Text style={[s.evDetailTag, isRedDetail && { color: '#ef4444' }]}>{detailText}</Text> : null}
      </View>
      {showScore && <Text style={s.evScore}>{ev.runningHome} - {ev.runningAway}</Text>}
      {renderIcon()}
      <Text style={s.evTime}>{timeStr}</Text>
    </View>
  );
}

/* ── Stats Comparison ── */
function StatsComparison({
  stats,
  preview,
  homeName,
  awayName,
}: {
  stats: TeamStat[];
  preview?: any;
  homeName?: string;
  awayName?: string;
}) {
  if (!Array.isArray(stats) || stats.length < 2) {
    // Show pre-match preview if available
    if (preview) {
      const homeForm = Array.isArray(preview?.home_form) ? preview.home_form : [];
      const awayForm = Array.isArray(preview?.away_form) ? preview.away_form : [];
      const h2h = Array.isArray(preview?.h2h) ? preview.h2h : [];

      return (
        <View>
          {(homeForm.length > 0 || awayForm.length > 0) && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[s.emptyText, { color: colors.accent, fontWeight: '700', marginBottom: 8 }]}>Forma Recente</Text>
              {homeForm.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 4 }}>{homeName || 'Casa'}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {homeForm.map((m: any, i: number) => {
                      const result = m?.result || '?';
                      const isWin = result === 'W';
                      const isDraw = result === 'D';
                      const bg = isWin ? '#10B981' : isDraw ? '#F59E0B' : '#EF4444';
                      return <View key={i} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{result}</Text></View>;
                    })}
                  </View>
                </View>
              )}
              {awayForm.length > 0 && (
                <View>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginBottom: 4 }}>{awayName || 'Ospite'}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {awayForm.map((m: any, i: number) => {
                      const result = m?.result || '?';
                      const isWin = result === 'W';
                      const isDraw = result === 'D';
                      const bg = isWin ? '#10B981' : isDraw ? '#F59E0B' : '#EF4444';
                      return <View key={i} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{result}</Text></View>;
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
          {h2h.length > 0 && (
            <View>
              <Text style={[s.emptyText, { color: colors.accent, fontWeight: '700', marginBottom: 8 }]}>Testa a Testa</Text>
              {h2h.map((m: any, i: number) => {
                const dateStr = m?.date ? (() => { try { return new Date(m.date).toLocaleDateString('it'); } catch { return ''; } })() : '';
                const hGoals = m?.home_goals !== null && m?.home_goals !== undefined ? m.home_goals : '-';
                const aGoals = m?.away_goals !== null && m?.away_goals !== undefined ? m.away_goals : '-';
                return (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{dateStr}</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{m?.home || '?'} {hGoals}-{aGoals} {m?.away || '?'}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {homeForm.length === 0 && h2h.length === 0 && (
            <Text style={s.emptyText}>Statistiche pre-partita non disponibili</Text>
          )}
        </View>
      );
    }
    return <Text style={s.emptyText}>Statistiche non disponibili</Text>;
  }

  const home = stats[0];
  const away = stats[1];
  const homeStats = home?.stats || {};
  const awayStats = away?.stats || {};

  const STAT_KEYS = [
    { key: 'Ball Possession', label: 'Possesso palla' },
    { key: 'Total Shots', label: 'Tiri totali' },
    { key: 'Shots on Goal', label: 'Tiri in porta' },
    { key: 'Corner Kicks', label: 'Calci d\'angolo' },
    { key: 'Fouls', label: 'Falli' },
    { key: 'Offsides', label: 'Fuorigioco' },
    { key: 'Yellow Cards', label: 'Cartellini gialli' },
    { key: 'Red Cards', label: 'Cartellini rossi' },
    { key: 'Goalkeeper Saves', label: 'Parate' },
    { key: 'Passes accurate', label: 'Passaggi riusciti' },
  ];

  return (
    <View style={s.statsContainer}>
      {/* Team headers */}
      <View style={s.statsHeader}>
        <View style={s.statsTeamHeader}>
          {home?.team_logo ? <Image source={{ uri: home.team_logo }} style={s.statsTeamLogo} /> : null}
          <Text style={s.statsTeamName} numberOfLines={1}>{home?.team_name || 'Casa'}</Text>
        </View>
        <View style={[s.statsTeamHeader, { justifyContent: 'flex-end' }]}>
          <Text style={s.statsTeamName} numberOfLines={1}>{away?.team_name || 'Ospite'}</Text>
          {away?.team_logo ? <Image source={{ uri: away.team_logo }} style={s.statsTeamLogo} /> : null}
        </View>
      </View>

      {STAT_KEYS.map(({ key, label }) => {
        const homeVal = homeStats[key];
        const awayVal = awayStats[key];
        if (homeVal === null && homeVal === undefined && awayVal === null && awayVal === undefined) return null;

        const hStr = String(homeVal || 0);
        const aStr = String(awayVal || 0);
        const hNum = parseFloat(hStr.replace('%', '')) || 0;
        const aNum = parseFloat(aStr.replace('%', '')) || 0;
        const total = hNum + aNum || 1;
        const hPct = (hNum / total) * 100;

        return (
          <View key={key} style={s.statRow}>
            <Text style={s.statValue}>{homeVal !== null && homeVal !== undefined ? homeVal : 0}</Text>
            <View style={s.statBarContainer}>
              <Text style={s.statLabel}>{label}</Text>
              <View style={s.statBarTrack}>
                <View style={[s.statBarHome, { width: `${hPct}%` }]} />
                <View style={[s.statBarAway, { width: `${100 - hPct}%` }]} />
              </View>
            </View>
            <Text style={s.statValue}>{awayVal !== null && awayVal !== undefined ? awayVal : 0}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ── Lineups View ── */
function LineupsView({ lineups }: { lineups: Lineup[] }) {
  if (!Array.isArray(lineups) || lineups.length === 0) {
    return <Text style={s.emptyText}>Formazioni non disponibili</Text>;
  }

  return (
    <View style={s.lineupsContainer}>
      {lineups.map((lineup, i) => {
        if (!lineup) return null;
        const starters = Array.isArray(lineup.starters) ? lineup.starters : [];
        const substitutes = Array.isArray(lineup.substitutes) ? lineup.substitutes : [];

        return (
          <View key={i} style={s.lineupTeam}>
            {/* Team Header */}
            <View style={s.lineupHeader}>
              {lineup.team_logo ? <Image source={{ uri: lineup.team_logo }} style={s.lineupLogo} /> : null}
              <View>
                <Text style={s.lineupTeamName}>{lineup.team_name || 'Squadra'}</Text>
                {lineup.formation ? <Text style={s.lineupFormation}>{lineup.formation}</Text> : null}
              </View>
            </View>

            {/* Coach */}
            {lineup.coach ? (
              <View style={s.coachRow}>
                <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
                <Text style={s.coachText}>{lineup.coach}</Text>
              </View>
            ) : null}

            {/* Starters */}
            <Text style={s.lineupSectionTitle}>Titolari</Text>
            {starters.map((p, j) => (
              <View key={j} style={s.playerRow}>
                <Text style={s.playerNumber}>{p?.number || '-'}</Text>
                <Text style={s.playerName}>{p?.name || '?'}</Text>
                {p?.pos ? <Text style={s.playerPos}>{p.pos}</Text> : null}
              </View>
            ))}

            {/* Substitutes */}
            {substitutes.length > 0 && (
              <>
                <Text style={s.lineupSectionTitle}>Panchina</Text>
                {substitutes.map((p, j) => (
                  <View key={j} style={s.playerRow}>
                    <Text style={[s.playerNumber, { color: colors.textMuted }]}>{p?.number || '-'}</Text>
                    <Text style={[s.playerName, { color: colors.textSecondary }]}>{p?.name || '?'}</Text>
                    {p?.pos ? <Text style={s.playerPos}>{p.pos}</Text> : null}
                  </View>
                ))}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  overlayBg: { flex: 1 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 30 },
  sheetHeader: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  closeBtn: { position: 'absolute', right: 16, top: 10, padding: 4 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  errorText: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  emptyText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

  // Score Header
  scoreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 },
  scoreTeam: { flex: 1, alignItems: 'center', gap: 6 },
  scoreLogo: { width: 40, height: 40, borderRadius: 8 },
  scoreTeamName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  scoreCenter: { alignItems: 'center', paddingHorizontal: 12 },
  scoreBubble: { backgroundColor: '#162F5C', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 6 },
  scoreText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  statusPill: { backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusPillLive: { backgroundColor: '#22c55e' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  statusPillText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  statusPillTextLive: { color: '#fff' },
  halftimeText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },

  // Match Info
  matchInfo: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 10, marginBottom: 14, gap: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 12, color: colors.textSecondary },

  // Tab Bar
  tabBar: { flexDirection: 'row', marginBottom: 14, backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 3 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: borderRadius.sm },
  tabItemActive: { backgroundColor: colors.card },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.accent, fontWeight: '700' },

  // Events
  eventsContainer: { gap: 0 },
  halfHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: borderRadius.sm, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 4, marginTop: 8 },
  halfHeaderText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 },
  halfHeaderScore: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  noEventsHalf: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  evRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)' },
  evRowAway: { justifyContent: 'flex-end' },
  evTime: { fontSize: 12, fontWeight: '800', color: colors.textMuted, width: 36, textAlign: 'center' },
  evIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  evCardIcon: { width: 14, height: 18, borderRadius: 2, marginHorizontal: 4 },
  evVarBadge: { backgroundColor: '#a78bfa', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  evVarText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  evScore: { fontSize: 14, fontWeight: '900', color: colors.textPrimary, marginHorizontal: 4 },
  evPlayerArea: { flex: 1 },
  evPlayerName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  evPlayerGoal: { fontWeight: '800' },
  evAssist: { fontSize: 11, color: colors.textMuted },
  evDetailTag: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 1 },

  // Stats
  statsContainer: { gap: 10 },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statsTeamHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  statsTeamLogo: { width: 20, height: 20, borderRadius: 4 },
  statsTeamName: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, width: 40, textAlign: 'center' },
  statBarContainer: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginBottom: 3 },
  statBarTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  statBarHome: { backgroundColor: '#1F4C8F', height: '100%' },
  statBarAway: { backgroundColor: '#E5E7EB', height: '100%' },

  // Lineups
  lineupsContainer: { gap: 20 },
  lineupTeam: {},
  lineupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  lineupLogo: { width: 24, height: 24, borderRadius: 4 },
  lineupTeamName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  lineupFormation: { fontSize: 12, fontWeight: '600', color: colors.accent },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  coachText: { fontSize: 12, color: colors.textSecondary },
  lineupSectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  playerNumber: { width: 28, fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  playerName: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  playerPos: { fontSize: 11, fontWeight: '600', color: colors.textMuted, backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
