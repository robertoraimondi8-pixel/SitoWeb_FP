"""RBAC Permission system for FantaPronostic."""
from fastapi import Depends, HTTPException
from auth import get_current_user


# All available permissions - key: permission string, value: description
ALL_PERMISSIONS = {
    "admin.dashboard.view": "Accesso al pannello admin",
    "admin.seasons.manage": "Gestione stagioni",
    "admin.matchdays.manage": "Gestione giornate",
    "admin.matches.manage": "Gestione partite",
    "admin.leagues.manage": "Gestione leghe",
    "admin.users.manage": "Gestione utenti",
    "admin.roles.manage": "Gestione ruoli e permessi",
    "admin.payments.view": "Visualizzazione pagamenti",
    "admin.audit.view": "Visualizzazione audit log",
    "admin.news.manage": "Gestione news",
    "admin.notifications.manage": "Gestione notifiche",
    "admin.tournaments.manage": "Gestione tornei",
    "admin.impersonate": "Impersonare utenti",
}

# Default role templates for bootstrapping
DEFAULT_ROLES = {
    "super_admin": {
        "name": "Super Admin",
        "description": "Accesso completo a tutto il sistema",
        "permissions": list(ALL_PERMISSIONS.keys()),
    },
    "moderator": {
        "name": "Moderatore",
        "description": "Gestione contenuti e utenti",
        "permissions": [
            "admin.dashboard.view",
            "admin.users.manage",
            "admin.news.manage",
            "admin.notifications.manage",
            "admin.audit.view",
        ],
    },
    "league_manager": {
        "name": "Gestore Leghe",
        "description": "Gestione leghe, giornate e partite",
        "permissions": [
            "admin.dashboard.view",
            "admin.seasons.manage",
            "admin.matchdays.manage",
            "admin.matches.manage",
            "admin.leagues.manage",
            "admin.tournaments.manage",
        ],
    },
    "viewer": {
        "name": "Osservatore",
        "description": "Solo visualizzazione pannello admin",
        "permissions": [
            "admin.dashboard.view",
            "admin.audit.view",
            "admin.payments.view",
        ],
    },
}


def require_permission(*perms: str):
    """Factory that creates a FastAPI dependency checking for specific permissions.

    Usage:
        @router.get("/endpoint")
        async def my_endpoint(user=Depends(require_permission("admin.users.manage"))):
            ...
    """
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        # Super admin bypasses all permission checks
        if user.get("is_super_admin"):
            return user

        # Fetch user's roles and aggregate permissions
        from database import roles_col
        role_ids = user.get("role_ids", [])
        if not role_ids:
            raise HTTPException(403, "Permesso negato: nessun ruolo assegnato")

        roles = await roles_col.find(
            {"id": {"$in": role_ids}},
            {"_id": 0, "permissions": 1}
        ).to_list(100)

        user_perms = set()
        for role in roles:
            user_perms.update(role.get("permissions", []))

        for p in perms:
            if p not in user_perms:
                raise HTTPException(403, f"Permesso richiesto: {p}")

        return user

    return _check


async def get_user_permissions(user: dict) -> list:
    """Get all permissions for a user (aggregated from their roles)."""
    if user.get("is_super_admin"):
        return list(ALL_PERMISSIONS.keys())

    from database import roles_col
    role_ids = user.get("role_ids", [])
    if not role_ids:
        return []

    roles = await roles_col.find(
        {"id": {"$in": role_ids}},
        {"_id": 0, "permissions": 1}
    ).to_list(100)

    perms = set()
    for role in roles:
        perms.update(role.get("permissions", []))
    return sorted(perms)
