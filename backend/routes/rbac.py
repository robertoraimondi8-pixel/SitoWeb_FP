"""RBAC routes: permissions, roles, users management, leagues management, admin operations."""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
import logging

from database import (
    users_col, roles_col, leagues_col, memberships_col,
    matchdays_col, matches_col, predictions_col,
    score_summaries_col, standings_cache_col,
    joker_usages_col, payments_col, audit_logs_col,
    password_resets_col, seasons_col,
    tournaments_col, tournament_rounds_col,
    tournament_matchups_col, tournament_registrations_col
)
from models import (
    RoleCreate, RoleUpdate, AssignRolesRequest, SetSuperAdminRequest,
    new_id, now_utc
)
from auth import get_current_user, hash_password
from permissions import ALL_PERMISSIONS, require_permission, get_user_permissions
from services import (
    NATIONAL_LEAGUE_ID, DEFAULT_SCORING_CONFIG,
    log_audit, generate_invite_code, compute_matchday_status
)

logger = logging.getLogger(__name__)

rbac_router = APIRouter(prefix="/api/rbac", tags=["RBAC"])


@rbac_router.get("/permissions")
async def list_permissions(user=Depends(require_permission("admin.roles.manage"))):
    """List all available permissions in the system."""
    return [{"key": k, "description": v} for k, v in ALL_PERMISSIONS.items()]


@rbac_router.get("/my-permissions")
async def my_permissions(user=Depends(get_current_user)):
    """Get the current user's aggregated permissions."""
    perms = await get_user_permissions(user)
    return {
        "user_id": user["id"],
        "is_super_admin": user.get("is_super_admin", False),
        "permissions": perms,
        "role_ids": user.get("role_ids", []),
    }


