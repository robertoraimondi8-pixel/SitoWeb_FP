"""Trophy assignment engine - awards trophies automatically after matchday/season/tournament completion."""
import logging
from database import (
    trophies_col, score_summaries_col, matchdays_col, leagues_col,
    memberships_col, users_col, standings_cache_col,
    tournaments_col, tournament_rounds_col, tournament_matchups_col,
)
from models import new_id, now_utc

logger = logging.getLogger(__name__)

# Trophy types
WEEKLY_BEST = "weekly_best"
WEEKLY_PERFECT = "weekly_perfect"
WEEKLY_STREAK = "weekly_streak"
LEAGUE_CHAMPION = "league_champion"
LEAGUE_SECOND = "league_second"
LEAGUE_THIRD = "league_third"
TOURNAMENT_CHAMPION = "tournament_champion"
TOURNAMENT_FINALIST = "tournament_finalist"
TOURNAMENT_SEMIFINALIST = "tournament_semifinalist"


async def _safe_award(trophy_doc: dict):
    """Insert trophy, skip if duplicate."""
    try:
        await trophies_col.insert_one(trophy_doc)
        logger.info(f"[TROPHY] Awarded {trophy_doc['type']} to user {trophy_doc['user_id']}")
        return True
    except Exception as e:
        if "duplicate" in str(e).lower() or "E11000" in str(e):
            logger.info(f"[TROPHY] Already awarded {trophy_doc['type']} to user {trophy_doc['user_id']}, skipping")
            return False
        raise


async def award_weekly_trophies(matchday_id: str, league_id: str):
    """Award weekly trophies after matchday scoring is completed."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        return
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0, "id": 1, "name": 1})
    league_name = league.get("name", "") if league else ""
    md_label = matchday.get("label", f"Giornata {matchday.get('number', '?')}")

    # Get all score summaries for this matchday+league
    summaries = await score_summaries_col.find(
        {"matchday_id": matchday_id, "league_id": league_id},
        {"_id": 0}
    ).to_list(500)
    if not summaries:
        return

    # 1. WEEKLY BEST: highest total_points
    best = max(summaries, key=lambda s: s.get("total_points", 0))
    best_pts = best.get("total_points", 0)
    if best_pts > 0:
        user = await users_col.find_one({"id": best["user_id"]}, {"_id": 0, "username": 1})
        await _safe_award({
            "id": new_id(),
            "user_id": best["user_id"],
            "type": WEEKLY_BEST,
            "category": "weekly",
            "league_id": league_id,
            "matchday_id": matchday_id,
            "context": {
                "league_name": league_name,
                "matchday_label": md_label,
                "points": best_pts,
                "username": user.get("username", "") if user else "",
            },
            "awarded_at": now_utc(),
        })

    # 2. WEEKLY PERFECT: all predictions correct
    for s in summaries:
        valid = s.get("valid_matches", 0)
        correct = s.get("correct_matches", 0)
        if valid > 0 and correct == valid:
            user = await users_col.find_one({"id": s["user_id"]}, {"_id": 0, "username": 1})
            await _safe_award({
                "id": new_id(),
                "user_id": s["user_id"],
                "type": WEEKLY_PERFECT,
                "category": "weekly",
                "league_id": league_id,
                "matchday_id": matchday_id,
                "context": {
                    "league_name": league_name,
                    "matchday_label": md_label,
                    "correct": correct,
                    "username": user.get("username", "") if user else "",
                },
                "awarded_at": now_utc(),
            })

    # 3. WEEKLY STREAK: check if user has best score in 5+ consecutive matchdays
    # Get all completed matchdays for this league, sorted by number
    completed_mds = await matchdays_col.find(
        {"league_id": league_id, "status": "COMPLETED"},
        {"_id": 0, "id": 1, "number": 1}
    ).sort("number", 1).to_list(200)
    md_ids = [m["id"] for m in completed_mds]
    if len(md_ids) < 5:
        return

    # For each user, count consecutive matchdays where they were the top scorer
    member_ids = [m["user_id"] for m in await memberships_col.find(
        {"league_id": league_id, "status": "active"}, {"_id": 0, "user_id": 1}
    ).to_list(500)]

    # Get top scorer per matchday
    top_scorers = {}
    for md_id in md_ids:
        md_summaries = await score_summaries_col.find(
            {"matchday_id": md_id, "league_id": league_id},
            {"_id": 0, "user_id": 1, "total_points": 1}
        ).sort("total_points", -1).to_list(1)
        if md_summaries and md_summaries[0].get("total_points", 0) > 0:
            top_scorers[md_id] = md_summaries[0]["user_id"]

    # Check for 5+ consecutive wins
    for user_id in member_ids:
        streak = 0
        max_streak = 0
        for md_id in md_ids:
            if top_scorers.get(md_id) == user_id:
                streak += 1
                max_streak = max(max_streak, streak)
            else:
                streak = 0
        if max_streak >= 5:
            existing = await trophies_col.find_one({
                "user_id": user_id, "type": WEEKLY_STREAK, "league_id": league_id
            })
            if not existing:
                user = await users_col.find_one({"id": user_id}, {"_id": 0, "username": 1})
                await _safe_award({
                    "id": new_id(),
                    "user_id": user_id,
                    "type": WEEKLY_STREAK,
                    "category": "weekly",
                    "league_id": league_id,
                    "matchday_id": matchday_id,
                    "context": {
                        "league_name": league_name,
                        "streak": max_streak,
                        "username": user.get("username", "") if user else "",
                    },
                    "awarded_at": now_utc(),
                })

    logger.info(f"[TROPHY] Weekly trophies processed for matchday {matchday_id} league {league_id}")


async def award_league_trophies(league_id: str):
    """Award league trophies (Champion, 2nd, 3rd) based on final standings."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        return
    league_name = league.get("name", "")

    # Get standings sorted by total_points
    standings = await standings_cache_col.find(
        {"league_id": league_id, "type": "total"},
        {"_id": 0}
    ).sort("total_points", -1).to_list(500)

    if len(standings) < 1:
        return

    trophy_map = [
        (0, LEAGUE_CHAMPION, "Campione di Lega"),
        (1, LEAGUE_SECOND, "Secondo classificato"),
        (2, LEAGUE_THIRD, "Terzo classificato"),
    ]

    for idx, trophy_type, label in trophy_map:
        if idx >= len(standings):
            break
        user_id = standings[idx]["user_id"]
        user = await users_col.find_one({"id": user_id}, {"_id": 0, "username": 1})
        await _safe_award({
            "id": new_id(),
            "user_id": user_id,
            "type": trophy_type,
            "category": "league",
            "league_id": league_id,
            "matchday_id": None,
            "context": {
                "league_name": league_name,
                "position": idx + 1,
                "total_points": standings[idx].get("total_points", 0),
                "username": user.get("username", "") if user else "",
            },
            "awarded_at": now_utc(),
        })

    logger.info(f"[TROPHY] League trophies awarded for {league_name}")


