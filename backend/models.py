"""Pydantic models for FantaPronostic."""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


# ===== AUTH MODELS =====
class RegisterRequest(BaseModel):
    email: EmailStr
    username: Optional[str] = None  # auto-generated from first_name + last_name
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    date_of_birth: str  # ISO date YYYY-MM-DD
    address: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=2, max_length=80)
    postal_code: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=8)
    language: str = Field(default="it")
    accepted_privacy: bool = False
    accepted_terms: bool = False


class CompleteProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    accepted_privacy: Optional[bool] = None
    accepted_terms: Optional[bool] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


# ===== USER =====
class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    language: str
    created_at: str


# ===== SEASON =====
class SeasonCreate(BaseModel):
    name: str
    year: str
    start_date: str
    end_date: str
    is_active: bool = True


class SeasonResponse(BaseModel):
    id: str
    name: str
    year: str
    start_date: str
    end_date: str
    is_active: bool
    created_at: str


# ===== LEAGUE =====
class ScoringMarket(BaseModel):
    enabled: bool = True
    points: float

class ScoringConfig(BaseModel):
    one_x_two: ScoringMarket = ScoringMarket(enabled=True, points=1.0)
    over_under: ScoringMarket = ScoringMarket(enabled=True, points=0.5)
    goal_no_goal: ScoringMarket = ScoringMarket(enabled=True, points=0.5)
    exact_score: ScoringMarket = ScoringMarket(enabled=True, points=4.0)

class LeagueCreate(BaseModel):
    name: str = Field(min_length=3, max_length=40)
    league_type: str = Field(default="private")
    season_id: str
    # Extended config fields
    logo_url: Optional[str] = None
    start_matchday: int = Field(default=1, ge=1, le=38)
    end_matchday: int = Field(default=38, ge=1, le=38)
    bet_deadline_minutes: int = Field(default=0, ge=0, le=60)
    match_source_type: str = Field(default="national")  # "national" | "custom"
    scoring_config: Optional[Dict[str, Any]] = None
    include_championship_predictions: bool = False


class LeagueUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=40)
    logo_url: Optional[str] = None
    start_matchday: Optional[int] = Field(default=None, ge=1, le=38)
    end_matchday: Optional[int] = Field(default=None, ge=1, le=38)
    bet_deadline_minutes: Optional[int] = Field(default=None, ge=0, le=60)
    match_source_type: Optional[str] = None
    scoring_config: Optional[Dict[str, Any]] = None
    include_championship_predictions: Optional[bool] = None


class LeagueJoinRequest(BaseModel):
    invite_code: str


class LeagueResponse(BaseModel):
    id: str
    name: str
    league_type: str
    season_id: str
    invite_code: Optional[str] = None
    owner_id: Optional[str] = None
    member_count: int = 0
    created_at: str


# ===== MATCHDAY =====
class MatchdayCreate(BaseModel):
    season_id: str
    number: int
    label: Optional[str] = None
    half: int = Field(ge=1, le=2)  # 1=andata, 2=ritorno
    first_kickoff: str  # ISO datetime
    status: str = "OPEN"  # OPEN, LOCKED, LIVE, COMPLETED


class MatchdayResponse(BaseModel):
    id: str
    season_id: str
    number: int
    label: Optional[str] = None
    half: int
    first_kickoff: str
    status: str
    created_at: str


# ===== MATCH =====
class MatchCreate(BaseModel):
    matchday_id: str
    home_team: str
    away_team: str
    competition: str  # e.g. "Serie A", "Champions League"
    start_time: str  # ISO datetime
    market_type: str  # "1X2", "GOAL_NOGOL", "OVER_UNDER_25", "EXACT_SCORE"
    status: str = "scheduled"  # scheduled, live, finished, postponed, void, cancelled


class MatchUpdate(BaseModel):
    home_team: Optional[str] = None
    away_team: Optional[str] = None
    competition: Optional[str] = None
    start_time: Optional[str] = None
    market_type: Optional[str] = None
    status: Optional[str] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None