@rbac_router.get("/dashboard-stats")
async def dashboard_stats(user=Depends(require_permission("admin.dashboard.view"))):
    """Aggregated KPI stats for the admin dashboard overview."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    one_day_ago = now - timedelta(hours=24)
    seven_days_ago_str = seven_days_ago.isoformat()
    one_day_ago_str = one_day_ago.isoformat()

    # --- Users KPI ---
    total_users = await users_col.count_documents({"is_deleted": {"$ne": True}})
    disabled_users = await users_col.count_documents({"is_disabled": True, "is_deleted": {"$ne": True}})
    deleted_users = await users_col.count_documents({"is_deleted": True})
    new_users_7d = await users_col.count_documents({
        "created_at": {"$gte": seven_days_ago_str},
        "is_deleted": {"$ne": True}
    })
    recent_logins = await users_col.count_documents({
        "last_login": {"$gte": one_day_ago_str}
    })
    five_min_ago_str = (now - timedelta(minutes=5)).isoformat()
    online_users = await users_col.count_documents({
        "last_activity": {"$gte": five_min_ago_str}
    })

    # --- Leagues KPI ---
    total_leagues = await leagues_col.count_documents({})
    all_leagues_list = await leagues_col.find(
        {}, {"_id": 0, "id": 1, "name": 1, "owner_id": 1, "league_type": 1, "match_source_type": 1}
    ).to_list(500)
    at_risk_leagues = []
    for lg in all_leagues_list:
        if lg.get("league_type") == "national":
            continue
        if lg.get("match_source_type") == "national":
            continue
        if not lg.get("owner_id"):
            at_risk_leagues.append({"id": lg["id"], "name": lg["name"], "reason": "Nessun owner"})
            continue
        admin_count = await memberships_col.count_documents({
            "league_id": lg["id"],
            "role": {"$in": ["admin", "owner"]},
            "status": "active"
        })
        if admin_count == 0:
            at_risk_leagues.append({"id": lg["id"], "name": lg["name"], "reason": "Nessun admin"})

    # --- Matchday KPI ---
    md_statuses = {}
    for st in ("DRAFT", "COMPLETED"):
        md_statuses[st] = await matchdays_col.count_documents({"status": st})
    open_locked = await matchdays_col.find(
        {"status": {"$in": ["OPEN", "LOCKED"]}}, {"_id": 0}
    ).to_list(100)
    for md in open_locked:
        eff = await compute_matchday_status(md, md.get("league_id", ""))
        md_statuses[eff] = md_statuses.get(eff, 0) + 1
    md_statuses["LIVE"] = md_statuses.get("LIVE", 0) + await matchdays_col.count_documents({"status": "LIVE"})

    # --- Payments KPI ---
    recent_payments = await payments_col.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    for p in recent_payments:
        p.pop("_id", None)
    pending_payments = await payments_col.count_documents({"payment_status": {"$ne": "paid"}})
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    payments_today = await payments_col.count_documents({"created_at": {"$gte": today_start}})
    payments_7d = await payments_col.count_documents({"created_at": {"$gte": seven_days_ago_str}})
    failed_payments = await payments_col.count_documents({"payment_status": "failed"})
    # Total collected
    paid_list = await payments_col.find({"payment_status": "paid"}, {"_id": 0, "amount": 1}).to_list(5000)
    total_collected = sum(p.get("amount", 0) for p in paid_list)

    # --- Tournaments KPI ---
    total_tournaments = await tournaments_col.count_documents({})
    all_tournaments = await tournaments_col.find({}, {"_id": 0, "id": 1, "name": 1, "status": 1}).to_list(200)
    active_tournaments = sum(1 for t in all_tournaments if t.get("status") in ("active", "in_progress", "groups", "knockout"))
    completed_tournaments = sum(1 for t in all_tournaments if t.get("status") == "completed")
    pending_tournaments = sum(1 for t in all_tournaments if t.get("status") in ("pending", "draft", None))
    # Tournaments at risk
    tournaments_at_risk = []
    for t in all_tournaments:
        tid = t["id"]
        tname = t.get("name", "?")
        # No rounds generated
        round_count = await tournament_rounds_col.count_documents({"tournament_id": tid})
        if round_count == 0 and t.get("status") in ("active", "in_progress"):
            tournaments_at_risk.append({"id": tid, "name": tname, "reason": "Nessun round generato"})
            continue
        # No participants
        reg_count = await tournament_registrations_col.count_documents({"tournament_id": tid, "status": "active"})
        if reg_count == 0:
            tournaments_at_risk.append({"id": tid, "name": tname, "reason": "Nessun partecipante"})
            continue
        # Stuck in pending
        if t.get("status") in ("pending", "draft", None):
            tournaments_at_risk.append({"id": tid, "name": tname, "reason": "Stato pending/draft"})
    # Live tournament rounds
    live_tournament_rounds = await tournament_rounds_col.count_documents({"status": "LIVE"})

    # --- Match Status KPI ---
    today_str = now.strftime("%Y-%m-%d")
    matches_today = await matches_col.count_documents({
        "kickoff": {"$regex": f"^{today_str}"}
    })
    matches_live = await matches_col.count_documents({"status": "live"})
    matches_no_result = await matches_col.count_documents({
        "status": "finished",
        "$or": [{"home_score": None}, {"away_score": None}]
    })
    # Matches in finished matchdays still marked as scheduled/live
    finished_md_ids = [md["id"] async for md in matchdays_col.find({"status": "COMPLETED"}, {"_id": 0, "id": 1})]
    matches_inconsistent = 0
    if finished_md_ids:
        matches_inconsistent = await matches_col.count_documents({
            "matchday_id": {"$in": finished_md_ids},
            "status": {"$in": ["scheduled", "live"]}
        })

    # --- Predictions Activity KPI ---
    predictions_today = await predictions_col.count_documents({
        "created_at": {"$gte": today_start}
    })
    # Active matchday IDs (OPEN or LIVE)
    active_md_ids = []
    async for md in matchdays_col.find({"status": {"$in": ["OPEN", "LOCKED", "LIVE"]}}, {"_id": 0, "id": 1}):
        active_md_ids.append(md["id"])
    # Also add live tournament rounds
    async for r in tournament_rounds_col.find({"status": {"$in": ["OPEN", "LIVE"]}}, {"_id": 0, "id": 1}):
        active_md_ids.append(r["id"])
    predictions_active = 0
    if active_md_ids:
        predictions_active = await predictions_col.count_documents({
            "matchday_id": {"$in": active_md_ids}
        })
    # League vs tournament predictions (count by league_id presence in tournaments)
    tournament_ids = [t["id"] for t in all_tournaments]
    predictions_tournament = 0
    predictions_league = 0
    if tournament_ids:
        predictions_tournament = await predictions_col.count_documents({"league_id": {"$in": tournament_ids}})
    total_predictions = await predictions_col.count_documents({})
    predictions_league = total_predictions - predictions_tournament

    # --- Audit ---
    recent_audit = await audit_logs_col.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    # --- Upcoming Prediction Deadlines ---
    upcoming_deadlines = []
    # League matchdays that are OPEN or LOCKED (predictions still possible or about to close)
    open_matchdays = await matchdays_col.find(
        {"status": {"$in": ["OPEN", "LOCKED"]}},
        {"_id": 0, "id": 1, "label": 1, "league_id": 1, "first_kickoff": 1, "status": 1}
    ).to_list(50)
    for md in open_matchdays:
        league = await leagues_col.find_one({"id": md.get("league_id")}, {"_id": 0, "name": 1, "league_type": 1})
        league_name = league["name"] if league else md.get("league_id", "?")
        league_type = league.get("league_type", "private") if league else "private"
        comp_type = "Lega Nazionale" if league_type == "national" else "Lega Privata"
        upcoming_deadlines.append({
            "type": comp_type,
            "competition_name": league_name,
            "label": md.get("label", "?"),
            "closes_at": md.get("first_kickoff"),
            "competition_id": md.get("league_id"),
            "matchday_id": md.get("id"),
            "status": md.get("status"),
        })
    # Tournament rounds that are OPEN
    open_rounds = await tournament_rounds_col.find(
        {"status": {"$in": ["OPEN"]}},
        {"_id": 0, "id": 1, "label": 1, "tournament_id": 1, "round_number": 1, "status": 1}
    ).to_list(50)
    for r in open_rounds:
        tourn = await tournaments_col.find_one({"id": r.get("tournament_id")}, {"_id": 0, "name": 1})
        tourn_name = tourn["name"] if tourn else r.get("tournament_id", "?")
        # Get first match kickoff for this round
        first_match = await matches_col.find_one(
            {"matchday_id": r["id"]},
            {"_id": 0, "kickoff": 1}
        )
        closes_at = first_match.get("kickoff") if first_match else None
        upcoming_deadlines.append({
            "type": "Torneo",
            "competition_name": tourn_name,
            "label": r.get("label", f"Round {r.get('round_number', '?')}"),
            "closes_at": closes_at,
            "competition_id": r.get("tournament_id"),
            "matchday_id": r.get("id"),
            "status": r.get("status"),
        })
    # Sort by closes_at ascending (soonest first)
    upcoming_deadlines.sort(key=lambda x: x.get("closes_at") or "9999")

    return {
        "users": {
            "total": total_users,
            "disabled": disabled_users,
            "deleted": deleted_users,
            "new_7d": new_users_7d,
            "recent_logins_24h": recent_logins,
            "online": online_users,
        },
        "leagues": {
            "total": total_leagues,
            "at_risk": at_risk_leagues,
            "national_count": sum(1 for lg in all_leagues_list if lg.get("league_type") == "national"),
            "private_custom_count": sum(1 for lg in all_leagues_list if lg.get("league_type") != "national" and lg.get("match_source_type") != "national"),
            "private_national_count": sum(1 for lg in all_leagues_list if lg.get("league_type") != "national" and lg.get("match_source_type") == "national"),
        },
        "tournaments": {
            "total": total_tournaments,
            "active": active_tournaments,
            "completed": completed_tournaments,
            "pending": pending_tournaments,
            "live_rounds": live_tournament_rounds,
            "at_risk": tournaments_at_risk,
        },
        "matches": {
            "today": matches_today,
            "live": matches_live,
            "no_result": matches_no_result,
            "inconsistent": matches_inconsistent,
        },
        "predictions": {
            "total": total_predictions,
            "today": predictions_today,
            "active_matchdays": predictions_active,
            "league": predictions_league,
            "tournament": predictions_tournament,
        },
        "matchdays": md_statuses,
        "payments": {
            "recent": recent_payments,
            "pending_count": pending_payments,
            "today": payments_today,
            "last_7d": payments_7d,
            "total_collected": round(total_collected, 2),
            "failed": failed_payments,
        },
        "audit": recent_audit,
        "upcoming_deadlines": upcoming_deadlines,
    }


@rbac_router.get("/roles")
async def list_roles(user=Depends(require_permission("admin.roles.manage"))):
    """List all roles."""
    roles = await roles_col.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return roles


@rbac_router.post("/roles")
async def create_role(req: RoleCreate, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Create a new role."""
    invalid = [p for p in req.permissions if p not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(400, f"Permessi non validi: {invalid}")

    existing = await roles_col.find_one({"name": req.name})
    if existing:
        raise HTTPException(409, f"Ruolo '{req.name}' esiste già")

    role_doc = {
        "id": new_id(),
        "name": req.name,
        "description": req.description or "",
        "permissions": req.permissions,
        "is_system": False,
        "created_at": now_utc(),
    }
    await roles_col.insert_one(role_doc)
    role_doc.pop("_id", None)

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "CREATE", "role", role_doc["id"],
        {"name": req.name, "permissions": req.permissions},
        actor_roles=user.get("role_ids", []), ip=ip
    )
    return role_doc


