"""Scoring engine for FantaPronostic - idempotent calculation."""
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Points per market type
MARKET_POINTS = {
    "1X2": 1.0,
    "GOAL_NOGOL": 0.5,
    "OVER_UNDER_25": 0.5,
    "EXACT_SCORE": 4.0,
}

CHAMPION_BONUS = 5.0  # per competition
MAX_CHAMPION_BONUS = 25.0  # max 5 competitions


def determine_1x2_result(home_score: int, away_score: int) -> str:
    if home_score > away_score:
        return "1"
    elif home_score == away_score:
        return "X"
    else:
        return "2"


def determine_goal_nogol(home_score: int, away_score: int) -> str:
    if home_score > 0 and away_score > 0:
        return "GOAL"
    return "NOGOL"


def determine_over_under(home_score: int, away_score: int) -> str:
    total = home_score + away_score
    return "OVER" if total > 2.5 else "UNDER"


def determine_exact_score(home_score: int, away_score: int) -> str:
    return f"{home_score}-{away_score}"


def calculate_match_points(
    prediction_value: str,
    market_type: str,
    home_score: Optional[int],
    away_score: Optional[int],
    match_status: str,
) -> tuple:
    """
    Calculate points for a single match prediction.
    Returns (points, is_correct).
    Void/postponed/cancelled matches return (0, None).
    """
    # Void matches don't generate points
    if match_status in ("void", "postponed", "cancelled"):
        return (0.0, None)

    # Match must be finished or live to calculate points
    # "live" matches get provisional points; "finished" matches get final points
    if match_status not in ("finished", "live"):
        return (0.0, None)

    if home_score is None or away_score is None:
        return (0.0, None)

    # Determine actual result based on market type
    if market_type == "1X2":
        actual = determine_1x2_result(home_score, away_score)
    elif market_type == "GOAL_NOGOL":
        actual = determine_goal_nogol(home_score, away_score)
    elif market_type == "OVER_UNDER_25":
        actual = determine_over_under(home_score, away_score)
    elif market_type == "EXACT_SCORE":
        actual = determine_exact_score(home_score, away_score)
    else:
        return (0.0, False)

    is_correct = prediction_value.upper() == actual.upper()
    points = MARKET_POINTS.get(market_type, 0.0) if is_correct else 0.0

    return (points, is_correct)


def calculate_matchday_total(
    match_points: list,
    joker_active: bool,
    matches_dict: dict,
) -> dict:
    """
    Calculate total points for a matchday.
    match_points: list of (match_id, points, is_correct)
    joker_active: True if joker is active for this MATCHDAY (x2 total valid points)
    matches_dict: dict of match_id -> match data

    Returns dict with base_points, joker_bonus, total_points, valid_matches, void_matches.
    """
    base_points = 0.0
    valid_matches = 0
    void_matches = 0

    for match_id, points, is_correct in match_points:
        match = matches_dict.get(match_id, {})
        status = match.get("status", "scheduled")

        if status in ("void", "postponed", "cancelled"):
            void_matches += 1
            continue

        if is_correct is not None:
            valid_matches += 1
            base_points += points

    # Joker: x2 on total base_points from valid matches only
    joker_bonus = base_points if joker_active else 0.0
    total_points = base_points + joker_bonus

    return {
        "base_points": base_points,
        "joker_bonus": joker_bonus,
        "total_points": total_points,
        "valid_matches": valid_matches,
        "void_matches": void_matches,
    }