class MatchResponse(BaseModel):
    id: str
    matchday_id: str
    home_team: str
    away_team: str
    competition: str
    start_time: str
    market_type: str
    status: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    created_at: str


# ===== PREDICTION =====
class PredictionInput(BaseModel):
    match_id: str
    market_type: str  # User chooses: "1X2", "GOAL_NOGOL", "OVER_UNDER_25", "EXACT_SCORE"
    prediction_value: str  # "1","X","2" for 1X2; "GOAL","NOGOL"; "OVER","UNDER"; "2-1" for exact


class PredictionsBatchRequest(BaseModel):
    predictions: List[PredictionInput]


class PredictionResponse(BaseModel):
    id: str
    user_id: str
    match_id: str
    matchday_id: str
    market_type: str
    prediction_value: str
    points: Optional[float] = None
    is_correct: Optional[bool] = None
    locked: bool = False
    created_at: str
    updated_at: str


# ===== JOKER =====
class JokerSetRequest(BaseModel):
    matchday_id: str


class JokerResponse(BaseModel):
    id: str
    user_id: str
    season_id: str
    matchday_id: str
    half: int
    is_active: bool
    created_at: str


# ===== SCORE SUMMARY =====
class ScoreSummaryResponse(BaseModel):
    id: str
    user_id: str
    matchday_id: str
    base_points: float
    joker_bonus: float
    total_points: float
    valid_matches: int
    void_matches: int
    created_at: str


# ===== STANDINGS =====
class StandingEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    total_points: float
    matchdays_played: int
    is_current_user: bool = False


class StandingsResponse(BaseModel):
    league_id: str
    league_name: str
    standings_type: str  # "weekly" or "total"
    entries: List[StandingEntry]
    my_position: Optional[StandingEntry] = None


# ===== LIVE =====
class LiveMatchData(BaseModel):
    match_id: str
    home_team: str
    away_team: str
    competition: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: str
    my_prediction: Optional[str] = None
    points: Optional[float] = None
    is_joker: bool = False


class LiveMatchdayResponse(BaseModel):
    matchday_id: str
    matchday_number: int
    status: str
    matches: List[LiveMatchData]
    total_provisional_points: float
    joker_applied: bool


# ===== ADMIN LIVE UPDATE =====
class LiveUpdateRequest(BaseModel):
    match_id: str
    home_score: int
    away_score: int
    status: str  # "live", "finished", "postponed", "void"


class ConfirmMatchdayRequest(BaseModel):
    matchday_id: str


# ===== HOME HUB =====
class HomeResponse(BaseModel):
    matchday: Optional[dict] = None
    live: Optional[dict] = None
    rankings_preview: Optional[dict] = None
    stats_preview: Optional[dict] = None
    user_leagues: List[dict] = []


# ===== PAYMENT =====
class CheckoutRequest(BaseModel):
    league_id: str
    origin_url: str


class CheckoutResponse(BaseModel):
    url: str
    session_id: str


# ===== CHAMPION PICK =====
class ChampionPickInput(BaseModel):
    competition: str
    team: str


class ChampionPickBatchRequest(BaseModel):
    season_id: str
    picks: List[ChampionPickInput]


# ===== AUDIT LOG =====
class AuditLogResponse(BaseModel):
    id: str
    admin_id: str
    admin_username: str
    action: str
    entity_type: str
    entity_id: str
    details: Optional[dict] = None
    created_at: str


# ===== ADMIN SEASON =====
class AdminSeasonUpdate(BaseModel):
    name: Optional[str] = None
    year: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None


class AdminMatchdayUpdate(BaseModel):
    label: Optional[str] = None
    half: Optional[int] = None
    first_kickoff: Optional[str] = None
    status: Optional[str] = None


# ===== PROFILE UPDATE =====
class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    language: Optional[str] = None