@rbac_router.put("/roles/{role_id}")
async def update_role(role_id: str, req: RoleUpdate, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Update an existing role."""
    role = await roles_col.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(404, "Ruolo non trovato")

    before = {k: v for k, v in role.items() if k != "_id"}
    updates = {}
    if req.name is not None:
        dup = await roles_col.find_one({"name": req.name, "id": {"$ne": role_id}})
        if dup:
            raise HTTPException(409, f"Ruolo '{req.name}' esiste già")
        updates["name"] = req.name
    if req.description is not None:
        updates["description"] = req.description
    if req.permissions is not None:
        invalid = [p for p in req.permissions if p not in ALL_PERMISSIONS]
        if invalid:
            raise HTTPException(400, f"Permessi non validi: {invalid}")
        updates["permissions"] = req.permissions

    if not updates:
        raise HTTPException(400, "Nessun aggiornamento fornito")

    await roles_col.update_one({"id": role_id}, {"$set": updates})
    updated = await roles_col.find_one({"id": role_id}, {"_id": 0})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "UPDATE", "role", role_id,
        updates, actor_roles=user.get("role_ids", []), ip=ip,
        before=before, after={k: v for k, v in updated.items() if k != "_id"}
    )
    return updated


@rbac_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Delete a role. System roles cannot be deleted."""
    role = await roles_col.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(404, "Ruolo non trovato")
    if role.get("is_system"):
        raise HTTPException(403, "I ruoli di sistema non possono essere eliminati")

    await users_col.update_many(
        {"role_ids": role_id},
        {"$pull": {"role_ids": role_id}}
    )
    await roles_col.delete_one({"id": role_id})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "DELETE", "role", role_id,
        {"name": role.get("name")},
        actor_roles=user.get("role_ids", []), ip=ip
    )
    return {"deleted": True}


