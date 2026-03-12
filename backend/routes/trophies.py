"""Trophy API routes."""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from auth import get_current_user
from trophies import get_user_trophies

trophy_router = APIRouter(prefix="/api/trophies", tags=["Trophies"])


@trophy_router.get("/my")
async def get_my_trophies(user=Depends(get_current_user)):
    """Get current user's trophies."""
    return await get_user_trophies(user["id"])


@trophy_router.get("/user/{user_id}")
async def get_user_trophies_api(user_id: str, user=Depends(get_current_user)):
    """Get any user's trophies (public)."""
    return await get_user_trophies(user_id)
