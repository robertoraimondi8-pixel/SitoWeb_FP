import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall, isAuthError } from '../src/api/client';

const DARK = {
  navy: '#1F4C8F',
  navyDeep: '#162F5C',
  accent: '#F5A623',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  textSub: 'rgba(255,255,255,0.75)',
  border: 'rgba(255,255,255,0.08)',
};

interface Team {
  rank: number;
  team_name: string;
  team_logo: string;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  form: string;
}

interface LeaguePick {
  user_id: string;
  username: string;
  team_name: string;
  team_logo: string;
  is_current_user: boolean;
}

interface TeamSummary {
  team_name: string;
  team_logo: string;
  count: number;
}

export default function ChampionPickScreen() {
  const { t } = useTranslation();
  const { token, handleAuthError } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ league_id?: string; league_name?: string }>();
  const leagueId = params.league_id || '';
  const leagueName = params.league_name || '';

  const [tab, setTab] = useState<'pick' | 'league'>('pick');
  const [teams, setTeams] = useState<Team[]>([]);
  const [competition, setCompetition] = useState('');
  const [myPick, setMyPick] = useState<string | null>(null);
  const [myPickLogo, setMyPickLogo] = useState<string | null>(null);
  const [leaguePicks, setLeaguePicks] = useState<LeaguePick[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalPicks, setTotalPicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!leagueId || !token) return;
    try {
      const [teamsRes, myRes, leagueRes] = await Promise.all([
        apiCall(`/champion-picks/teams?league_id=${leagueId}`, { token }),
        apiCall(`/champion-picks/my?league_id=${leagueId}`, { token }),
        apiCall(`/champion-picks/league?league_id=${leagueId}`, { token }),
      ]);
      setTeams(teamsRes.teams || []);
      setCompetition(teamsRes.competition || '');

      if (myRes.pick) {
        setMyPick(myRes.pick.team_name);
        setMyPickLogo(myRes.pick.team_logo);
        setSelectedTeam(myRes.pick.team_name);
        setSelectedLogo(myRes.pick.team_logo);
      }

      setLeaguePicks(leagueRes.picks || []);
      setTeamSummary(leagueRes.team_summary || []);
      setTotalMembers(leagueRes.total_members || 0);
      setTotalPicks(leagueRes.total_picks || 0);
    } catch (err: any) {
      if (isAuthError(err)) handleAuthError();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const savePick = async () => {
    if (!selectedTeam || !leagueId) return;
    setSaving(true);
    try {
      await apiCall('/champion-picks', {
        method: 'POST',
        token,
        body: { league_id: leagueId, team_name: selectedTeam, team_logo: selectedLogo },
      });
      setMyPick(selectedTeam);
      setMyPickLogo(selectedLogo);
      // Refresh league picks
      const leagueRes = await apiCall(`/champion-picks/league?league_id=${leagueId}`, { token });
      setLeaguePicks(leagueRes.picks || []);
      setTeamSummary(leagueRes.team_summary || []);
      setTotalPicks(leagueRes.total_picks || 0);
    } catch (err: any) {
      if (isAuthError(err)) handleAuthError();
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <LinearGradient colors={['#0B1D3A', '#162F5C', '#1F4C8F']} style={s.full}>
        <SafeAreaView style={s.full}>
          <ActivityIndicator size="large" color={DARK.accent} style={{ flex: 1 }} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0B1D3A', '#162F5C', '#1F4C8F']} style={s.full}>
      <SafeAreaView style={s.full} edges={['top']}>
        {/* Header */}
        <View style={s.header} data-testid="champion-pick-header">
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="champion-pick-back-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>Vincitore {competition}</Text>
            <Text style={s.headerSub} numberOfLines={1}>{leagueName}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={s.tabRow} data-testid="champion-pick-tabs">
          <TouchableOpacity
            style={[s.tabBtn, tab === 'pick' && s.tabActive]}
            onPress={() => setTab('pick')}
            data-testid="champion-tab-pick"
          >
            <Ionicons name="football" size={16} color={tab === 'pick' ? DARK.accent : DARK.textMuted} />
            <Text style={[s.tabText, tab === 'pick' && s.tabTextActive]}>La mia scelta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'league' && s.tabActive]}
            onPress={() => setTab('league')}
            data-testid="champion-tab-league"
          >
            <Ionicons name="people" size={16} color={tab === 'league' ? DARK.accent : DARK.textMuted} />
            <Text style={[s.tabText, tab === 'league' && s.tabTextActive]}>Lega ({totalPicks}/{totalMembers})</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={s.full}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DARK.accent} />}
        >
          {tab === 'pick' ? (
            <>
              {/* Current Pick Banner */}
              {myPick && (
                <View style={s.currentPickCard} data-testid="my-current-pick">
                  <LinearGradient
                    colors={['rgba(245,166,35,0.15)', 'rgba(245,166,35,0.05)']}
                    style={s.currentPickGrad}
                  >
                    <View style={s.currentPickRow}>
                      {myPickLogo ? (
                        <Image source={{ uri: myPickLogo }} style={s.currentPickLogo} />
                      ) : (
                        <Ionicons name="shield" size={32} color={DARK.accent} />
                      )}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.currentPickLabel}>Il tuo pronostico</Text>
                        <Text style={s.currentPickTeam}>{myPick}</Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                    </View>
                  </LinearGradient>
                </View>
              )}

              {/* Info */}
              <Text style={s.sectionTitle}>
                {myPick ? t('championPick.change_choice') : t('championPick.choose_winner')}
              </Text>
              <Text style={s.sectionSub}>
                Seleziona la squadra che secondo te vincerà il campionato di {competition}
              </Text>

              {/* Team List */}
              {teams.map((team) => {
                const isSelected = selectedTeam === team.team_name;
                const isCurrent = myPick === team.team_name;
                return (
                  <TouchableOpacity
                    key={team.team_name}
                    style={[s.teamRow, isSelected && s.teamRowSelected]}
                    onPress={() => { setSelectedTeam(team.team_name); setSelectedLogo(team.team_logo); }}
                    data-testid={`team-row-${team.rank}`}
                    activeOpacity={0.7}
                  >
                    <Text style={s.teamRank}>{team.rank}</Text>
                    {team.team_logo ? (
                      <Image source={{ uri: team.team_logo }} style={s.teamLogo} />
                    ) : (
                      <View style={[s.teamLogo, { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16 }]} />
                    )}
                    <View style={s.teamInfo}>
                      <Text style={[s.teamName, isSelected && { color: DARK.accent }]} numberOfLines={1}>
                        {team.team_name}
                      </Text>
                      <Text style={s.teamStats}>
                        {team.points} pt · {team.played}G · {team.win}V {team.draw}P {team.lose}S
                      </Text>
                    </View>
                    <View style={s.teamRight}>
                      {team.form && (
                        <View style={s.formRow}>
                          {team.form.split('').slice(-5).map((ch, i) => (
                            <View
                              key={i}
                              style={[
                                s.formDot,
                                { backgroundColor: ch === 'W' ? '#16A34A' : ch === 'D' ? '#F59E0B' : '#EF4444' },
                              ]}
                            />
                          ))}
                        </View>
                      )}
                      {isSelected ? (
                        <Ionicons name="radio-button-on" size={22} color={DARK.accent} />
                      ) : (
                        <Ionicons name="radio-button-off" size={22} color="rgba(255,255,255,0.25)" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Spacer for button */}
              <View style={{ height: 80 }} />
            </>
          ) : (
            <>
              {/* Team Summary */}
              {teamSummary.length > 0 && (
                <View style={s.summarySection} data-testid="team-summary-section">
                  <Text style={s.sectionTitle}>Pronostici per squadra</Text>
                  {teamSummary.map((ts, idx) => (
                    <View key={ts.team_name} style={s.summaryRow}>
                      <Text style={s.summaryRank}>{idx + 1}</Text>
                      {ts.team_logo ? (
                        <Image source={{ uri: ts.team_logo }} style={s.summaryLogo} />
                      ) : (
                        <View style={[s.summaryLogo, { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14 }]} />
                      )}
                      <Text style={s.summaryTeamName} numberOfLines={1}>{ts.team_name}</Text>
                      <View style={s.summaryBar}>
                        <View
                          style={[s.summaryBarFill, { width: `${totalMembers > 0 ? (ts.count / totalMembers) * 100 : 0}%` }]}
                        />
                      </View>
                      <Text style={s.summaryCount}>{ts.count}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Individual Picks */}
              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Scelte dei giocatori</Text>
              {leaguePicks.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="people-outline" size={40} color={DARK.textMuted} />
                  <Text style={s.emptyText}>Nessun pronostico ancora</Text>
                </View>
              ) : (
                leaguePicks.map((pick) => (
                  <View
                    key={pick.user_id}
                    style={[s.pickRow, pick.is_current_user && s.pickRowMe]}
                    data-testid={`league-pick-${pick.username}`}
                  >
                    <Ionicons
                      name="person-circle"
                      size={36}
                      color={pick.is_current_user ? DARK.accent : 'rgba(255,255,255,0.4)'}
                    />
                    <View style={s.pickInfo}>
                      <Text style={[s.pickUsername, pick.is_current_user && { color: DARK.accent }]}>
                        {pick.username} {pick.is_current_user ? '(Tu)' : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {pick.team_logo ? (
                          <Image source={{ uri: pick.team_logo }} style={{ width: 18, height: 18 }} />
                        ) : null}
                        <Text style={s.pickTeam}>{pick.team_name}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 30 }} />
            </>
          )}
        </ScrollView>

        {/* Save Button - only on pick tab */}
        {tab === 'pick' && selectedTeam && selectedTeam !== myPick && (
          <View style={s.stickyBtnWrap}>
            <TouchableOpacity
              style={s.saveBtn}
              onPress={savePick}
              disabled={saving}
              data-testid="save-champion-pick-btn"
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#F5A623', '#F59E0B']} style={s.saveBtnGrad}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="trophy" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.saveBtnText}>
                      {myPick ? t('home.change_prediction') : t('home.confirm_prediction')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  full: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, gap: 8,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  tabTextActive: { color: '#F5A623' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 30 },
  currentPickCard: { marginBottom: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)' },
  currentPickGrad: { padding: 16 },
  currentPickRow: { flexDirection: 'row', alignItems: 'center' },
  currentPickLogo: { width: 40, height: 40 },
  currentPickLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 },
  currentPickTeam: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4, marginTop: 8 },
  sectionSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 16, lineHeight: 18 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  teamRowSelected: { borderColor: 'rgba(245,166,35,0.4)', backgroundColor: 'rgba(245,166,35,0.08)' },
  teamRank: { width: 24, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  teamLogo: { width: 32, height: 32, marginLeft: 8 },
  teamInfo: { flex: 1, marginLeft: 12 },
  teamName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  teamStats: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  teamRight: { alignItems: 'flex-end', gap: 4 },
  formRow: { flexDirection: 'row', gap: 3 },
  formDot: { width: 6, height: 6, borderRadius: 3 },
  summarySection: { marginBottom: 8 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 4, gap: 8,
  },
  summaryRank: { width: 20, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  summaryLogo: { width: 28, height: 28 },
  summaryTeamName: { fontSize: 13, fontWeight: '600', color: '#fff', width: 110, flexShrink: 0 },
  summaryBar: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  summaryBarFill: { height: '100%', backgroundColor: DARK.accent, borderRadius: 4 },
  summaryCount: { width: 24, fontSize: 13, fontWeight: '700', color: DARK.accent, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 4, gap: 10,
  },
  pickRowMe: { backgroundColor: 'rgba(245,166,35,0.08)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)' },
  pickInfo: { flex: 1 },
  pickUsername: { fontSize: 14, fontWeight: '600', color: '#fff' },
  pickTeam: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  stickyBtnWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16, paddingTop: 10,
    backgroundColor: 'rgba(11,29,58,0.95)',
  },
  saveBtn: { borderRadius: 14, overflow: 'hidden' },
  saveBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