@rbac_router.get("/users")
async def list_users_rbac(request: Request, user=Depends(require_permission("admin.users.manage"))):
    """List all users with their role assignments and league info."""
    users = await users_col.find(
        {}, {"_id": 0, "password": 0}
    ).sort("username", 1).to_list(5000)

    all_roles = {r["id"]: r for r in await roles_col.find({}, {"_id": 0}).to_list(200)}

    all_memberships = await memberships_col.find(
        {"status": "active"}, {"_id": 0, "user_id": 1, "league_id": 1, "role": 1}
    ).to_list(50000)
    all_leagues = await leagues_col.find({}, {"_id": 0, "id": 1, "owner_id": 1, "created_by": 1}).to_list(500)
    leagues_by_owner = {}
    leagues_by_creator = {}
    for lg in all_leagues:
        if lg.get("owner_id"):
            leagues_by_owner.setdefault(lg["owner_id"], []).append(lg["id"])
        if lg.get("created_by"):
            leagues_by_creator.setdefault(lg["created_by"], []).append(lg["id"])
    memberships_by_user = {}
    for m in all_memberships:
        memberships_by_user.setdefault(m["user_id"], []).append(m)

    result = []
    for u in users:
        uid = u["id"]
        role_ids = u.get("role_ids", [])
        roles_detail = [
            {"id": rid, "name": all_roles[rid]["name"]}
            for rid in role_ids if rid in all_roles
        ]
        user_memberships = memberships_by_user.get(uid, [])
        leagues_admin = [m for m in user_memberships if m.get("role") in ("admin", "owner")]
        result.append({
            "id": uid,
            "email": u["email"],
            "username": u["username"],
            "role": u.get("role"),
            "is_super_admin": u.get("is_super_admin", False),
            "is_disabled": u.get("is_disabled", False),
            "is_deleted": u.get("is_deleted", False),
            "role_ids": role_ids,
            "roles": roles_detail,
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login"),
            "last_activity": u.get("last_activity"),
            "leagues_created": len(leagues_by_creator.get(uid, [])),
            "leagues_admin": len(leagues_admin),
            "leagues_member": len(user_memberships),
        })
    return result


@rbac_router.put("/users/{user_id}/roles")
async def assign_user_roles(user_id: str, req: AssignRolesRequest, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Assign roles to a user."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    for rid in req.role_ids:
        r = await roles_col.find_one({"id": rid})
        if not r:
            raise HTTPException(400, f"Ruolo non trovato: {rid}")

    before_roles = target.get("role_ids", [])
    await users_col.update_one({"id": user_id}, {"$set": {"role_ids": req.role_ids}})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "ASSIGN_ROLES", "user", user_id,
        {"target_username": target["username"]},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"role_ids": before_roles}, after={"role_ids": req.role_ids}
    )
    return {"user_id": user_id, "role_ids": req.role_ids}


@rbac_router.put("/users/{user_id}/super-admin")
async def set_super_admin(user_id: str, req: SetSuperAdminRequest, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Set or remove super_admin flag on a user."""
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo un super admin può modificare questo flag")

    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    if user_id == user["id"] and not req.is_super_admin:
        raise HTTPException(400, "Non puoi rimuovere il tuo status di super admin")

    if not req.is_super_admin and target.get("is_super_admin"):
        sa_count = await users_col.count_documents({"is_super_admin": True})
        if sa_count <= 1:
            raise HTTPException(400, "Non puoi rimuovere l'ultimo super admin")

    before_val = target.get("is_super_admin", False)
    await users_col.update_one({"id": user_id}, {"$set": {"is_super_admin": req.is_super_admin}})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "SET_SUPER_ADMIN", "user", user_id,
        {"target_username": target["username"], "is_super_admin": req.is_super_admin},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"is_super_admin": before_val}, after={"is_super_admin": req.is_super_admin}
    )
    return {"user_id": user_id, "is_super_admin": req.is_super_admin}


@rbac_router.put("/users/{user_id}/status")
async def toggle_user_status(user_id: str, request: Request, user=Depends(require_permission("admin.users.manage"))):
    """Disable or enable a user account."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    if user_id == user["id"]:
        raise HTTPException(400, "Non puoi disabilitare il tuo account")

    if target.get("is_super_admin") and not user.get("is_super_admin"):
        raise HTTPException(403, "Non puoi disabilitare un super admin")

    new_status = not target.get("is_disabled", False)
    await users_col.update_one({"id": user_id}, {"$set": {"is_disabled": new_status}})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "TOGGLE_STATUS", "user", user_id,
        {"target_username": target["username"], "is_disabled": new_status},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"is_disabled": target.get("is_disabled", False)}, after={"is_disabled": new_status}
    )
    return {"user_id": user_id, "is_disabled": new_status}


