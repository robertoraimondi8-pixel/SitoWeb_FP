/**
 * Shared TypeScript interfaces for FantaPronostic API responses.
 * Used across all frontend components to replace `any` types.
 */

// ─── Error Handling ───────────────────────────────────────────────────────────

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return String(e ?? 'Errore sconosciuto');
}

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface League {
  id: string;
  name: string;
  league_type?: string;
  match_source_type?: string;
  owner_id?: string;
  created_by?: string;
  invite_code?: string;
  season_id?: string;
  scoring_config?: Record<string, { enabled: boolean; points: number }>;
  competition_name?: string;
  start_matchday?: number;
  end_matchday?: number;
  member_count?: number;
}

export interface Matchday {
  id: string;
  number: number;
  label: string;
  status: 'DRAFT' | 'OPEN' | 'LOCKED' | 'LIVE' | 'COMPLETED';
  league_id?: string;
  season_id?: string;
  first_kickoff?: string;
  total_matches?: number;
  my_predictions_count?: number;
  my_points?: number;
  matches?: MatchItem[];
}

export interface MatchItem {
  id: string;
  home_team: string;
  away_team: string;
  competition?: string;
  start_time?: string;
  home_score?: number | null;
  away_score?: number | null;
  status?: string;
  market_type?: string;
}

export interface Season {
  id: string;
  name: string;
  is_active?: boolean;
  current_matchday_id?: string;
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export interface UserSummary {
  rank?: number;
  position?: number;
  points?: number;
  matchdays_played?: number;
  total_points?: number;
}

export interface RankingsPreviewEntry {
  user_id: string;
  username: string;
  rank: number;
  total_points: number;
  is_current_user: boolean;
}

export interface RankingsPreview {
  league_name?: string;
  top?: RankingsPreviewEntry[];
  my_rank?: RankingsPreviewEntry;
}

export interface LivePreview {
  total_provisional: number;
  joker_active: boolean;
  matches: Array<{
    match_id: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    my_prediction: string | null;
    points: number;
  }>;
}

export interface Last5Entry {
  matchday_number: number;
  matchday_id: string;
  points: number;
}

export interface HomeData {
  league: League;
  matchday: Matchday | null;
  user_summary: UserSummary | null;
  user_leagues: League[];
  rankings_preview: RankingsPreview | null;
  live: LivePreview | null;
  last_5_performance: Last5Entry[];
  server_time?: string;
}

// ─── Live Screen ──────────────────────────────────────────────────────────────

export interface LiveScreenData {
  matchday_id: string;
  matchday_label: string;
  matchday_status: string;
  matches: LiveMatch[];
  base_points: number;
  joker_bonus: number;
  total_live_points: number;
  joker_match_id: string | null;
  valid_matches: number;
  void_matches: number;
  server_time: string;
}

export interface LiveMatch {
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  my_prediction: string | null;
  my_market: string | null;
  points: number;
  outcome: string;
}

// ─── Predictions ──────────────────────────────────────────────────────────────

export interface PredictionMatch {
  id: string;
  home_team: string;
  away_team: string;
  competition?: string;
  start_time?: string;
  home_score?: number | null;
  away_score?: number | null;
  status?: string;
  market_type?: string;
}

export interface PredictionEntry {
  match: PredictionMatch;
  match_id: string;
  prediction_value: string | null;
  market_type: string;
  points: number;
  outcome: string;
  is_locked: boolean;
  is_joker: boolean;
}

export interface PredictionsData {
  league: League;
  matchday: Matchday;
  predictions: PredictionEntry[];
  joker: {
    is_active: boolean;
    is_locked: boolean;
    used_other_matchday: boolean;
    match_id: string | null;
    half: number;
  };
  matchdays: Matchday[];
}

// ─── Rankings / Standings ─────────────────────────────────────────────────────

export interface StandingEntry {
  user_id: string;
  username: string;
  rank: number;
  total_points?: number;
  matchday_points?: number;
  current_week_points?: number;
  matchdays_played?: number;
  jolly_used?: number;
  total_correct?: number;
  '1x2_correct'?: number;
  jolly_active?: boolean;
  is_current_user: boolean;
}

export interface StandingsData {
  league_name: string;
  matchday_label?: string;
  matchday_status?: string;
  entries: StandingEntry[];
}

// ─── User Predictions / Detail ────────────────────────────────────────────────

export interface UserPrediction {
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  market_type: string | null;
  prediction_value: string | null;
  outcome: 'correct' | 'wrong' | 'pending' | 'no_prediction';
  points: number;
}

export interface UserPredictionsData {
  username: string;
  matchday_label: string;
  base_points: number;
  joker_bonus: number;
  total_points: number;
  predictions: UserPrediction[];
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminLeague {
  id: string;
  name: string;
  match_source_type?: string;
  role?: string;
}

export interface AdminMatchday {
  id: string;
  number: number;
  label: string;
  status: string;
  league_id: string;
  first_kickoff?: string;
  match_count?: number;
}

export interface AdminMatch {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  competition: string;
  market_type: string;
  start_time: string;
  status: string;
}

// ─── League Management ────────────────────────────────────────────────────────

export interface LeagueDetail extends League {
  members?: Array<{
    user_id: string;
    username: string;
    role: string;
    joined_at: string;
  }>;
}

export interface CreatedLeague {
  id: string;
  name: string;
  invite_code: string;
}

// ─── Auth / User ──────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  email: string;
  username?: string;
  profile_complete?: boolean;
  access_token?: string;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export type AppColors = typeof import('../theme/designSystem').colors;
