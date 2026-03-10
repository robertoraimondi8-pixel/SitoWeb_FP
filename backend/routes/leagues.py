"""League routes: CRUD, join, fixtures, matchdays, matches."""
from fastapi import APIRouter, HTTPException, Depends
import logging

from database import (
    leagues_col, memberships_col, matchdays_col, matches_col,
    predictions_col, score_summaries_col, seasons_col, users_col
)
from models import (
    LeagueCreate, LeagueJoinRequest, LeagueUpdateRequest,
    MatchdayCreate, MatchCreate, MatchUpdate,
    new_id, now_utc
)
from auth import get_current_user
from services import (
    NATIONAL_LEAGUE_ID, MAX_MATCHES_PER_MATCHDAY, DEFAULT_SCORING_CONFIG,
    generate_invite_code, log_audit, _match_source_query,
    compute_matchday_status, create_notification, create_notification_for_league,
    require_league_admin, recalculate_matchday_scores, recalculate_match_predictions
)

logger = logging.getLogger(__name__)

league_router = APIRouter(prefix="/api/leagues", tags=["Leagues"])


@league_router.get("/seasons")
async def get_league_seasons(user=Depends(get_current_user)):
    seasons = await seasons_col.find({"is_active": True}, {"_id": 0}).to_list(10)
    return seasons


@league_router.get("")
async def get_my_leagues(user=Depends(get_current_user)):
    memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
    league_ids = [m["league_id"] for m in memberships]
    if not league_ids:
        return []
    leagues = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0}).to_list(100)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@league_router.post("")
async def create_league(req: LeagueCreate, user=Depends(get_current_user)):
    if req.end_matchday < req.start_matchday:
        raise HTTPException(400, "La giornata finale deve essere >= giornata iniziale")

    league_id = new_id()
    invite_code = generate_invite_code()
    scoring = req.scoring_config or DEFAULT_SCORING_CONFIG

    league = {
        "id": league_id, "name": req.name, "league_type": "private",
        "season_id": req.season_id, "invite_code": invite_code,
        "owner_id": user["id"], "created_by": user["id"],
        "logo_url": req.logo_url, "start_matchday": req.start_matchday,
        "end_matchday": req.end_matchday, "bet_deadline_minutes": req.bet_deadline_minutes,
        "match_source_type": req.match_source_type, "scoring_config": scoring,
        "include_championship_predictions": req.include_championship_predictions,
        "rules_locked": False, "created_at": now_utc(),
    }

    if req.match_source_type == "national":
        national = await leagues_col.find_one({"league_type": "national"}, {"_id": 0, "id": 1})
        if national:
            league["source_league_id"] = national["id"]

    await leagues_col.insert_one(league)

    existing_membership = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id})
    if existing_membership:
        await memberships_col.update_one({"id": existing_membership["id"]}, {"$set": {"role": "owner", "status": "active"}})
        membership_doc = {**existing_membership, "role": "owner"}
    else:
        membership_doc = {"id": new_id(), "user_id": user["id"], "league_id": league_id, "role": "owner", "status": "active", "joined_at": now_utc()}
        await memberships_col.insert_one(membership_doc)

    logger.info("=" * 60)
    logger.info("[DIAG-1] LEAGUE CREATION")
    logger.info(f"  new_league.id = {league_id}")
    logger.info(f"  new_league.name = {req.name}")
    logger.info(f"  new_league.match_source_type = {req.match_source_type}")
    logger.info(f"  new_league.owner_id = {user['id']}")
    logger.info(f"  creator.user_id = {user['id']}")
    logger.info(f"  creator.email = {user.get('email')}")
    logger.info(f"  membership.role = {membership_doc.get('role')}")
    logger.info(f"  membership.league_id = {membership_doc.get('league_id')}")
    logger.info(f"  OWNER_ID == USER_ID: {league['owner_id'] == user['id']}")
    logger.info("=" * 60)

    await log_audit(user["id"], user["username"], "CREATE", "league", league_id, {"name": req.name})
    league.pop("_id", None)
    league["member_count"] = 1
    return league


@league_router.get("/national")
async def get_national_leagues():
    leagues = await leagues_col.find({"league_type": "national"}, {"_id": 0}).to_list(10)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@league_router.get("/{league_id}")