@rbac_router.get("/users/{user_id}/leagues")
async def get_user_leagues(user_id: str, user=Depends(require_permission("admin.users.manage"))):
    """Get detailed league info for a user."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    memberships = await memberships_col.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(500)
    league_ids = [m["league_id"] for m in memberships]
    leagues = {l["id"]: l for l in await leagues_col.find(
        {"id": {"$in": league_ids}}, {"_id": 0}
    ).to_list(500)}

    result = []
    for m in memberships:
        lg = leagues.get(m["league_id"])
        if not lg:
            continue
        result.append({
            "league_id": lg["id"],
            "league_name": lg["name"],
            "league_type": lg.get("league_type", ""),
            "membership_role": m.get("role", "member"),
            "is_owner": lg.get("owner_id") == user_id,
            "is_creator": lg.get("created_by") == user_id,
            "joined_at": m.get("joined_at"),
        })
    return result


@rbac_router.put("/users/{user_id}/soft-delete")
async def soft_delete_user(user_id: str, request: Request, user=Depends(require_permission("admin.users.manage"))):
    """Soft-delete a user. Blocks if user is sole owner/admin of any league."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")
    if target.get("is_deleted"):
        raise HTTPException(400, "Utente già eliminato")
    if user_id == user["id"]:
        raise HTTPException(400, "Non puoi eliminare il tuo account")
    if target.get("is_super_admin"):
        raise HTTPException(403, "Non puoi eliminare un super admin")

    orphan_leagues = []
    owned_leagues = await leagues_col.find(
        {"owner_id": user_id}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    for lg in owned_leagues:
        other_admins = await memberships_col.count_documents({
            "league_id": lg["id"],
            "user_id": {"$ne": user_id},
            "role": {"$in": ["admin", "owner"]},
            "status": "active"
        })
        if other_admins == 0:
            orphan_leagues.append({"id": lg["id"], "name": lg["name"]})

    if orphan_leagues:
        raise HTTPException(409, detail={
            "message": "L'utente è l'unico admin/owner di queste leghe. Trasferisci la ownership prima di eliminare.",
            "orphan_leagues": orphan_leagues
        })

    await users_col.update_one({"id": user_id}, {"$set": {
        "is_deleted": True,
        "is_disabled": True,
        "deleted_at": now_utc(),
        "deleted_by": user["id"],
    }})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "SOFT_DELETE", "user", user_id,
        {"target_username": target["username"], "target_email": target["email"]},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"is_deleted": False}, after={"is_deleted": True}
    )
    return {"user_id": user_id, "is_deleted": True}


@rbac_router.get("/leagues")
async def rbac_list_leagues(user=Depends(require_permission("admin.leagues.manage"))):
    """List all leagues with owner, admins, and member counts."""
    leagues = await leagues_col.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    result = []
    for lg in leagues:
        member_count = await memberships_col.count_documents({"league_id": lg["id"], "status": "active"})
        admins = await memberships_col.find(
            {"league_id": lg["id"], "role": {"$in": ["admin", "owner"]}, "status": "active"},
            {"_id": 0, "user_id": 1, "role": 1}
        ).to_list(50)
        admin_ids = [a["user_id"] for a in admins]
        admin_users = {u["id"]: u async for u in users_col.find(
            {"id": {"$in": admin_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}
        )}
        owner = None
        if lg.get("owner_id"):
            ow = await users_col.find_one({"id": lg["owner_id"]}, {"_id": 0, "id": 1, "username": 1, "email": 1})
            if ow:
                owner = {"id": ow["id"], "username": ow["username"], "email": ow["email"]}
        admin_list = []
        for a in admins:
            u = admin_users.get(a["user_id"])
            if u:
                admin_list.append({"id": u["id"], "username": u["username"], "email": u["email"], "role": a["role"]})
        result.append({
            "id": lg["id"],
            "name": lg["name"],
            "league_type": lg.get("league_type", ""),
            "match_source_type": lg.get("match_source_type", ""),
            "invite_code": lg.get("invite_code"),
            "owner": owner,
            "admins": admin_list,
            "member_count": member_count,
            "created_at": lg.get("created_at"),
            "scoring_config": lg.get("scoring_config", {}),
            "start_matchday": lg.get("start_matchday"),
            "end_matchday": lg.get("end_matchday"),
            "bet_deadline_minutes": lg.get("bet_deadline_minutes"),
            "include_championship_predictions": lg.get("include_championship_predictions", False),
            "rules_locked": lg.get("rules_locked", False),
            "season_id": lg.get("season_id"),
            "status": lg.get("status", "active"),
            "competition_name": lg.get("competition_name", ""),
        })
    return result


@rbac_router.put("/leagues/{league_id}/transfer-owner")
async def transfer_league_owner(league_id: str, request: Request, user=Depends(require_permission("admin.leagues.manage"))):
    """Transfer league ownership to another member."""
    body = await request.json()
    new_owner_id = body.get("new_owner_id")
    if not new_owner_id:
        raise HTTPException(400, "new_owner_id richiesto")

    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    new_owner = await users_col.find_one({"id": new_owner_id}, {"_id": 0, "password": 0})
    if not new_owner:
        raise HTTPException(404, "Nuovo owner non trovato")

    membership = await memberships_col.find_one({"league_id": league_id, "user_id": new_owner_id, "status": "active"})
    if not membership:
        raise HTTPException(400, "Il nuovo owner deve essere membro della lega")

    old_owner_id = league.get("owner_id")

    await leagues_col.update_one({"id": league_id}, {"$set": {"owner_id": new_owner_id}})

    if old_owner_id:
        await memberships_col.update_one(
            {"league_id": league_id, "user_id": old_owner_id, "status": "active"},
            {"$set": {"role": "admin"}}
        )
    await memberships_col.update_one(
        {"league_id": league_id, "user_id": new_owner_id, "status": "active"},
        {"$set": {"role": "owner"}}
    )

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "TRANSFER_OWNER", "league", league_id,
        {"league_name": league["name"], "new_owner": new_owner["username"]},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"owner_id": old_owner_id}, after={"owner_id": new_owner_id}
    )
    return {"league_id": league_id, "new_owner_id": new_owner_id}


