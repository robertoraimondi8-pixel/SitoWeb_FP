"""User routes: home, profile, notifications, push tokens, news, reminders."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel as PydanticBaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import asyncio
import logging

from database import (
    db, users_col, seasons_col, leagues_col, memberships_col,
    matchdays_col, matches_col, predictions_col, score_summaries_col,
    notifications_col, push_tokens_col
)
from models import (
    ProfileUpdate, CompleteProfileRequest, PasswordChangeRequest, NewsCreate,
    new_id, now_utc
)
from auth import hash_password, verify_password, get_current_user
from scoring import calculate_match_points
import services
from services import (
    MATCHES_PER_MATCHDAY,
    server_now, _match_source_query, compute_matchday_status,
    create_notification, create_notification_for_league,
    send_expo_push, PUSH_ENABLED, REMINDER_CHECK_INTERVAL
)

logger = logging.getLogger(__name__)

user_router = APIRouter(prefix="/api", tags=["User"])
news_router = APIRouter(prefix="/api/news", tags=["News"])


# ── Pydantic models defined here ──
class EmailChangeRequest(PydanticBaseModel):
    new_email: str
    password: str

class PushTokenRequest(PydanticBaseModel):
    token: str
    device_type: Optional[str] = "unknown"


# ========================================
# HOME
# ========================================
@user_router.get("/home")
async def get_home(league_id: str = None, user=Depends(get_current_user)):
    season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
    if not season:
        from models import HomeResponse
        return HomeResponse()

    user_memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
    membership_map = {m["league_id"]: m for m in user_memberships}
    league_ids = list(membership_map.keys())
    user_leagues = []
    if league_ids:
        leagues = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0}).to_list(100)
        user_leagues = leagues

    active_league = None
    if league_id and league_id in league_ids:
        active_league = next((l for l in user_leagues if l["id"] == league_id), None)
    if not active_league:
        saved_id = user.get("current_league_id")
        if saved_id and saved_id in league_ids:
            active_league = next((l for l in user_leagues if l["id"] == saved_id), None)
    if not active_league and user_leagues:
        active_league = user_leagues[0]

    matchday = None
    is_manual_league = active_league and active_league.get("match_source_type") in ("manual", "custom", "api")

    if is_manual_league:
        matchday = await matchdays_col.find_one({"league_id": active_league["id"], "status": "LIVE"}, {"_id": 0})
        if not matchday:
            matchday = await matchdays_col.find_one({"league_id": active_league["id"], "status": "OPEN"}, {"_id": 0})
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"league_id": active_league["id"], "status": {"$ne": "DRAFT"}},
                {"_id": 0}, sort=[("number", -1)]
            )
    else:
        matchday = await matchdays_col.find_one({"season_id": season["id"], "status": "LIVE", "league_id": services.NATIONAL_LEAGUE_ID}, {"_id": 0})
        if not matchday:
            matchday = await matchdays_col.find_one({"season_id": season["id"], "status": "OPEN", "league_id": services.NATIONAL_LEAGUE_ID}, {"_id": 0})
        if not matchday and season.get("current_matchday_id"):
            matchday = await matchdays_col.find_one({"id": season["current_matchday_id"], "league_id": services.NATIONAL_LEAGUE_ID}, {"_id": 0})
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"season_id": season["id"], "league_id": services.NATIONAL_LEAGUE_ID, "status": {"$ne": "DRAFT"}},
                {"_id": 0}, sort=[("number", -1)]
            )

    matchday_data = None
    live_data = None

    if matchday:
        _md_source_lid = active_league["id"] if is_manual_league else services.NATIONAL_LEAGUE_ID
        effective_status = await compute_matchday_status(matchday, _md_source_lid)
        matchday["status"] = effective_status

        now = server_now()
        first_kickoff_str = matchday.get("first_kickoff")
        try:
            if first_kickoff_str and len(str(first_kickoff_str)) > 10:
                first_kickoff = datetime.fromisoformat(str(first_kickoff_str).replace("Z", "+00:00"))
            else:
                first_kickoff = now + timedelta(hours=1)
        except (ValueError, TypeError):
            first_kickoff = now + timedelta(hours=1)

        countdown_seconds = max(0, int((first_kickoff - now).total_seconds())) if effective_status == "OPEN" else 0

        _md_source_lid = active_league["id"] if is_manual_league else services.NATIONAL_LEAGUE_ID
        match_count = await matches_col.count_documents(_match_source_query(matchday["id"], _md_source_lid))
        total_matches = max(match_count, MATCHES_PER_MATCHDAY)

        my_predictions = await predictions_col.count_documents({"user_id": user["id"], "matchday_id": matchday["id"], "league_id": active_league["id"]})

        my_points = None
        if matchday["status"] == "COMPLETED":
            ss = await score_summaries_col.find_one(
                {"user_id": user["id"], "matchday_id": matchday["id"], "league_id": active_league["id"]},
                {"_id": 0, "total_points": 1}
            )
            my_points = ss.get("total_points") if ss else 0.0

        matchday_data = {
            "id": matchday["id"],
            "number": matchday["number"],
            "label": matchday.get("label") or f"Giornata {matchday['number']}",
            "status": matchday["status"],
            "first_kickoff": matchday["first_kickoff"],
            "countdown_seconds": countdown_seconds,
            "total_matches": total_matches,
            "matches_loaded": match_count,
            "my_predictions_count": my_predictions,
            "my_points": my_points,
        }

        if matchday["status"] == "LIVE":
            live_matches = await matches_col.find(_match_source_query(matchday["id"], _md_source_lid), {"_id": 0}).to_list(20)
            preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday["id"], "league_id": active_league["id"]}, {"_id": 0}).to_list(20)
            preds_dict = {p["match_id"]: p for p in preds}
            joker_active = False

            base_pts_sum = 0
            live_list = []
            for m in live_matches:
                pred = preds_dict.get(m["id"])
                pts = 0
                if pred and m.get("home_score") is not None:
                    pts, _ = calculate_match_points(pred["prediction_value"], pred.get("market_type", m.get("market_type", "1X2")), m.get("home_score"), m.get("away_score"), m["status"], multiplier=m.get("multiplier", 1.0))
                    if m["status"] not in ("void", "postponed", "cancelled"):
                        base_pts_sum += pts
                live_list.append({
                    "match_id": m["id"], "home_team": m["home_team"], "away_team": m["away_team"],
                    "home_score": m.get("home_score"), "away_score": m.get("away_score"),
                    "status": m["status"], "my_prediction": pred["prediction_value"] if pred else None, "points": pts,
                })

            total_prov = base_pts_sum * 2 if joker_active else base_pts_sum
            live_data = {"matchday_id": matchday["id"], "matches": live_list, "total_provisional": total_prov, "joker_active": joker_active}

            league_members_live = await memberships_col.find(
                {"league_id": active_league["id"], "status": "active"}, {"_id": 0, "user_id": 1}
            ).to_list(1000)
            member_ids_live = [m["user_id"] for m in league_members_live]

            all_live_preds = await predictions_col.find(
                {"matchday_id": matchday["id"], "league_id": active_league["id"], "user_id": {"$in": member_ids_live}}, {"_id": 0}
            ).to_list(10000)

            user_preds_map = {}
            for p in all_live_preds:
                uid = p["user_id"]
                if uid not in user_preds_map:
                    user_preds_map[uid] = {}
                user_preds_map[uid][p["match_id"]] = p

            member_scores = []
            for uid in member_ids_live:
                preds_d = user_preds_map.get(uid, {})
                bp = 0
                for lm in live_matches:
                    pred_lm = preds_d.get(lm["id"])
                    if pred_lm and lm.get("home_score") is not None:
                        lm_pts, _ = calculate_match_points(
                            pred_lm["prediction_value"], pred_lm.get("market_type", lm.get("market_type", "1X2")),
                            lm.get("home_score"), lm.get("away_score"), lm["status"], multiplier=lm.get("multiplier", 1.0)
                        )
                        if lm["status"] not in ("void", "postponed", "cancelled"):
                            bp += lm_pts
                member_scores.append((uid, bp))

            member_scores.sort(key=lambda x: -x[1])
            for i, (uid, pts) in enumerate(member_scores):
                if uid == user["id"]:
                    live_data["live_rank"] = i + 1
                    live_data["live_points"] = pts
                    break
            live_data["total_members"] = len(member_ids_live)

    rankings_preview = None
    user_summary = None
    last_5_performance = []

    if user_leagues:
        first_league = active_league or user_leagues[0]

        league_members = await memberships_col.find({"league_id": first_league["id"], "status": "active"}).to_list(1000)
        league_member_ids = [m["user_id"] for m in league_members]

        is_manual_league = first_league.get("match_source_type") in ("manual", "custom", "api")

        if is_manual_league:
            completed_matchdays_docs = await matchdays_col.find(
                {"league_id": first_league["id"], "status": "COMPLETED"}, {"_id": 0, "id": 1, "number": 1}
            ).sort("number", -1).to_list(100)
            logger.info(f"[HOME] last5 league_id={first_league['id']}, source=manual, matchdays_completed={len(completed_matchdays_docs)}")
        else:
            completed_matchdays_docs = await matchdays_col.find(
                {"league_id": services.NATIONAL_LEAGUE_ID, "status": "COMPLETED"}, {"_id": 0, "id": 1, "number": 1}
            ).sort("number", -1).to_list(100)
            logger.info(f"[HOME] last5 league_id={first_league['id']}, source=national, matchdays_completed={len(completed_matchdays_docs)}")

        completed_md_ids = [m["id"] for m in completed_matchdays_docs]
        total_completed_in_season = len(completed_md_ids)

        totals_match = {"user_id": {"$in": league_member_ids}, "matchday_id": {"$in": completed_md_ids}, "league_id": first_league["id"]}

        all_totals = await score_summaries_col.aggregate([
            {"$match": totals_match},
            {"$group": {"_id": "$user_id", "total": {"$sum": "$total_points"}}},
            {"$sort": {"total": -1}},
        ]).to_list(1000)

        entries = []
        user_rank = None
        user_total_points = 0
        if is_manual_league:
            user_matchdays_played = total_completed_in_season
        else:
            user_played_md_ids = await score_summaries_col.distinct(
                "matchday_id",
                {"user_id": user["id"], "matchday_id": {"$in": completed_md_ids}, "league_id": first_league["id"]}
            )
            user_matchdays_played = len(user_played_md_ids)

        for i, t in enumerate(all_totals):
            if t["_id"] == user["id"]:
                user_rank = i + 1
                user_total_points = int(t["total"])
            if i < 5:
                u = await users_col.find_one({"id": t["_id"]}, {"_id": 0, "password": 0})
                entries.append({"rank": i + 1, "user_id": t["_id"], "username": u["username"] if u else "Unknown", "total_points": int(t["total"])})

        rankings_preview = {"league_name": first_league["name"], "top": entries, "current_user_id": user["id"]}
        user_summary = {"rank": user_rank, "points": user_total_points, "matchdays_played": user_matchdays_played, "total_points": user_total_points}

        last_5_matchdays = list(completed_matchdays_docs[:5])
        last_5_matchdays.reverse()

        for md in last_5_matchdays:
            score_filter = {"user_id": user["id"], "matchday_id": md["id"], "league_id": first_league["id"]}
            score = await score_summaries_col.find_one(score_filter, {"_id": 0, "total_points": 1})
            pts = int(score.get("total_points", 0)) if score else 0
            last_5_performance.append({"matchday_number": md["number"], "points": pts})
        logger.info(f"[HOME] last5 league={first_league['id']}, md_ids={[m['id'] for m in last_5_matchdays]}, pts={[r['points'] for r in last_5_performance]}")

    league_response = None
    if active_league:
        league_response = {k: v for k, v in active_league.items() if k != "_id"}
        if "owner_id" not in league_response and "created_by" in active_league:
            league_response["owner_id"] = active_league["created_by"]
        is_owner = active_league.get("owner_id") == user["id"] or active_league.get("created_by") == user["id"]
        my_membership = membership_map.get(active_league["id"])
        my_role = my_membership.get("role", "player") if my_membership else None
        if is_owner and my_membership and my_role not in ("owner", "admin"):
            logger.info(f"[AUTO-REPAIR] Fixing membership role for owner {user['id']} in league {active_league['id']}")
            await memberships_col.update_one({"id": my_membership["id"]}, {"$set": {"role": "owner"}})
            my_role = "owner"
            my_membership["role"] = "owner"
        if is_owner and not my_membership:
            logger.info(f"[AUTO-REPAIR] Creating missing membership for owner {user['id']} in league {active_league['id']}")
            new_mem = {"id": new_id(), "user_id": user["id"], "league_id": active_league["id"], "role": "owner", "status": "active", "joined_at": now_utc()}
            await memberships_col.insert_one(new_mem)
            my_membership = new_mem
            my_role = "owner"
        league_response["my_role"] = my_role
        league_response["is_owner"] = is_owner

        logger.info("=" * 60)
        logger.info("[DIAG-2] /api/home RESPONSE")
        logger.info(f"  user.id = {user['id']}")
        logger.info(f"  user.email = {user.get('email')}")
        logger.info(f"  league.id = {active_league.get('id')}")
        logger.info(f"  league.name = {active_league.get('name')}")
        logger.info(f"  league.match_source_type = {active_league.get('match_source_type')}")
        logger.info(f"  league.owner_id = {active_league.get('owner_id')}")
        logger.info(f"  league.created_by = {active_league.get('created_by')}")
        logger.info(f"  my_membership = {my_membership}")
        logger.info(f"  my_role = {my_role}")
        logger.info(f"  CALCULATED is_owner = {is_owner}")
        logger.info("=" * 60)

    return {
        "matchday": matchday_data, "live": live_data,
        "rankings_preview": rankings_preview, "user_summary": user_summary,
        "last_5_performance": last_5_performance,
        "stats_preview": {"message": "Stats coming soon"},
        "user_leagues": [{k: v for k, v in l.items() if k != "_id"} for l in user_leagues],
        "league": league_response,
    }


# ========================================
# PROFILE
# ========================================
@user_router.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
    return {"user": {k: v for k, v in user.items() if k not in ("_id", "password")}, "leagues_count": len(memberships)}


@user_router.put("/profile")
async def update_profile(req: ProfileUpdate, user=Depends(get_current_user)):
    updates = {}
    if req.username:
        existing = await users_col.find_one({"username": req.username, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(400, "Username already taken")
        updates["username"] = req.username
    if req.language:
        updates["language"] = req.language
    if updates:
        await users_col.update_one({"id": user["id"]}, {"$set": updates})
    updated = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated


@user_router.patch("/profile/current-league")
async def set_current_league(league_id: str = None, user=Depends(get_current_user)):
    if league_id:
        mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
        if not mem:
            raise HTTPException(403, "Non sei membro di questa lega")
        await users_col.update_one({"id": user["id"]}, {"$set": {"current_league_id": league_id}})
    return {"current_league_id": league_id}


@user_router.put("/profile/email")
async def change_email(req: EmailChangeRequest, user=Depends(get_current_user)):
    new_email = req.new_email.strip().lower()
    password = req.password
    if not new_email or "@" not in new_email:
        raise HTTPException(400, "Email non valida")
    if new_email == user.get("email"):
        raise HTTPException(400, "La nuova email è uguale a quella attuale")
    full_user = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 1})
    stored_password = full_user.get("password", "") if full_user else ""
    if not stored_password:
        raise HTTPException(400, "Questo account non ha una password impostata (utente Google)")
    if not verify_password(password, stored_password):
        raise HTTPException(400, "Password non corretta")
    existing = await users_col.find_one({"email": new_email, "id": {"$ne": user["id"]}})
    if existing:
        raise HTTPException(400, "Questa email è già in uso")
    await users_col.update_one({"id": user["id"]}, {"$set": {"email": new_email}})
    return {"message": "Email aggiornata con successo", "email": new_email}


@user_router.put("/profile/password")
async def change_password(req: PasswordChangeRequest, user=Depends(get_current_user)):
    full_user = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 1})
    stored_password = full_user.get("password", "") if full_user else ""
    if not stored_password:
        raise HTTPException(400, "Questo account non ha una password impostata (utente Google)")
    if not verify_password(req.current_password, stored_password):
        raise HTTPException(400, "Password attuale non corretta")
    if len(req.new_password) < 6:
        raise HTTPException(400, "La nuova password deve avere almeno 6 caratteri")
    hashed = hash_password(req.new_password)
    await users_col.update_one({"id": user["id"]}, {"$set": {"password": hashed}})
    return {"message": "Password aggiornata con successo"}


@user_router.delete("/profile")
async def delete_account(user=Depends(get_current_user)):
    uid = user["id"]
    await memberships_col.delete_many({"user_id": uid})
    await predictions_col.delete_many({"user_id": uid})
    await score_summaries_col.delete_many({"user_id": uid})
    from database import standings_cache_col
    await standings_cache_col.delete_many({"user_id": uid})
    await users_col.delete_one({"id": uid})
    return {"message": "Account eliminato"}


@user_router.patch("/profile/complete")
@user_router.post("/users/me/complete-profile")
async def complete_profile(req: CompleteProfileRequest, user=Depends(get_current_user)):
    import re as _re
    from datetime import date as _date
    updates: dict = {}
    if req.first_name is not None:
        updates["first_name"] = req.first_name
    if req.last_name is not None:
        updates["last_name"] = req.last_name
    if req.username is not None:
        uname = req.username.strip()
        if not _re.match(r'^[a-zA-Z0-9_]{3,20}$', uname):
            raise HTTPException(400, "Username non valido (3-20 caratteri: lettere, numeri, underscore)")
        existing = await users_col.find_one({"username": uname, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(409, "Username già in uso")
        updates["username"] = uname
    if req.date_of_birth is not None:
        try:
            dob = datetime.strptime(req.date_of_birth, "%Y-%m-%d").date()
            today = _date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 18:
                raise HTTPException(400, "Devi avere almeno 18 anni")
        except ValueError:
            raise HTTPException(400, "Formato data di nascita non valido (YYYY-MM-DD)")
        updates["date_of_birth"] = req.date_of_birth
    if req.address is not None:
        updates["address"] = req.address
    if req.city is not None:
        updates["city"] = req.city
    if req.country is not None:
        updates["country"] = req.country
    if req.postal_code is not None:
        updates["postal_code"] = req.postal_code
    if req.accepted_privacy is True:
        updates["accepted_privacy"] = True
        updates["consents_accepted_at"] = now_utc()
    if req.accepted_terms is True:
        updates["accepted_terms"] = True

    current = {**user, **updates}
    required_fields = ["first_name", "last_name", "date_of_birth", "address", "city", "country", "postal_code"]
    is_complete = all(current.get(f) for f in required_fields) and current.get("accepted_privacy") and current.get("accepted_terms")
    updates["profile_completed"] = is_complete
    if updates:
        await users_col.update_one({"id": user["id"]}, {"$set": updates})
    updated = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {"user": updated, "profile_completed": is_complete}


# ========================================
# NOTIFICATIONS
# ========================================
@user_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notifs = await notifications_col.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return notifs


@user_router.get("/notifications/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    count = await notifications_col.count_documents({"user_id": user["id"], "read": False})
    return {"count": count}


@user_router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    await notifications_col.update_one({"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"message": "OK"}


@user_router.patch("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    await notifications_col.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"message": "OK"}


# ========================================
# PUSH TOKENS
# ========================================
@user_router.post("/push-token")
async def register_push_token(req: PushTokenRequest, user=Depends(get_current_user)):
    if not req.token or not req.token.startswith("ExponentPushToken["):
        raise HTTPException(400, "Token Expo Push non valido")
    await push_tokens_col.update_one(
        {"user_id": user["id"], "token": req.token},
        {"$set": {"user_id": user["id"], "token": req.token, "device_type": req.device_type, "updated_at": now_utc()}},
        upsert=True,
    )
    return {"message": "Push token registrato"}


@user_router.delete("/push-token")
async def unregister_push_token(req: PushTokenRequest, user=Depends(get_current_user)):
    await push_tokens_col.delete_one({"user_id": user["id"], "token": req.token})
    return {"message": "Push token rimosso"}


# ========================================
# NEWS
# ========================================
@news_router.get("")
async def get_news(user=Depends(get_current_user)):
    news = await db["news"].find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return news


@news_router.post("")
async def create_news_item(req: NewsCreate, user=Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Solo il super admin può creare news")
    doc = {
        "id": new_id(), "title": req.title, "body": req.body,
        "author_id": user["id"], "author_name": user.get("username", "Admin"), "created_at": now_utc(),
    }
    await db["news"].insert_one(doc)
    doc.pop("_id", None)
    all_users = await users_col.find({}, {"_id": 0, "id": 1}).to_list(5000)
    for u in all_users:
        await create_notification(u["id"], "news", req.title, req.body[:100] + ("..." if len(req.body) > 100 else ""), link="/menu/news")
    return doc


# ========================================
# REMINDER SCHEDULER (background tasks)
# ========================================
_reminder_task = None


async def reminder_scheduler_loop():
    """Background task that checks for upcoming matchday deadlines and sends reminders."""
    if not PUSH_ENABLED:
        logger.info("[REMINDER] Push notifications disabled, scheduler not running")
        return
    logger.info(f"[REMINDER] Scheduler started, checking every {REMINDER_CHECK_INTERVAL}s")
    while True:
        try:
            await asyncio.sleep(REMINDER_CHECK_INTERVAL)
            await _check_and_send_reminders()
        except asyncio.CancelledError:
            logger.info("[REMINDER] Scheduler cancelled")
            return
        except Exception as e:
            logger.error(f"[REMINDER] Error: {e}", exc_info=True)


async def _check_and_send_reminders():
    now = datetime.now(timezone.utc)
    open_matchdays = await matchdays_col.find(
        {"status": "OPEN", "first_kickoff": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "number": 1, "league_id": 1, "first_kickoff": 1, "season_id": 1}
    ).to_list(20)

    for md in open_matchdays:
        fk = md.get("first_kickoff")
        if not fk:
            continue
        try:
            if isinstance(fk, str):
                kickoff_dt = datetime.fromisoformat(fk.replace("Z", "+00:00"))
            elif isinstance(fk, datetime):
                kickoff_dt = fk
            else:
                continue
        except (ValueError, TypeError):
            continue

        time_left = (kickoff_dt - now).total_seconds()
        md_id = md["id"]
        md_num = md.get("number", "?")

        if 86100 <= time_left <= 86400:
            already_sent = await notifications_col.find_one({"type": "reminder_24h", "link": {"$regex": md_id}})
            if not already_sent:
                logger.info(f"[REMINDER] Sending 24h reminder for matchday {md_num}")
                leagues = await _get_leagues_for_matchday(md)
                for lg in leagues:
                    await create_notification_for_league(
                        lg["id"], "reminder_24h", f"24 ore alla chiusura!",
                        f"Mancano 24 ore per inserire i pronostici della Giornata {md_num}.",
                        link=f"/predictions?matchday={md_id}",
                    )

        if 7200 <= time_left <= 7500:
            already_sent = await notifications_col.find_one({"type": "reminder_2h", "link": {"$regex": md_id}})
            if not already_sent:
                logger.info(f"[REMINDER] Sending 2h reminder for matchday {md_num}")
                leagues = await _get_leagues_for_matchday(md)
                for lg in leagues:
                    members = await memberships_col.find(
                        {"league_id": lg["id"], "status": "active"}, {"user_id": 1, "_id": 0}
                    ).to_list(500)
                    for m in members:
                        pred_count = await predictions_col.count_documents({
                            "user_id": m["user_id"], "matchday_id": md_id, "league_id": lg["id"],
                        })
                        if pred_count == 0:
                            await create_notification(
                                m["user_id"], "reminder_2h", f"Ultima chance!",
                                f"Hai solo 2 ore per inserire i pronostici della Giornata {md_num}!",
                                link=f"/predictions?matchday={md_id}",
                            )


async def _get_leagues_for_matchday(md: dict) -> list:
    league_id = md.get("league_id")
    if league_id:
        leagues = await leagues_col.find(
            {"$or": [{"id": league_id}, {"league_type": "national"}]}, {"_id": 0, "id": 1}
        ).to_list(50)
    else:
        leagues = await leagues_col.find({"league_type": "national"}, {"_id": 0, "id": 1}).to_list(50)
    return leagues
