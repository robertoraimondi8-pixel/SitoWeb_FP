"""
Migration script: Recalculate ALL scoring with new global values.
New MARKET_POINTS: 1X2=2, GOAL_NOGOL=1, OVER_UNDER_25=1, EXACT_SCORE=5
"""
import asyncio
import os
import sys

sys.path.insert(0, '/app/backend')
os.chdir('/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "fantapronostic")

NEW_MARKET_POINTS = {
    "1X2": 2.0,
    "GOAL_NOGOL": 1.0,
    "OVER_UNDER_25": 1.0,
    "EXACT_SCORE": 5.0,
}

NEW_DEFAULT_SCORING_CONFIG = {
    "1x2": {"enabled": True, "points": 2},
    "over_under": {"enabled": True, "points": 1},
    "goal_no_goal": {"enabled": True, "points": 1},
    "exact_score": {"enabled": True, "points": 5},
}


def determine_1x2_result(home_score, away_score):
    if home_score > away_score: return "1"
    elif home_score == away_score: return "X"
    return "2"

def determine_goal_nogol(home_score, away_score):
    return "GOAL" if home_score > 0 and away_score > 0 else "NOGOL"

def determine_over_under(home_score, away_score):
    return "OVER" if (home_score + away_score) > 2.5 else "UNDER"

def determine_exact_score(home_score, away_score):
    return f"{home_score}-{away_score}"


def calc_points(prediction_value, market_type, home_score, away_score, match_status, multiplier=1.0):
    if match_status in ("void", "postponed", "cancelled"):
        return 0.0, None
    if match_status not in ("finished", "live"):
        return 0.0, None
    if home_score is None or away_score is None:
        return 0.0, None
    
    if market_type == "1X2": actual = determine_1x2_result(home_score, away_score)
    elif market_type == "GOAL_NOGOL": actual = determine_goal_nogol(home_score, away_score)
    elif market_type == "OVER_UNDER_25": actual = determine_over_under(home_score, away_score)
    elif market_type == "EXACT_SCORE": actual = determine_exact_score(home_score, away_score)
    else: return 0.0, False
    
    is_correct = prediction_value.upper() == actual.upper()
    base_pts = NEW_MARKET_POINTS.get(market_type, 0.0) if is_correct else 0.0
    return base_pts * multiplier, is_correct


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    predictions_col = db["predictions"]
    matches_col = db["matches"]
    score_summaries_col = db["score_summaries"]
    standings_cache_col = db["standings_cache"]
    leagues_col = db["leagues"]
    matchdays_col = db["matchdays"]
    
    # ─── STEP 1: Update all league scoring_configs ───
    print("=== STEP 1: Updating league scoring_configs ===")
    leagues = await leagues_col.find({}, {"_id": 0, "id": 1, "name": 1, "scoring_config": 1}).to_list(None)
    for lg in leagues:
        old_sc = lg.get("scoring_config") or {}
        new_sc = {}
        for key, default in NEW_DEFAULT_SCORING_CONFIG.items():
            old_market = old_sc.get(key, {})
            new_sc[key] = {
                "enabled": old_market.get("enabled", default["enabled"]) if isinstance(old_market, dict) else default["enabled"],
                "points": default["points"],
            }
        await leagues_col.update_one({"id": lg["id"]}, {"$set": {"scoring_config": new_sc}})
    print(f"  Updated {len(leagues)} leagues")
    
    # ─── STEP 2: Recalculate all prediction points ───
    print("=== STEP 2: Recalculating prediction points ===")
    # Build match lookup
    all_matches = await matches_col.find({}, {"_id": 0}).to_list(None)
    match_map = {m["id"]: m for m in all_matches}
    print(f"  Loaded {len(all_matches)} matches")
    
    all_preds = await predictions_col.find({}, {"_id": 0}).to_list(None)
    print(f"  Found {len(all_preds)} predictions to recalculate")
    
    updated_preds = 0
    for pred in all_preds:
        match = match_map.get(pred.get("match_id"))
        if not match:
            continue
        
        market_type = pred.get("market_type", match.get("market_type", "1X2"))
        multiplier = match.get("multiplier", 1.0)
        new_pts, new_correct = calc_points(
            pred.get("prediction_value", ""),
            market_type,
            match.get("home_score"),
            match.get("away_score"),
            match.get("status", "scheduled"),
            multiplier
        )
        
        old_pts = pred.get("points", 0)
        if old_pts != new_pts:
            await predictions_col.update_one(
                {"id": pred["id"]},
                {"$set": {"points": new_pts, "is_correct": new_correct}}
            )
            updated_preds += 1
    print(f"  Updated {updated_preds} predictions")
    
    # ─── STEP 3: Recalculate score_summaries ───
    print("=== STEP 3: Recalculating score_summaries ===")
    summaries = await score_summaries_col.find({}, {"_id": 0}).to_list(None)
    print(f"  Found {len(summaries)} score summaries")
    
    updated_summaries = 0
    for summary in summaries:
        user_id = summary.get("user_id")
        matchday_id = summary.get("matchday_id")
        if not user_id or not matchday_id:
            continue
        
        # Get matchday to find its matches
        matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if not matchday:
            continue
        
        # Find all predictions for this user + matchday
        md_match_ids = matchday.get("match_ids", [])
        if not md_match_ids:
            md_matches = [m for m in all_matches if m.get("matchday_id") == matchday_id]
            md_match_ids = [m["id"] for m in md_matches]
        
        user_preds = await predictions_col.find(
            {"user_id": user_id, "match_id": {"$in": md_match_ids}},
            {"_id": 0}
        ).to_list(None)
        
        base_points = 0.0
        correct_count = 0
        special_bonus = 0.0
        
        for pred in user_preds:
            pts = pred.get("points", 0) or 0
            is_correct = pred.get("is_correct")
            match = match_map.get(pred.get("match_id"), {})
            multiplier = match.get("multiplier", 1.0)
            
            if is_correct is not None:
                base_points += pts
                if is_correct:
                    correct_count += 1
                if is_correct and multiplier > 1.0:
                    special_bonus += pts - (pts / multiplier)
        
        joker_bonus = summary.get("joker_bonus", 0)
        if joker_bonus > 0:
            joker_bonus = base_points  # x2 on base
        
        total_points = base_points + joker_bonus
        
        await score_summaries_col.update_one(
            {"user_id": user_id, "matchday_id": matchday_id},
            {"$set": {
                "base_points": base_points,
                "total_points": total_points,
                "joker_bonus": joker_bonus,
                "correct_predictions": correct_count,
                "special_bonus": special_bonus,
            }}
        )
        updated_summaries += 1
    print(f"  Updated {updated_summaries} score summaries")
    
    # ─── STEP 4: Invalidate standings cache ───
    print("=== STEP 4: Clearing standings cache ===")
    result = await standings_cache_col.delete_many({})
    print(f"  Deleted {result.deleted_count} standings cache entries (will be rebuilt on next request)")
    
    # ─── DONE ───
    print("\n=== MIGRATION COMPLETE ===")
    print(f"  Leagues updated: {len(leagues)}")
    print(f"  Predictions recalculated: {updated_preds}")
    print(f"  Score summaries recalculated: {updated_summaries}")
    print(f"  Standings cache cleared")
    print("  New scoring: 1X2=2, Goal/Over=1, Exact=5")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