@rbac_router.put("/leagues/{league_id}/admins")
async def manage_league_admins(league_id: str, request: Request, user=Depends(require_permission("admin.leagues.manage"))):
    """Add or remove a league admin."""
    body = await request.json()
    target_user_id = body.get("user_id")
    action = body.get("action")
    if not target_user_id or action not in ("add", "remove"):
        raise HTTPException(400, "user_id e action ('add'|'remove') richiesti")

    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    membership = await memberships_col.find_one({"league_id": league_id, "user_id": target_user_id, "status": "active"})
    if not membership:
        raise HTTPException(400, "L'utente deve essere membro della lega")

    if league.get("owner_id") == target_user_id:
        raise HTTPException(400, "Non puoi modificare il ruolo del proprietario. Usa 'Trasferisci Ownership'.")

    new_role = "admin" if action == "add" else "member"
    old_role = membership.get("role", "member")
    await memberships_col.update_one(
        {"league_id": league_id, "user_id": target_user_id, "status": "active"},
        {"$set": {"role": new_role}}
    )

    target = await users_col.find_one({"id": target_user_id}, {"_id": 0, "id": 1, "username": 1})
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], f"LEAGUE_ADMIN_{action.upper()}", "league", league_id,
        {"league_name": league["name"], "target_user": target["username"] if target else target_user_id},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"role": old_role}, after={"role": new_role}
    )
    return {"league_id": league_id, "user_id": target_user_id, "new_role": new_role}


# ========================================
# EDIT LEAGUE RULES (SUPER ADMIN ONLY)
# ========================================
@rbac_router.put("/leagues/{league_id}/rules")
async def edit_league_rules(league_id: str, request: Request, user=Depends(require_permission("admin.leagues.manage"))):
    """Edit league rules. Requires super admin. Strong confirmation via 'confirm' field."""
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo i Super Admin possono modificare le regole della lega")

    body = await request.json()
    if not body.get("confirm"):
        raise HTTPException(400, "Conferma richiesta: invia confirm=true")

    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    allowed_fields = {
        "name", "scoring_config", "start_matchday", "end_matchday",
        "bet_deadline_minutes", "include_championship_predictions",
        "competition_name"
    }

    updates = {}
    before = {}
    for field in allowed_fields:
        if field in body and body[field] is not None:
            before[field] = league.get(field)
            if field == "scoring_config":
                from services import normalize_scoring_config
                updates[field] = normalize_scoring_config(body[field])
            else:
                updates[field] = body[field]

    if "name" in updates:
        new_name = str(updates["name"]).strip()
        if len(new_name) < 2 or len(new_name) > 60:
            raise HTTPException(400, "Il nome della lega deve essere tra 2 e 60 caratteri")
        updates["name"] = new_name

    if not updates:
        raise HTTPException(400, "Nessuna modifica fornita")

    await leagues_col.update_one({"id": league_id}, {"$set": updates})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "EDIT_LEAGUE_RULES", "league", league_id,
        {"league_name": league["name"], "fields": list(updates.keys())},
        actor_roles=user.get("role_ids", []), ip=ip,
        before=before, after=updates
    )
    return {"league_id": league_id, "updates": updates}


