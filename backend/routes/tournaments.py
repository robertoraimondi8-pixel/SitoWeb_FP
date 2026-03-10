"""Tournaments module - separate from leagues. 1v1 competitions with groups + knockout."""
import random
import logging
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from database import (
    db, tournaments_col, tournament_registrations_col,
    tournament_groups_col, tournament_rounds_col, tournament_matchups_col,
    matches_col, predictions_col, score_summaries_col, users_col,
)
from models import new_id, now_utc
from auth import get_current_user

logger = logging.getLogger(__name__)
tournament_router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])


# ── Pydantic models ──

class CreateTournamentReq(BaseModel):
    name: str
    max_participants: int  # 8, 16, 32
    duration_rounds: int
    groups_count: int
    players_per_group: int
    advance_count: int  # how many advance from each group
    entry_fee: float = 0.0

class UpdateTournamentReq(BaseModel):
    name: Optional[str] = None
    advance_count: Optional[int] = None
    entry_fee: Optional[float] = None

class CreateRoundReq(BaseModel):
    round_type: str = "group"  # group | quarterfinal | semifinal | final
    label: Optional[str] = None

class ImportTournamentMatchesReq(BaseModel):
    fixture_ids: List[int]

class AdvanceKnockoutReq(BaseModel):
    matchup_rules: str = "1v2"  # "1v2" = 1st of group A vs 2nd of group B


# ── ADMIN: Create tournament ──

