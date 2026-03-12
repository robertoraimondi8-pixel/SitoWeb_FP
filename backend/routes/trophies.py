"""Trophy API routes."""
from fastapi import APIRouter, Depends
import logging
from auth import get_current_user
from trophies import get_user_trophies, award_weekly_trophies
from database import matchdays_col, leagues_col, memberships_col

logger = logging.getLogger(__name__)

trophy_router = APIRouter(prefix="/api/trophies", tags=["Trophies"])


@trophy_router.get("/my")
async def get_my_trophies(user=Depends(get_current_user)):
    """Get current user's trophies."""
    return await get_user_trophies(user["id"])


@trophy_router.get("/user/{user_id}")
async def get_user_trophies_api(user_id: str, user=Depends(get_current_user)):
    """Get any user's trophies (public)."""
    return await get_user_trophies(user_id)


@trophy_router.post("/backfill")
async def backfill_trophies(user=Depends(get_current_user)):
    """Retroactively award trophies for all completed matchdays. Admin only."""
    if not user.get("is_super_admin"):
        from fastapi import HTTPException
        raise HTTPException(403, "Solo il Super Admin")

    # Get all leagues with active members
    leagues = await leagues_col.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    total_awarded = 0

    for league in leagues:
        league_id = league["id"]
        # Get completed matchdays for this league's season
        completed = await matchdays_col.find(
            {"status": "COMPLETED"},
            {"_id": 0, "id": 1, "number": 1, "league_id": 1}
        ).to_list(200)

        for md in completed:
            try:
                count = await award_weekly_trophies(md["id"], league_id)
                if count:
                    total_awarded += 1
            except Exception as e:
                logger.warning(f"[BACKFILL] Error for md {md['id']} league {league_id}: {e}")

    logger.info(f"[BACKFILL] Processed all leagues, awarded trophies in {total_awarded} matchday+league combos")
    return {"status": "ok", "processed": total_awarded}