@rbac_router.get("/leagues/{league_id}/members")
async def rbac_get_league_members(league_id: str, user=Depends(require_permission("admin.leagues.manage"))):
    """Get all members of a league."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    members = await memberships_col.find(
        {"league_id": league_id, "status": "active"}, {"_id": 0}
    ).to_list(1000)
    user_ids = [m["user_id"] for m in members]
    users_map = {u["id"]: u async for u in users_col.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}
    )}

    result = []
    for m in members:
        u = users_map.get(m["user_id"])
        if u:
            result.append({
                "user_id": u["id"],
                "username": u["username"],
                "email": u["email"],
                "role": m.get("role", "member"),
                "is_owner": league.get("owner_id") == u["id"],
                "joined_at": m.get("joined_at"),
            })
    return result


# ========================================
# ADMIN: CREATE NEW USER
# ========================================
@rbac_router.post("/users/create")
async def admin_create_user(request: Request, user=Depends(require_permission("admin.users.manage"))):
    """Create a new user from the admin panel."""
    import re as _re
    body = await request.json()

    required = ["email", "first_name", "last_name", "date_of_birth", "password"]
    for field in required:
        if not body.get(field):
            raise HTTPException(400, f"Campo obbligatorio mancante: {field}")

    email = body["email"].strip().lower()
    if "@" not in email:
        raise HTTPException(400, "Email non valida")
    existing = await users_col.find_one({"email": email})
    if existing:
        raise HTTPException(409, "Email già registrata")

    username = body.get("username", "").strip()
    if username:
        if not _re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
            raise HTTPException(400, "Username non valido (3-20 caratteri: lettere, numeri, underscore)")
        if await users_col.find_one({"username": username}):
            raise HTTPException(409, "Username già in uso")
    else:
        import random as _rand, string as _str
        base = f"{body['first_name'].lower()}.{body['last_name'].lower()}"
        base = ''.join(c for c in base if c.isalnum() or c == '.')
        username = f"{base}{''.join(_rand.choices(_str.digits, k=3))}"

    try:
        datetime.strptime(body["date_of_birth"], "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Formato data di nascita non valido (YYYY-MM-DD)")

    password = body["password"]
    if len(password) < 8:
        raise HTTPException(400, "La password deve avere almeno 8 caratteri")

    user_id = new_id()
    new_user = {
        "id": user_id,
        "email": email,
        "username": username,
        "first_name": body["first_name"].strip(),
        "last_name": body["last_name"].strip(),
        "date_of_birth": body["date_of_birth"],
        "address": body.get("address", "").strip(),
        "city": body.get("city", "").strip(),
        "country": body.get("country", "Italia").strip(),
        "postal_code": body.get("postal_code", "").strip(),
        "password": hash_password(password),
        "role": "user",
        "language": body.get("language", "it"),
        "accepted_privacy": True,
        "accepted_terms": True,
        "consents_accepted_at": now_utc(),
        "profile_completed": True,
        "email_verified": True,
        "created_at": now_utc(),
        "created_by_admin": user["id"],
    }
    await users_col.insert_one(new_user)

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "ADMIN_CREATE_USER", "user", user_id,
        {"new_username": username, "new_email": email},
        actor_roles=user.get("role_ids", []), ip=ip,
    )
    return {"user_id": user_id, "username": username, "email": email}


# ========================================
# ADMIN: CREATE NEW LEAGUE
# ========================================
@rbac_router.post("/leagues/create")
async def admin_create_league(request: Request, user=Depends(require_permission("admin.leagues.manage"))):
    """Create a new league from the admin panel."""
    body = await request.json()

    name = (body.get("name") or "").strip()
    if len(name) < 3 or len(name) > 40:
        raise HTTPException(400, "Il nome della lega deve essere tra 3 e 40 caratteri")

    season_id = body.get("season_id")
    if not season_id:
        raise HTTPException(400, "season_id obbligatorio")

    season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    if not season:
        raise HTTPException(400, "Stagione non trovata")

    match_source_type = body.get("match_source_type", "national")
    if match_source_type not in ("national", "custom"):
        raise HTTPException(400, "match_source_type deve essere 'national' o 'custom'")

    scoring = body.get("scoring_config") or DEFAULT_SCORING_CONFIG
    # Enforce global scoring points, only respect enabled/disabled per market
    from services import normalize_scoring_config
    scoring = normalize_scoring_config(body.get("scoring_config"))
    start_md = body.get("start_matchday", 1)
    end_md = body.get("end_matchday", 38)
    if end_md < start_md:
        raise HTTPException(400, "La giornata finale deve essere >= giornata iniziale")

    # Validate matchday range against active season progression
    from services import get_league_matchday_range
    first_selectable, last_matchday = await get_league_matchday_range(season_id)
    if start_md < first_selectable:
        raise HTTPException(400, f"La giornata iniziale deve essere >= {first_selectable} (prima giornata ancora giocabile)")
    if end_md > last_matchday:
        raise HTTPException(400, f"La giornata finale deve essere <= {last_matchday} (ultima giornata della stagione)")

    owner_id = body.get("owner_id") or user["id"]
    owner_user = await users_col.find_one({"id": owner_id}, {"_id": 0, "id": 1, "username": 1})
    if not owner_user:
        raise HTTPException(400, "Owner non trovato")

    league_id = new_id()
    invite_code = generate_invite_code()

    league = {
        "id": league_id,
        "name": name,
        "league_type": "private",
        "season_id": season_id,
        "invite_code": invite_code,
        "owner_id": owner_id,
        "created_by": user["id"],
        "logo_url": body.get("logo_url"),
        "start_matchday": start_md,
        "end_matchday": end_md,
        "bet_deadline_minutes": body.get("bet_deadline_minutes", 5),
        "match_source_type": match_source_type,
        "scoring_config": scoring,
        "include_championship_predictions": body.get("include_championship_predictions", False),
        "status": "active",
        "rules_locked": False,
        "created_at": now_utc(),
    }

    if match_source_type == "national":
        national = await leagues_col.find_one({"league_type": "national"}, {"_id": 0, "id": 1})
        if national:
            league["source_league_id"] = national["id"]

    await leagues_col.insert_one(league)

    await memberships_col.insert_one({
        "id": new_id(),
        "user_id": owner_id,
        "league_id": league_id,
        "role": "owner",
        "status": "active",
        "joined_at": now_utc(),
    })

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "ADMIN_CREATE_LEAGUE", "league", league_id,
        {"name": name, "owner_id": owner_id, "match_source_type": match_source_type},
        actor_roles=user.get("role_ids", []), ip=ip,
    )
    league.pop("_id", None)
    return {"league_id": league_id, "name": name, "invite_code": invite_code}


# ========================================
# EDIT USER DETAILS (ADMIN)
# ========================================
@rbac_router.put("/users/{user_id}")
async def edit_user_details(user_id: str, request: Request, user=Depends(require_permission("admin.users.manage"))):
    """Edit a user's username and/or email (admin action)."""
    import re as _re
    body = await request.json()
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    updates = {}
    if "username" in body and body["username"]:
        new_username = body["username"].strip()
        if not _re.match(r'^[a-zA-Z0-9_]{3,20}$', new_username):
            raise HTTPException(400, "Username non valido (3-20 caratteri: lettere, numeri, underscore)")
        existing = await users_col.find_one({"username": new_username, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(409, "Username già in uso")
        updates["username"] = new_username

    if "email" in body and body["email"]:
        new_email = body["email"].strip().lower()
        if "@" not in new_email:
            raise HTTPException(400, "Email non valida")
        existing = await users_col.find_one({"email": new_email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(409, "Email già in uso")
        updates["email"] = new_email

    if not updates:
        raise HTTPException(400, "Nessun aggiornamento fornito")

    before = {k: target.get(k) for k in updates}
    await users_col.update_one({"id": user_id}, {"$set": updates})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "EDIT_USER", "user", user_id,
        {"target_username": target["username"], "updates": list(updates.keys())},
        actor_roles=user.get("role_ids", []), ip=ip,
        before=before, after=updates
    )
    return {"user_id": user_id, "updates": updates}


# ========================================
# USER AUDIT LOG
# ========================================
@rbac_router.get("/users/{user_id}/audit-log")
async def get_user_audit_log(user_id: str, limit: int = 30, user=Depends(require_permission("admin.audit.view"))):
    """Get audit log entries related to a specific user."""
    logs = await audit_logs_col.find(
        {"$or": [{"admin_id": user_id}, {"entity_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return logs


# ========================================
# PASSWORD RESET LINK GENERATION
# ========================================
@rbac_router.post("/users/{user_id}/reset-password-link")
async def generate_reset_password_link(user_id: str, request: Request, user=Depends(require_permission("admin.users.manage"))):
    """Generate a secure, time-limited password reset link for a user."""
    import secrets
    import hashlib

    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    if target.get("auth_provider") == "google":
        raise HTTPException(400, "Non è possibile resettare la password di un utente Google")

    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    await password_resets_col.update_many(
        {"user_id": user_id, "used": False},
        {"$set": {"used": True}}
    )

    await password_resets_col.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "token_hash": token_hash,
        "expires_at": expires_at,
        "used": False,
        "created_by": user["id"],
        "created_at": now_utc(),
    })

    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("host", "localhost")
    reset_url = f"{proto}://{host}/api/reset-password?token={raw_token}"

    # Send email via SendGrid (non-blocking)
    from email_service import send_password_reset_email
    await send_password_reset_email(target["email"], reset_url, target.get("username", ""))

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "GENERATE_RESET_LINK", "user", user_id,
        {"target_username": target["username"], "expires_at": expires_at},
        actor_roles=user.get("role_ids", []), ip=ip,
    )

    return {"reset_url": reset_url, "expires_at": expires_at, "user_email": target["email"]}