@tournament_router.post("")
async def create_tournament(req: CreateTournamentReq, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin puo creare tornei")
    if req.max_participants != req.groups_count * req.players_per_group:
        raise HTTPException(400, f"partecipanti ({req.max_participants}) != gironi ({req.groups_count}) x giocatori ({req.players_per_group})")
    if req.advance_count >= req.players_per_group:
        raise HTTPException(400, "advance_count deve essere minore di players_per_group")

    doc = {
        "id": new_id(),
        "name": req.name,
        "status": "draft",
        "max_participants": req.max_participants,
        "duration_rounds": req.duration_rounds,
        "groups_count": req.groups_count,
        "players_per_group": req.players_per_group,
        "advance_count": req.advance_count,
        "entry_fee": req.entry_fee,
        "current_round": 0,
        "created_by": user["id"],
        "created_at": now_utc(),
        "started_at": None,
        "completed_at": None,
    }
    await tournaments_col.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ── ADMIN: Update tournament ──

@tournament_router.put("/{tournament_id}")
async def update_tournament(tournament_id: str, req: UpdateTournamentReq, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] not in ("draft", "registration"):
        raise HTTPException(400, "Non modificabile dopo l'inizio")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if updates:
        await tournaments_col.update_one({"id": tournament_id}, {"$set": updates})
    return {"ok": True}


# ── ADMIN: Open registration ──

@tournament_router.post("/{tournament_id}/open")
async def open_registration(tournament_id: str, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] != "draft":
        raise HTTPException(400, f"Stato attuale: {t['status']}. Deve essere draft.")
    await tournaments_col.update_one({"id": tournament_id}, {"$set": {"status": "registration"}})
    return {"ok": True, "status": "registration"}


# ── ADMIN: Start tournament (generate groups) ──

@tournament_router.post("/{tournament_id}/start")
async def start_tournament(tournament_id: str, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] != "registration":
        raise HTTPException(400, f"Stato attuale: {t['status']}. Deve essere registration.")

    regs = await tournament_registrations_col.find(
        {"tournament_id": tournament_id, "status": "active"}, {"_id": 0}
    ).to_list(200)

    if len(regs) < t["max_participants"]:
        raise HTTPException(400, f"Servono {t['max_participants']} iscritti, ce ne sono {len(regs)}")

    # Shuffle and assign to groups
    random.shuffle(regs)
    group_names = [chr(65 + i) for i in range(t["groups_count"])]  # A, B, C, D...
    groups = []
    for i, gn in enumerate(group_names):
        start = i * t["players_per_group"]
        end = start + t["players_per_group"]
        members = [{"user_id": r["user_id"], "username": r["username"]} for r in regs[start:end]]
        group_doc = {
            "id": new_id(),
            "tournament_id": tournament_id,
            "group_name": gn,
            "members": members,
        }
        groups.append(group_doc)

    await tournament_groups_col.insert_many(groups)

    # Generate group matchups (round-robin within each group)
    # Each matchday = one set of group matchups
    # For 4 players per group, there are 6 matchups (3 matchdays of 2 games each)
    # We distribute them across the duration_rounds
    all_matchups = []
    for g in groups:
        members = g["members"]
        # Generate round-robin pairs
        pairs = []
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                pairs.append((members[i], members[j]))
        # Distribute pairs across rounds (we'll assign round later when rounds are created)
        for pair_idx, (a, b) in enumerate(pairs):
            all_matchups.append({
                "id": new_id(),
                "tournament_id": tournament_id,
                "group_id": g["id"],
                "round_number": (pair_idx % t["duration_rounds"]) + 1,
                "round_type": "group",
                "user_a_id": a["user_id"],
                "user_b_id": b["user_id"],
                "user_a_username": a["username"],
                "user_b_username": b["username"],
                "user_a_points": 0.0,
                "user_b_points": 0.0,
                "result": "pending",
                "winner_id": None,
                "status": "pending",
            })

    if all_matchups:
        await tournament_matchups_col.insert_many(all_matchups)

    await tournaments_col.update_one({"id": tournament_id}, {
        "$set": {"status": "groups", "started_at": now_utc(), "current_round": 0}
    })

    return {
        "ok": True,
        "status": "groups",
        "groups": [{"group_name": g["group_name"], "members": g["members"]} for g in groups],
        "matchups_created": len(all_matchups),
    }


# ── ADMIN: Create a round with matches ──

@tournament_router.post("/{tournament_id}/rounds")
async def create_round(tournament_id: str, req: CreateRoundReq, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] not in ("groups", "knockout"):
        raise HTTPException(400, f"Torneo in stato {t['status']}, non si possono creare round")

    # Determine round number
    existing = await tournament_rounds_col.count_documents({"tournament_id": tournament_id})
    round_number = existing + 1

    label = req.label or f"Giornata {round_number}" if req.round_type == "group" else req.label or req.round_type.replace("_", " ").title()

    round_doc = {
        "id": new_id(),
        "tournament_id": tournament_id,
        "round_number": round_number,
        "round_type": req.round_type,
        "status": "PENDING",
        "label": label,
        "created_at": now_utc(),
    }
    await tournament_rounds_col.insert_one(round_doc)
    await tournaments_col.update_one({"id": tournament_id}, {"$set": {"current_round": round_number}})
    round_doc.pop("_id", None)
    return round_doc


# ── ADMIN: Import matches for a round ──

@tournament_router.post("/{tournament_id}/rounds/{round_id}/import-matches")
async def import_round_matches(tournament_id: str, round_id: str, req: ImportTournamentMatchesReq, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    rnd = await tournament_rounds_col.find_one({"id": round_id, "tournament_id": tournament_id}, {"_id": 0})
    if not rnd:
        raise HTTPException(404, "Round non trovato")

    from apifootball import get_apifootball
    client = get_apifootball()
    imported = []
    for fid in req.fixture_ids:
        # Fetch fixture from API-Football
        data = await client._get("/fixtures", {"id": fid})
        resp = data.get("response", [])
        if not resp:
            continue
        f = resp[0]
        fix = f.get("fixture", {})
        teams = f.get("teams", {})
        goals = f.get("goals", {})
        match_doc = {
            "id": new_id(),
            "matchday_id": round_id,
            "league_id": tournament_id,  # KEY: reuse league_id for tournament isolation
            "tournament_id": tournament_id,
            "home_team": teams.get("home", {}).get("name", "?"),
            "away_team": teams.get("away", {}).get("name", "?"),
            "home_logo": teams.get("home", {}).get("logo"),
            "away_logo": teams.get("away", {}).get("logo"),
            "competition": f.get("league", {}).get("name", ""),
            "competition_name": f.get("league", {}).get("name", ""),
            "start_time": fix.get("date"),
            "home_score": goals.get("home"),
            "away_score": goals.get("away"),
            "status": "scheduled",
            "elapsed": None,
            "external_fixture_id": fix.get("id"),
            "created_at": now_utc(),
        }
        # Map API status
        short = fix.get("status", {}).get("short", "NS")
        if short in ("FT", "AET", "PEN"):
            match_doc["status"] = "finished"
        elif short in ("1H", "2H", "HT", "ET", "P", "BT", "LIVE"):
            match_doc["status"] = "live"
            match_doc["elapsed"] = fix.get("status", {}).get("elapsed")
        imported.append(match_doc)

    if imported:
        await matches_col.insert_many(imported)

    return {"ok": True, "imported": len(imported), "round_id": round_id}


# ── ADMIN: Open round (allow predictions) ──

@tournament_router.post("/{tournament_id}/rounds/{round_id}/open")
async def open_round(tournament_id: str, round_id: str, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    rnd = await tournament_rounds_col.find_one({"id": round_id, "tournament_id": tournament_id}, {"_id": 0})
    if not rnd:
        raise HTTPException(404, "Round non trovato")
    await tournament_rounds_col.update_one({"id": round_id}, {"$set": {"status": "OPEN"}})
    return {"ok": True, "status": "OPEN"}


# ── ADMIN: Complete round and calculate matchup results ──

@tournament_router.post("/{tournament_id}/rounds/{round_id}/complete")
async def complete_round(tournament_id: str, round_id: str, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    rnd = await tournament_rounds_col.find_one({"id": round_id, "tournament_id": tournament_id}, {"_id": 0})
    if not rnd:
        raise HTTPException(404, "Round non trovato")

    # Get all matches for this round
    round_matches = await matches_col.find(
        {"matchday_id": round_id, "league_id": tournament_id}, {"_id": 0}
    ).to_list(50)
    matches_dict = {m["id"]: m for m in round_matches}

    # Get all registered users
    regs = await tournament_registrations_col.find(
        {"tournament_id": tournament_id, "status": "active"}, {"_id": 0}
    ).to_list(200)
    user_ids = [r["user_id"] for r in regs]

    # Calculate score for each user
    from scoring import calculate_match_points
    user_scores = {}
    for uid in user_ids:
        preds = await predictions_col.find(
            {"user_id": uid, "matchday_id": round_id, "league_id": tournament_id}, {"_id": 0}
        ).to_list(50)
        total = 0.0
        for p in preds:
            m = matches_dict.get(p.get("match_id"))
            if not m:
                continue
            pts, _ = calculate_match_points(
                p["prediction_value"], p["market_type"],
                m.get("home_score"), m.get("away_score"),
                m.get("status", "scheduled"), p.get("multiplier", 1.0)
            )
            total += pts
        user_scores[uid] = total

        # Upsert score_summary (reuse existing system)
        await score_summaries_col.update_one(
            {"user_id": uid, "matchday_id": round_id, "league_id": tournament_id},
            {"$set": {
                "id": new_id(),
                "user_id": uid,
                "matchday_id": round_id,
                "league_id": tournament_id,
                "base_points": total,
                "special_bonus": 0,
                "total_points": total,
                "valid_matches": len([p for p in preds if matches_dict.get(p.get("match_id"), {}).get("status") == "finished"]),
                "correct_matches": 0,
            }},
            upsert=True,
        )

    # Update matchups for this round
    matchups = await tournament_matchups_col.find(
        {"tournament_id": tournament_id, "round_number": rnd["round_number"], "round_type": rnd["round_type"]},
        {"_id": 0}
    ).to_list(200)

    for mu in matchups:
        a_pts = user_scores.get(mu["user_a_id"], 0.0)
        b_pts = user_scores.get(mu["user_b_id"], 0.0)
        if a_pts > b_pts:
            result = "user_a_win"
            winner = mu["user_a_id"]
        elif b_pts > a_pts:
            result = "user_b_win"
            winner = mu["user_b_id"]
        else:
            result = "draw"
            winner = None

        await tournament_matchups_col.update_one({"id": mu["id"]}, {"$set": {
            "user_a_points": a_pts,
            "user_b_points": b_pts,
            "result": result,
            "winner_id": winner,
            "status": "completed",
        }})

    await tournament_rounds_col.update_one({"id": round_id}, {"$set": {"status": "COMPLETED"}})
    return {"ok": True, "user_scores": user_scores, "matchups_updated": len(matchups)}


# ── ADMIN: Generate knockout bracket ──

@tournament_router.post("/{tournament_id}/generate-knockout")
async def generate_knockout(tournament_id: str, req: AdvanceKnockoutReq, user=Depends(get_current_user)):
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo il Super Admin")
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] != "groups":
        raise HTTPException(400, "Il torneo deve essere in fase gironi")

    groups = await tournament_groups_col.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).to_list(20)

    # Calculate group standings
    group_standings = {}
    for g in groups:
        standings = []
        for member in g["members"]:
            uid = member["user_id"]
            matchups = await tournament_matchups_col.find(
                {"tournament_id": tournament_id, "round_type": "group",
                 "$or": [{"user_a_id": uid}, {"user_b_id": uid}],
                 "status": "completed"},
                {"_id": 0}
            ).to_list(50)
            pts = 0
            total_pred_pts = 0.0
            for mu in matchups:
                is_a = mu["user_a_id"] == uid
                my_pts = mu["user_a_points"] if is_a else mu["user_b_points"]
                total_pred_pts += my_pts
                if mu["result"] == "draw":
                    pts += 1
                elif (mu["result"] == "user_a_win" and is_a) or (mu["result"] == "user_b_win" and not is_a):
                    pts += 3
            standings.append({
                "user_id": uid,
                "username": member["username"],
                "points": pts,
                "pred_points": total_pred_pts,  # tiebreaker
            })
        # Sort: points desc, then pred_points desc
        standings.sort(key=lambda x: (-x["points"], -x["pred_points"]))
        group_standings[g["group_name"]] = standings

    # Determine who advances
    advance_count = t["advance_count"]
    advanced = {}  # group_name -> [qualified users]
    for gn, st in group_standings.items():
        advanced[gn] = st[:advance_count]

    # Generate knockout matchups based on rules
    knockout_matchups = []
    group_names = sorted(advanced.keys())

    if req.matchup_rules == "1v2":
        # 1st of group A vs 2nd of group B, 1st of B vs 2nd of A, etc.
        for i in range(0, len(group_names), 2):
            if i + 1 < len(group_names):
                g1, g2 = group_names[i], group_names[i + 1]
                for rank_a, rank_b in [(0, 1), (0, 1)]:
                    if rank_a < len(advanced[g1]) and rank_b < len(advanced[g2]):
                        a = advanced[g1][rank_a]
                        b = advanced[g2][rank_b]
                        knockout_matchups.append((a, b))
                        # Reverse
                        a2 = advanced[g2][rank_a]
                        b2 = advanced[g1][rank_b]
                        knockout_matchups.append((a2, b2))
                        break  # Only one pair per group combo
    else:
        # Default: sequential pairing of advanced players
        all_advanced = []
        for gn in group_names:
            all_advanced.extend(advanced[gn])
        for i in range(0, len(all_advanced), 2):
            if i + 1 < len(all_advanced):
                knockout_matchups.append((all_advanced[i], all_advanced[i + 1]))

    # Determine knockout round type
    n = len(knockout_matchups)
    if n <= 1:
        round_type = "final"
    elif n <= 2:
        round_type = "semifinal"
    elif n <= 4:
        round_type = "quarterfinal"
    else:
        round_type = "quarterfinal"

    # Create matchup documents
    matchup_docs = []
    for a, b in knockout_matchups:
        matchup_docs.append({
            "id": new_id(),
            "tournament_id": tournament_id,
            "group_id": None,
            "round_number": 0,  # Will be set when round is created
            "round_type": round_type,
            "user_a_id": a["user_id"],
            "user_b_id": b["user_id"],
            "user_a_username": a["username"],
            "user_b_username": b["username"],
            "user_a_points": 0.0,
            "user_b_points": 0.0,
            "result": "pending",
            "winner_id": None,
            "status": "pending",
        })

    if matchup_docs:
        await tournament_matchups_col.insert_many(matchup_docs)

    # Mark eliminated users
    advanced_ids = set()
    for gn in group_names:
        for u in advanced[gn]:
            advanced_ids.add(u["user_id"])
    await tournament_registrations_col.update_many(
        {"tournament_id": tournament_id, "user_id": {"$nin": list(advanced_ids)}},
        {"$set": {"status": "eliminated"}}
    )

    await tournaments_col.update_one({"id": tournament_id}, {"$set": {"status": "knockout"}})

    return {
        "ok": True,
        "status": "knockout",
        "group_standings": group_standings,
        "knockout_matchups": [{"user_a": a["username"], "user_b": b["username"]} for a, b in knockout_matchups],
        "eliminated": len(knockout_matchups) * 0,  # info
    }


# ══════════════════════════════════════════
# USER ENDPOINTS
# ══════════════════════════════════════════

# ── List tournaments ──

@tournament_router.get("")
async def list_tournaments(user=Depends(get_current_user), include_drafts: bool = False):
    query = {} if (include_drafts and user.get("role") in ("admin", "superadmin")) else {"status": {"$ne": "draft"}}
    tournaments = await tournaments_col.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    # Enrich with registration counts
    for t in tournaments:
        count = await tournament_registrations_col.count_documents(
            {"tournament_id": t["id"], "status": "active"}
        )
        t["registered_count"] = count
        t["spots_left"] = t["max_participants"] - count
        # Check if current user is registered
        my_reg = await tournament_registrations_col.find_one(
            {"tournament_id": t["id"], "user_id": user["id"]}, {"_id": 0}
        )
        t["is_registered"] = my_reg is not None
        t["my_status"] = my_reg["status"] if my_reg else None

    return tournaments


# ── Tournament detail ──

@tournament_router.get("/{tournament_id}")
async def get_tournament(tournament_id: str, user=Depends(get_current_user)):
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")

    count = await tournament_registrations_col.count_documents(
        {"tournament_id": tournament_id, "status": "active"}
    )
    t["registered_count"] = count
    t["spots_left"] = t["max_participants"] - count

    my_reg = await tournament_registrations_col.find_one(
        {"tournament_id": tournament_id, "user_id": user["id"]}, {"_id": 0}
    )
    t["is_registered"] = my_reg is not None
    t["my_status"] = my_reg["status"] if my_reg else None

    # Include groups if started
    if t["status"] in ("groups", "knockout", "completed"):
        groups = await tournament_groups_col.find(
            {"tournament_id": tournament_id}, {"_id": 0}
        ).to_list(20)
        t["groups"] = groups

    # Include rounds
    rounds = await tournament_rounds_col.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort("round_number", 1).to_list(50)
    t["rounds"] = rounds

    return t


# ── Register for tournament ──

@tournament_router.post("/{tournament_id}/register")
async def register_tournament(tournament_id: str, user=Depends(get_current_user)):
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] != "registration":
        raise HTTPException(400, "Le iscrizioni non sono aperte")

    # Check if already registered
    existing = await tournament_registrations_col.find_one(
        {"tournament_id": tournament_id, "user_id": user["id"]}
    )
    if existing:
        raise HTTPException(400, "Sei gia iscritto a questo torneo")

    # Check spots
    count = await tournament_registrations_col.count_documents(
        {"tournament_id": tournament_id, "status": "active"}
    )
    if count >= t["max_participants"]:
        raise HTTPException(400, "Torneo al completo")

    reg = {
        "id": new_id(),
        "tournament_id": tournament_id,
        "user_id": user["id"],
        "username": user.get("username", "?"),
        "registered_at": now_utc(),
        "status": "active",
    }
    await tournament_registrations_col.insert_one(reg)
    reg.pop("_id", None)
    return {"ok": True, "registration": reg}


# ── Unregister ──

@tournament_router.delete("/{tournament_id}/register")
async def unregister_tournament(tournament_id: str, user=Depends(get_current_user)):
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] != "registration":
        raise HTTPException(400, "Non puoi disiscriverti dopo l'inizio")
    result = await tournament_registrations_col.delete_one(
        {"tournament_id": tournament_id, "user_id": user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Non sei iscritto")
    return {"ok": True}


# ── User's matchups in tournament ──

@tournament_router.get("/{tournament_id}/my-matchups")
async def get_my_matchups(tournament_id: str, user=Depends(get_current_user)):
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    matchups = await tournament_matchups_col.find(
        {"tournament_id": tournament_id,
         "$or": [{"user_a_id": user["id"]}, {"user_b_id": user["id"]}]},
        {"_id": 0}
    ).to_list(50)
    # Sort by round_number
    matchups.sort(key=lambda x: (x.get("round_number", 0), x.get("round_type", "")))
    return matchups



# ── Group standings ──

@tournament_router.get("/{tournament_id}/groups")
async def get_group_standings(tournament_id: str, user=Depends(get_current_user)):
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")

    groups = await tournament_groups_col.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).to_list(20)

    result = []
    for g in groups:
        standings = []
        for member in g["members"]:
            uid = member["user_id"]
            matchups = await tournament_matchups_col.find(
                {"tournament_id": tournament_id, "round_type": "group",
                 "$or": [{"user_a_id": uid}, {"user_b_id": uid}]},
                {"_id": 0}
            ).to_list(50)

            wins = draws = losses = group_pts = 0
            total_pred_pts = 0.0
            for mu in matchups:
                if mu["status"] != "completed":
                    continue
                is_a = mu["user_a_id"] == uid
                my_pts = mu["user_a_points"] if is_a else mu["user_b_points"]
                total_pred_pts += my_pts
                if mu["result"] == "draw":
                    draws += 1
                    group_pts += 1
                elif (mu["result"] == "user_a_win" and is_a) or (mu["result"] == "user_b_win" and not is_a):
                    wins += 1
                    group_pts += 3
                else:
                    losses += 1

            standings.append({
                "user_id": uid,
                "username": member["username"],
                "played": wins + draws + losses,
                "wins": wins,
                "draws": draws,
                "losses": losses,
                "group_points": group_pts,
                "prediction_points": round(total_pred_pts, 1),
            })

        standings.sort(key=lambda x: (-x["group_points"], -x["prediction_points"]))
        result.append({
            "group_name": g["group_name"],
            "group_id": g["id"],
            "standings": standings,
        })

    return result


# ── Knockout bracket ──

@tournament_router.get("/{tournament_id}/bracket")
async def get_bracket(tournament_id: str, user=Depends(get_current_user)):
    matchups = await tournament_matchups_col.find(
        {"tournament_id": tournament_id, "round_type": {"$ne": "group"}},
        {"_id": 0}
    ).to_list(100)

    # Organize by round_type
    bracket = {}
    for mu in matchups:
        rt = mu["round_type"]
        if rt not in bracket:
            bracket[rt] = []
        bracket[rt].append(mu)

    return {"bracket": bracket}


# ── Round detail with matches ──

@tournament_router.get("/{tournament_id}/rounds/{round_id}")
async def get_round_detail(tournament_id: str, round_id: str, user=Depends(get_current_user)):
    rnd = await tournament_rounds_col.find_one(
        {"id": round_id, "tournament_id": tournament_id}, {"_id": 0}
    )
    if not rnd:
        raise HTTPException(404, "Round non trovato")

    round_matches = await matches_col.find(
        {"matchday_id": round_id, "league_id": tournament_id}, {"_id": 0}
    ).to_list(50)

    # Get user's predictions
    my_preds = await predictions_col.find(
        {"user_id": user["id"], "matchday_id": round_id, "league_id": tournament_id}, {"_id": 0}
    ).to_list(50)
    preds_by_match = {p["match_id"]: p for p in my_preds}

    # Get matchups for this round
    matchups = await tournament_matchups_col.find(
        {"tournament_id": tournament_id, "round_number": rnd["round_number"], "round_type": rnd["round_type"]},
        {"_id": 0}
    ).to_list(100)

    return {
        "round": rnd,
        "matches": round_matches,
        "my_predictions": preds_by_match,
        "matchups": matchups,
    }


# ── Live matchup view (1v1) ──

@tournament_router.get("/{tournament_id}/matchup/{matchup_id}/live")
async def get_matchup_live(tournament_id: str, matchup_id: str, user=Depends(get_current_user)):
    mu = await tournament_matchups_col.find_one(
        {"id": matchup_id, "tournament_id": tournament_id}, {"_id": 0}
    )
    if not mu:
        raise HTTPException(404, "Sfida non trovata")

    # Get the round for this matchup
    rnd = await tournament_rounds_col.find_one(
        {"tournament_id": tournament_id, "round_number": mu["round_number"], "round_type": mu["round_type"]},
        {"_id": 0}
    )
    if not rnd:
        # Round not yet created — return matchup info only
        return {
            "matchup": mu,
            "round": {"label": f"Round {mu['round_number']}", "status": "PENDING"},
            "user_a_total": mu.get("user_a_points", 0.0),
            "user_b_total": mu.get("user_b_points", 0.0),
            "matches": [],
        }

    # Get matches
    round_matches = await matches_col.find(
        {"matchday_id": rnd["id"], "league_id": tournament_id}, {"_id": 0}
    ).to_list(50)

    # Get predictions for both users
    user_a_preds = await predictions_col.find(
        {"user_id": mu["user_a_id"], "matchday_id": rnd["id"], "league_id": tournament_id}, {"_id": 0}
    ).to_list(50)
    user_b_preds = await predictions_col.find(
        {"user_id": mu["user_b_id"], "matchday_id": rnd["id"], "league_id": tournament_id}, {"_id": 0}
    ).to_list(50)

    a_by_match = {p["match_id"]: p for p in user_a_preds}
    b_by_match = {p["match_id"]: p for p in user_b_preds}

    # Calculate live scores
    from scoring import calculate_match_points
    a_total = 0.0
    b_total = 0.0
    match_details = []
    for m in round_matches:
        a_pred = a_by_match.get(m["id"])
        b_pred = b_by_match.get(m["id"])

        a_pts = 0.0
        b_pts = 0.0
        if a_pred and m.get("status") in ("finished", "live"):
            a_pts, _ = calculate_match_points(
                a_pred["prediction_value"], a_pred["market_type"],
                m.get("home_score"), m.get("away_score"),
                m.get("status"), a_pred.get("multiplier", 1.0)
            )
        if b_pred and m.get("status") in ("finished", "live"):
            b_pts, _ = calculate_match_points(
                b_pred["prediction_value"], b_pred["market_type"],
                m.get("home_score"), m.get("away_score"),
                m.get("status"), b_pred.get("multiplier", 1.0)
            )
        a_total += a_pts
        b_total += b_pts

        # Only show opponent's predictions after match starts (like leagues)
        show_predictions = m.get("status") in ("live", "finished")
        match_details.append({
            "match": m,
            "user_a_prediction": a_pred.get("prediction_value") if a_pred and show_predictions else None,
            "user_a_market": a_pred.get("market_type") if a_pred and show_predictions else None,
            "user_a_points": a_pts,
            "user_b_prediction": b_pred.get("prediction_value") if b_pred and show_predictions else None,
            "user_b_market": b_pred.get("market_type") if b_pred and show_predictions else None,
            "user_b_points": b_pts,
        })

    return {
        "matchup": mu,
        "round": rnd,
        "user_a_total": a_total,
        "user_b_total": b_total,
        "matches": match_details,
    }


# ── Submit prediction (reuses existing prediction system) ──

@tournament_router.post("/{tournament_id}/rounds/{round_id}/predict")
async def submit_tournament_prediction(
    tournament_id: str, round_id: str,
    match_id: str, market_type: str, prediction_value: str,
    user=Depends(get_current_user)
):
    # Verify user is registered
    reg = await tournament_registrations_col.find_one(
        {"tournament_id": tournament_id, "user_id": user["id"], "status": "active"}
    )
    if not reg:
        raise HTTPException(403, "Non sei iscritto a questo torneo")

    # Verify round is open
    rnd = await tournament_rounds_col.find_one({"id": round_id, "tournament_id": tournament_id}, {"_id": 0})
    if not rnd or rnd["status"] != "OPEN":
        raise HTTPException(400, "Il round non e aperto per i pronostici")

    # Verify match exists and belongs to this round
    match = await matches_col.find_one(
        {"id": match_id, "matchday_id": round_id, "league_id": tournament_id}, {"_id": 0}
    )
    if not match:
        raise HTTPException(404, "Partita non trovata in questo round")

    # Check deadline (1 minute before kickoff)
    if match.get("start_time"):
        from datetime import datetime, timezone
        try:
            kick = datetime.fromisoformat(match["start_time"].replace("Z", "+00:00"))
            from datetime import timedelta
            if datetime.now(timezone.utc) > kick - timedelta(minutes=1):
                raise HTTPException(400, "Pronostici chiusi per questa partita")
        except (ValueError, TypeError):
            pass

    # Upsert prediction (reuse existing prediction format)
    await predictions_col.update_one(
        {"user_id": user["id"], "match_id": match_id, "league_id": tournament_id},
        {"$set": {
            "id": new_id(),
            "user_id": user["id"],
            "match_id": match_id,
            "matchday_id": round_id,
            "league_id": tournament_id,
            "market_type": market_type,
            "prediction_value": prediction_value,
            "outcome": "pending",
            "points": 0,
            "is_special": False,
            "multiplier": 1.0,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }},
        upsert=True,
    )

    return {"ok": True, "match_id": match_id, "prediction": prediction_value}
