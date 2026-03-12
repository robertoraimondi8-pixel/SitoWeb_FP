"""FantaPronostic Backend - Main FastAPI Application.

Thin application hub: creates the FastAPI app, includes all modular routers,
and manages startup/shutdown lifecycle events.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import asyncio
from datetime import datetime, timezone

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import create_indexes, matches_col, users_col, password_resets_col
from auth import hash_password
from services import bootstrap_rbac
import services as _svc

# Import routers from modular route files
from routes.auth import auth_router
from routes.user import user_router, news_router, reminder_scheduler_loop
from routes.leagues import league_router
from routes.predictions import prediction_router
from routes.standings import standings_router
from routes.live import live_router
from routes.payments import payment_router
from routes.admin import admin_router
from routes.fixtures import fixtures_router, live_fixtures_loop
from routes.stats import stats_router
from routes.rbac import rbac_router
from routes.tournaments import tournament_router
from routes.champion_picks import champion_router
from routes.trophies import trophy_router

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="FantaPronostic API", version="2.1.0")

_cors_origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# INCLUDE ALL ROUTERS
# ========================================
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(league_router)
app.include_router(prediction_router)
app.include_router(standings_router)
app.include_router(live_router)
app.include_router(payment_router)
app.include_router(admin_router)
app.include_router(fixtures_router)
app.include_router(stats_router)
app.include_router(news_router)
app.include_router(rbac_router)
app.include_router(tournament_router)
app.include_router(champion_router)
app.include_router(trophy_router)


# ========================================
# LIFECYCLE EVENTS
# ========================================
_live_task = None
_reminder_task = None


@app.on_event("startup")
async def startup():
    global _live_task, _reminder_task
    await create_indexes()
    await matches_col.create_index("external_fixture_id", sparse=True)
    await bootstrap_rbac()
    _live_task = asyncio.create_task(live_fixtures_loop())
    _reminder_task = asyncio.create_task(reminder_scheduler_loop())
    logger.info("FantaPronostic API started - indexes created - RBAC bootstrapped - live refresh started")


@app.on_event("shutdown")
async def shutdown():
    global _live_task, _reminder_task
    if _live_task:
        _live_task.cancel()
        try:
            await _live_task
        except asyncio.CancelledError:
            pass
    if _reminder_task:
        _reminder_task.cancel()
        try:
            await _reminder_task
        except asyncio.CancelledError:
            pass
    if _svc._apifootball_client:
        await _svc._apifootball_client.close()
    from database import client
    client.close()


# ========================================
# APP-LEVEL ROUTES
# ========================================
@app.get("/api")
async def api_root():
    return {"message": "FantaPronostic API v2.1", "status": "running"}


@app.post("/api/seed")
async def seed_data():
    """Seed demo data for development."""
    from seed import run_seed
    return await run_seed()


@app.get("/api/admin-ui", response_class=HTMLResponse)
@app.get("/api/admin-ui/{path:path}", response_class=HTMLResponse)
async def admin_dashboard(path: str = ""):
    from admin_ui import get_admin_html
    return HTMLResponse(
        content=get_admin_html(),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/api/reset-password", response_class=HTMLResponse)
async def reset_password_page(token: str = ""):
    """Public page for resetting a password via token."""
    from admin_ui import get_reset_password_html
    return get_reset_password_html()


@app.post("/api/reset-password")
async def reset_password_submit(request: Request):
    """Submit a new password using the reset token."""
    import hashlib

    body = await request.json()
    raw_token = body.get("token")
    new_password = body.get("new_password")

    if not raw_token or not new_password:
        raise HTTPException(400, "Token e nuova password sono richiesti")

    if len(new_password) < 6:
        raise HTTPException(400, "La password deve avere almeno 6 caratteri")

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    reset_doc = await password_resets_col.find_one({
        "token_hash": token_hash,
        "used": False,
    }, {"_id": 0})

    if not reset_doc:
        raise HTTPException(400, "Token non valido o già utilizzato")

    expires_at = reset_doc.get("expires_at", "")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(400, "Token scaduto")
        except ValueError:
            pass

    hashed = hash_password(new_password)
    await users_col.update_one({"id": reset_doc["user_id"]}, {"$set": {"password": hashed}})

    await password_resets_col.update_one({"id": reset_doc["id"]}, {"$set": {"used": True}})

    return {"message": "Password aggiornata con successo"}
