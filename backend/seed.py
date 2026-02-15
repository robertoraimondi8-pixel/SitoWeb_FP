"""Seed data for FantaPronostic development."""
from datetime import datetime, timezone, timedelta
from database import (
    users_col, seasons_col, leagues_col, memberships_col,
    matchdays_col, matches_col, predictions_col, joker_usages_col,
    score_summaries_col, standings_cache_col, audit_logs_col
)
from auth import hash_password
from models import new_id, now_utc
import logging

logger = logging.getLogger(__name__)


async def run_seed():
    """Seed demo data. Idempotent - clears existing data first."""
    # Check if already seeded
    existing = await seasons_col.find_one({"name": "Serie A 2024-2025"})
    if existing:
        return {"message": "Data already seeded", "seeded": False}

    ts = now_utc()
    now = datetime.now(timezone.utc)

    # ===== USERS =====
    admin_id = new_id()
    user1_id = new_id()
    user2_id = new_id()

    users = [
        {
            "id": admin_id,
            "email": "admin@fantapronostic.com",
            "username": "admin",
            "password": hash_password("admin123"),
            "role": "admin",
            "language": "it",
            "created_at": ts,
        },
        {
            "id": user1_id,
            "email": "marco@test.com",
            "username": "Marco_FP",
            "password": hash_password("password123"),
            "role": "user",
            "language": "it",
            "created_at": ts,
        },
        {
            "id": user2_id,
            "email": "giulia@test.com",
            "username": "Giulia_Pro",
            "password": hash_password("password123"),
            "role": "user",
            "language": "it",
            "created_at": ts,
        },
    ]
    await users_col.insert_many(users)

    # ===== SEASON =====
    season_id = new_id()
    await seasons_col.insert_one({
        "id": season_id,
        "name": "Serie A 2024-2025",
        "year": "2024-2025",
        "start_date": "2024-08-17",
        "end_date": "2025-05-25",
        "is_active": True,
        "created_at": ts,
    })

    # ===== LEAGUES =====
    national_id = new_id()
    private_id = new_id()

    await leagues_col.insert_many([
        {
            "id": national_id,
            "name": "Lega Nazionale FantaPronostic",
            "league_type": "national",
            "season_id": season_id,
            "invite_code": None,
            "owner_id": None,
            "created_at": ts,
        },
        {
            "id": private_id,
            "name": "Lega Amici",
            "league_type": "private",
            "season_id": season_id,
            "invite_code": "AMICI2024",
            "owner_id": user1_id,
            "created_at": ts,
        },
    ])

    # ===== MEMBERSHIPS =====
    memberships = [
        {"id": new_id(), "user_id": user1_id, "league_id": private_id, "status": "active", "joined_at": ts},
        {"id": new_id(), "user_id": user2_id, "league_id": private_id, "status": "active", "joined_at": ts},
        {"id": new_id(), "user_id": admin_id, "league_id": private_id, "status": "active", "joined_at": ts},
    ]
    await memberships_col.insert_many(memberships)

    # ===== MATCHDAY =====
    # First kickoff in the future (2 hours from now) so users can still enter predictions
    first_kickoff = now + timedelta(hours=2)
    matchday_id = new_id()

    await matchdays_col.insert_one({
        "id": matchday_id,
        "season_id": season_id,
        "number": 1,
        "label": "Giornata 1",
        "half": 1,
        "first_kickoff": first_kickoff.isoformat(),
        "status": "OPEN",
        "created_at": ts,
    })

    # ===== 11 MATCHES =====
    match_data = [
        ("Juventus", "Roma", "Serie A", "1X2", 0),
        ("Inter", "Milan", "Serie A", "1X2", 0),
        ("Napoli", "Lazio", "Serie A", "GOAL_NOGOL", 15),
        ("Atalanta", "Fiorentina", "Serie A", "OVER_UNDER_25", 30),
        ("Bologna", "Torino", "Serie A", "1X2", 45),
        ("Udinese", "Genoa", "Serie A", "GOAL_NOGOL", 60),
        ("Cagliari", "Lecce", "Serie A", "OVER_UNDER_25", 75),
        ("Real Madrid", "Barcelona", "La Liga", "EXACT_SCORE", 90),
        ("Man City", "Liverpool", "Premier League", "1X2", 105),
        ("PSG", "Marseille", "Ligue 1", "GOAL_NOGOL", 120),
        ("Bayern", "Dortmund", "Bundesliga", "OVER_UNDER_25", 135),
    ]

    match_ids = []
    for home, away, comp, market, offset_min in match_data:
        mid = new_id()
        match_ids.append(mid)
        start = first_kickoff + timedelta(minutes=offset_min)
        await matches_col.insert_one({
            "id": mid,
            "matchday_id": matchday_id,
            "home_team": home,
            "away_team": away,
            "competition": comp,
            "start_time": start.isoformat(),
            "market_type": market,
            "status": "scheduled",
            "home_score": None,
            "away_score": None,
            "created_at": ts,
        })

    logger.info(f"Seed completed: season={season_id}, matchday={matchday_id}, {len(match_ids)} matches")

    return {
        "message": "Seed completed successfully",
        "seeded": True,
        "data": {
            "admin": {"email": "admin@fantapronostic.com", "password": "admin123"},
            "user1": {"email": "marco@test.com", "password": "password123"},
            "user2": {"email": "giulia@test.com", "password": "password123"},
            "season_id": season_id,
            "matchday_id": matchday_id,
            "national_league_id": national_id,
            "private_league_id": private_id,
            "private_league_code": "AMICI2024",
            "match_count": len(match_ids),
        },
    }