async def get_league_detail(league_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem and league.get("league_type") != "national":
        raise HTTPException(403, "Non sei membro di questa lega")
    league["member_count"] = await memberships_col.count_documents({"league_id": league_id, "status": "active"})
    if not league.get("scoring_config"):
        league["scoring_config"] = DEFAULT_SCORING_CONFIG
    return league


@league_router.patch("/{league_id}")
async def update_league(league_id: str, req: LeagueUpdateRequest, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    if league.get("owner_id") != user["id"]:
        raise HTTPException(403, "Solo il creatore può modificare la lega")
    locked_fields = {"start_matchday", "end_matchday", "bet_deadline_minutes", "scoring_config", "include_championship_predictions", "match_source_type", "competition_name"}
    if league.get("rules_locked", False):
        incoming = {k for k, v in req.model_dump(exclude_none=True).items() if k in locked_fields}
        if incoming:
            raise HTTPException(403, f"Regole bloccate: impossibile modificare {', '.join(incoming)}")
    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if updates:
        await leagues_col.update_one({"id": league_id}, {"$set": updates})
    updated = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    updated.pop("_id", None)
    return updated


@league_router.post("/join")
async def join_league(req: LeagueJoinRequest, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"invite_code": req.invite_code}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Codice invito non valido")
    existing = await memberships_col.find_one({"user_id": user["id"], "league_id": league["id"]})
    if existing:
        raise HTTPException(400, "Sei già membro di questa lega")
    await memberships_col.insert_one({"id": new_id(), "user_id": user["id"], "league_id": league["id"], "role": "member", "status": "active", "joined_at": now_utc()})
    member_count = await memberships_col.count_documents({"league_id": league["id"], "status": "active"})
    if member_count > 1 and not league.get("rules_locked", False):
        await leagues_col.update_one({"id": league["id"]}, {"$set": {"rules_locked": True}})
        logger.info(f"[League] rules_locked=True for league {league['id'][:8]} (members: {member_count})")
    owner_mem = await memberships_col.find_one({"league_id": league["id"], "role": {"$in": ["owner", "admin"]}}, {"user_id": 1, "_id": 0})
    if owner_mem:
        await create_notification(owner_mem["user_id"], "member_joined", "Nuovo membro!", f"{user.get('username', 'Un utente')} si e' unito alla lega {league.get('name', '')}.", link="/menu/members")
    return {"message": "Iscrizione completata", "league": league}


@league_router.get("/{league_id}/members")
async def get_league_members(league_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem and league.get("league_type") != "national":
        raise HTTPException(403, "Non sei membro di questa lega")
    members = await memberships_col.find({"league_id": league_id, "status": "active"}, {"_id": 0}).to_list(500)
    user_ids = [m["user_id"] for m in members]
    users = await users_col.find({"id": {"$in": user_ids}}, {"_id": 0, "password": 0}).to_list(500)
    user_map = {u["id"]: u for u in users}
    result = []
    for m in members:
        u = user_map.get(m["user_id"], {})
        result.append({"user_id": m["user_id"], "username": u.get("username", ""), "email": u.get("email", ""), "role": m.get("role", "player"), "joined_at": m.get("created_at", "")})
    result.sort(key=lambda x: (0 if x["role"] in ("owner", "admin") else 1, x["username"].lower()))
    return {"league_id": league_id, "league_name": league.get("name"), "members": result}


@league_router.get("/{league_id}/fixtures")
async def get_league_fixtures(league_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    is_manual_league = league.get("match_source_type") in ("manual", "custom", "api")

    logger.info("=" * 60)
    logger.info("[DIAG-4] /api/leagues/{league_id}/fixtures")
    logger.info(f"  league_id requested = {league_id}")
    logger.info(f"  league.name = {league.get('name')}")
    logger.info(f"  league.match_source_type = {league.get('match_source_type')}")
    logger.info(f"  is_manual_league = {is_manual_league}")

    if not is_manual_league:
        source_id = league.get("source_league_id")
        if not source_id:
            nat = await leagues_col.find_one({"league_type": "national"}, {"_id": 0, "id": 1})
            source_id = nat["id"] if nat else None
        source_league = await leagues_col.find_one({"id": source_id}, {"_id": 0}) if source_id else None
        season_id = source_league["season_id"] if source_league else league["season_id"]
        matchdays = await matchdays_col.find({"season_id": season_id, "league_id": NATIONAL_LEAGUE_ID}, {"_id": 0}).sort("number", 1).to_list(100)
        logger.info(f"  NATIONAL MODE: query matchdays by season_id={season_id} league_id=NATIONAL_LEAGUE_ID")
    else:
        source_id = league_id
        season_id = league["season_id"]
        matchdays = await matchdays_col.find({"league_id": league_id}, {"_id": 0}).sort("number", 1).to_list(100)
        logger.info(f"  MANUAL MODE: query matchdays by league_id={league_id}")
        logger.info(f"  Matchdays found: {len(matchdays)}")
        for md in matchdays:
            logger.info(f"    - matchday.id={md.get('id')}, number={md.get('number')}, league_id={md.get('league_id')}")

    start_md = league.get("start_matchday", 1)
    end_md = league.get("end_matchday", 38)
    matchdays = [md for md in matchdays if start_md <= md.get("number", 0) <= end_md]

    result = []
    for md in matchdays:
        if is_manual_league:
            matches_list = await matches_col.find({"matchday_id": md["id"], "league_id": league_id}, {"_id": 0}).to_list(20)
            logger.info(f"  MANUAL/CUSTOM: Matches for matchday {md.get('number')}: {len(matches_list)}")
            for m in matches_list:
                logger.info(f"    - {m.get('home_team')} vs {m.get('away_team')}, league_id={m.get('league_id')}")
        else:
            matches_list = await matches_col.find(_match_source_query(md["id"], NATIONAL_LEAGUE_ID), {"_id": 0}).to_list(20)
        _source_lid = league_id if is_manual_league else NATIONAL_LEAGUE_ID
        effective_status = await compute_matchday_status(md, _source_lid)
        result.append({**md, "status": effective_status, "matches": matches_list})

    logger.info("=" * 60)
    return {"league_id": league_id, "source_league_id": source_id, "matchdays": result}


@league_router.get("/{league_id}/matchdays")
async def get_league_matchdays(league_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem:
        raise HTTPException(403, "Non sei membro di questa lega")
    matchdays = await matchdays_col.find({"league_id": league_id}, {"_id": 0}).sort("number", 1).to_list(50)
    for md in matchdays:
        md["match_count"] = await matches_col.count_documents({"matchday_id": md["id"]})
    return matchdays


@league_router.post("/{league_id}/matchdays")
async def create_league_matchday(league_id: str, req: MatchdayCreate, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    md_id = new_id()
    matchday = {
        "id": md_id, "league_id": league_id,
        "season_id": req.season_id or league["season_id"],
        "number": req.number, "label": req.label or f"Giornata {req.number}",
        "half": req.half, "first_kickoff": req.first_kickoff,
        "status": req.status or "DRAFT", "created_at": now_utc(),
    }
    await matchdays_col.insert_one(matchday)
    matchday.pop("_id", None)
    return matchday


@league_router.put("/{league_id}/matchdays/{matchday_id}")
async def update_league_matchday(league_id: str, matchday_id: str, req: dict, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    matchday = await matchdays_col.find_one({"id": matchday_id, "league_id": league_id}, {"_id": 0})
    updates = {}
    if "status" in req:
        updates["status"] = req["status"]
    if "label" in req:
        updates["label"] = req["label"]
    if updates:
        await matchdays_col.update_one({"id": matchday_id, "league_id": league_id}, {"$set": updates})
    new_status = updates.get("status")
    if new_status == "COMPLETED":
        logger.info(f"[SCORING] Matchday {matchday_id} marked COMPLETED, triggering recalculation...")
        await recalculate_matchday_scores(matchday_id, league_id)
    return await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})


@league_router.post("/{league_id}/matchdays/{matchday_id}/recalculate")
async def force_recalculate_matchday(league_id: str, matchday_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        require_league_admin(league, user)
    logger.info(f"[SCORING] Manual recalculation triggered for matchday {matchday_id} in league {league_id}")
    await calculate_matchday_scores_full_wrapper(matchday_id, user)
    return {"message": "Ricalcolo completato", "matchday_id": matchday_id, "league_id": league_id}


async def calculate_matchday_scores_full_wrapper(matchday_id: str, user: dict):
    """Wrapper for _calculate_matchday_scores from services."""
    from services import calculate_matchday_scores_full
    await calculate_matchday_scores_full(matchday_id, user)


@league_router.delete("/{league_id}/matchdays/{matchday_id}")
async def delete_league_matchday(league_id: str, matchday_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    await matches_col.delete_many({"matchday_id": matchday_id})
    await matchdays_col.delete_one({"id": matchday_id, "league_id": league_id})
    return {"message": "Giornata eliminata"}


@league_router.get("/{league_id}/matchdays/{matchday_id}/matches")
async def get_league_matchday_matches(league_id: str, matchday_id: str, user=Depends(get_current_user)):
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem:
        raise HTTPException(403, "Non sei membro")
    return await matches_col.find({"matchday_id": matchday_id, "league_id": league_id}, {"_id": 0}).to_list(20)


@league_router.post("/{league_id}/matchdays/{matchday_id}/matches")
async def create_league_match(league_id: str, matchday_id: str, req: MatchCreate, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    current_count = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": league_id})
    if current_count >= MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Limite massimo di {MAX_MATCHES_PER_MATCHDAY} partite per giornata raggiunto")
    match_id = new_id()
    match = {
        "id": match_id, "matchday_id": matchday_id, "league_id": league_id,
        "home_team": req.home_team, "away_team": req.away_team,
        "competition": req.competition, "start_time": req.start_time,
        "market_type": req.market_type, "status": req.status,
        "home_score": None, "away_score": None, "created_at": now_utc(),
    }
    await matches_col.insert_one(match)
    match.pop("_id", None)
    return match


@league_router.patch("/{league_id}/matchdays/{matchday_id}/matches/{match_id}")
async def update_league_match(league_id: str, matchday_id: str, match_id: str, req: MatchUpdate, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if updates:
        await matches_col.update_one({"id": match_id, "matchday_id": matchday_id}, {"$set": updates})
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@league_router.delete("/{league_id}/matchdays/{matchday_id}/matches/{match_id}")
async def delete_league_match(league_id: str, matchday_id: str, match_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    await matches_col.delete_one({"id": match_id, "matchday_id": matchday_id, "league_id": league_id})
    return {"message": "Partita eliminata"}


@league_router.put("/{league_id}/matches/{match_id}")
async def update_league_match_simple(league_id: str, match_id: str, req: dict, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    match = await matches_col.find_one({"id": match_id, "league_id": league_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")
    old_status = match.get("status")
    updates = {}
    if "home_score" in req:
        updates["home_score"] = req["home_score"]
    if "away_score" in req:
        updates["away_score"] = req["away_score"]
    if "status" in req:
        updates["status"] = req["status"]
    if updates:
        await matches_col.update_one({"id": match_id, "league_id": league_id}, {"$set": updates})
    new_status = updates.get("status", old_status)
    has_result = (updates.get("home_score") is not None or match.get("home_score") is not None)
    if new_status == "finished" and has_result:
        await recalculate_match_predictions(match_id, league_id)
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@league_router.delete("/{league_id}/matches/{match_id}")
async def delete_league_match_simple(league_id: str, match_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    require_league_admin(league, user)
    await matches_col.delete_one({"id": match_id, "league_id": league_id})
    return {"message": "Partita eliminata"}


@league_router.post("/{league_id}/join-direct")
async def join_league_direct(league_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    existing = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if existing:
        return {"message": "Sei già membro di questa lega", "already_member": True}
    if league.get("league_type") == "national":
        logger.info(f"[JoinDirect] National league join (free) for user {user['id'][:8]}")
    await memberships_col.insert_one({"id": new_id(), "user_id": user["id"], "league_id": league_id, "status": "active", "joined_at": now_utc(), "payment_id": None})
    logger.info(f"[JoinDirect] User {user['id'][:8]} joined league {league_id[:8]}")
    return {"message": "Iscrizione alla lega completata", "already_member": False}