async def award_tournament_trophies(tournament_id: str):
    """Award tournament trophies when a tournament is completed."""
    tournament = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        return
    t_name = tournament.get("name", "")

    # Find the final round
    final_round = await tournament_rounds_col.find_one(
        {"tournament_id": tournament_id, "round_name": {"$regex": "final", "$options": "i"}, "status": "COMPLETED"},
        {"_id": 0}
    )
    if not final_round:
        # Try finding last completed round
        final_round = await tournament_rounds_col.find_one(
            {"tournament_id": tournament_id, "status": "COMPLETED"},
            {"_id": 0},
            sort=[("round_order", -1)]
        )
    if not final_round:
        return

    # Get final matchup to find champion and finalist
    final_matchups = await tournament_matchups_col.find(
        {"round_id": final_round["id"], "status": "completed"},
        {"_id": 0}
    ).to_list(10)

    for mu in final_matchups:
        winner_id = mu.get("winner_id")
        loser_id = mu.get("user_a_id") if winner_id == mu.get("user_b_id") else mu.get("user_b_id")

        if winner_id:
            user = await users_col.find_one({"id": winner_id}, {"_id": 0, "username": 1})
            await _safe_award({
                "id": new_id(),
                "user_id": winner_id,
                "type": TOURNAMENT_CHAMPION,
                "category": "tournament",
                "league_id": tournament_id,
                "matchday_id": None,
                "context": {
                    "tournament_name": t_name,
                    "username": user.get("username", "") if user else "",
                },
                "awarded_at": now_utc(),
            })
        if loser_id:
            user = await users_col.find_one({"id": loser_id}, {"_id": 0, "username": 1})
            await _safe_award({
                "id": new_id(),
                "user_id": loser_id,
                "type": TOURNAMENT_FINALIST,
                "category": "tournament",
                "league_id": tournament_id,
                "matchday_id": None,
                "context": {
                    "tournament_name": t_name,
                    "username": user.get("username", "") if user else "",
                },
                "awarded_at": now_utc(),
            })

    # Semifinalists: find the round before the final
    semifinal_round = await tournament_rounds_col.find_one(
        {"tournament_id": tournament_id, "status": "COMPLETED",
         "round_order": {"$lt": final_round.get("round_order", 999)}},
        {"_id": 0},
        sort=[("round_order", -1)]
    )
    if semifinal_round:
        semi_matchups = await tournament_matchups_col.find(
            {"round_id": semifinal_round["id"], "status": "completed"},
            {"_id": 0}
        ).to_list(10)
        for mu in semi_matchups:
            loser_id = mu.get("user_a_id") if mu.get("winner_id") == mu.get("user_b_id") else mu.get("user_b_id")
            if loser_id:
                user = await users_col.find_one({"id": loser_id}, {"_id": 0, "username": 1})
                await _safe_award({
                    "id": new_id(),
                    "user_id": loser_id,
                    "type": TOURNAMENT_SEMIFINALIST,
                    "category": "tournament",
                    "league_id": tournament_id,
                    "matchday_id": None,
                    "context": {
                        "tournament_name": t_name,
                        "username": user.get("username", "") if user else "",
                    },
                    "awarded_at": now_utc(),
                })

    logger.info(f"[TROPHY] Tournament trophies awarded for {t_name}")


async def get_user_trophies(user_id: str) -> dict:
    """Get user's trophies grouped by category with counts."""
    trophies = await trophies_col.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("awarded_at", -1).to_list(500)

    counts = {
        "league": {"league_champion": 0, "league_second": 0, "league_third": 0},
        "tournament": {"tournament_champion": 0, "tournament_finalist": 0, "tournament_semifinalist": 0},
        "weekly": {"weekly_best": 0, "weekly_perfect": 0, "weekly_streak": 0},
    }
    for t in trophies:
        cat = t.get("category", "weekly")
        typ = t.get("type", "")
        if cat in counts and typ in counts[cat]:
            counts[cat][typ] += 1

    total = sum(c for cat in counts.values() for c in cat.values())

    return {
        "total": total,
        "counts": counts,
        "trophies": trophies,
    }
