# FantaPronostic - PRD & Progress

## Original Problem Statement
Build an admin panel and a React Native mobile app for FantaPronostic, a fantasy football predictions platform. The app has evolved into a premium UI/UX product with an official **Brand Color System v5**.

## Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py              # Thin hub (~182 lines) - app factory, router includes, lifecycle
├── services.py            # Shared business logic (~533 lines)
├── database.py            # MongoDB collections
├── auth.py                # JWT auth, password hashing
├── models.py              # Pydantic models
├── scoring.py             # Match scoring logic
├── permissions.py         # RBAC permissions
├── apifootball.py         # API-Football client
├── admin_ui.py            # Admin dashboard HTML
├── seed.py                # Dev seed data
└── routes/
    ├── auth.py            # Register, login, refresh, verify, Google OAuth
    ├── user.py            # Profile, home, notifications, push tokens, news
    ├── leagues.py         # CRUD, join, fixtures, matchdays, matches
    ├── predictions.py     # Get/save/confirm predictions, transparency
    ├── standings.py       # Total, weekly, matchdays, user standings
    ├── live.py            # Live matchday data
    ├── payments.py        # Stripe checkout and status
    ├── admin.py           # Seasons, matchdays, matches, leagues mgmt, v3 console
    ├── fixtures.py        # API-Football import, live refresh loop
    ├── stats.py           # API-Football public data (standings, results, preview)
    └── rbac.py            # Permissions, roles, users/leagues management
```

### Frontend (React Native / Expo)
- Theme: `frontend/src/theme/designSystem.ts` (Brand Color System v5)
- Screens, components, etc.

## Completed Work

### Backend Refactoring (P0) - COMPLETED 2026-03-10
- **Before**: Monolithic server.py with 5,410 lines
- **After**: server.py reduced to 182 lines (97% reduction)
- 12 modular route files created under `backend/routes/`
- Shared business logic in `services.py` (533 lines)
- Full regression test: 29 pytest tests + 15 curl verifications = 100% pass rate
- No bugs introduced during refactoring

### CORS Hardening (P1) - COMPLETED 2026-03-10
- CORS reads allowed origins from `CORS_ORIGINS` env var
- Explicit allowlist: preview domain + fantapronostic.com
- Unauthorized origins blocked

### Terms & Privacy Pages - COMPLETED 2026-03-10
- Created `/menu/terms` screen with full Termini di Servizio text (9 sections)
- Created `/menu/privacy` screen with full Privacy Policy text (9 sections)
- Made links clickable in: login footer, register checkboxes, complete-profile checkboxes
- Added "LEGALE" section in SideMenu with Terms and Privacy links

### Push Notifications - COMPLETED 2026-03-10
- Activated `PUSH_NOTIFICATIONS_ENABLED=true` in backend .env
- Added admin broadcast endpoint: `POST /api/admin/push/broadcast` (all users or specific league)
- Added admin single-user push: `POST /api/admin/push/user/{user_id}`
- Added "Push Notifiche" page in admin panel with broadcast and single-user forms
- Test: 15/15 passed

### Google Login Complete Profile - COMPLETED 2026-03-10
- Added username field (optional) to complete-profile page
- Fixed endpoint mismatch: added dual endpoint `POST /api/users/me/complete-profile` alongside `PATCH /api/profile/complete`
- Redesigned page with brand colors, BrandLogo wordmark (no white bg), gradient accent button
- Username validation: 3-20 chars, regex, duplicate check

### National League Free - COMPLETED 2026-03-10
- Removed payment requirement for joining national league
- Users can now join directly without Stripe payment

### SendGrid Email Integration - COMPLETED 2026-03-10
- Created `email_service.py` with SendGrid integration for password reset emails
- Integrated into RBAC reset-password-link generation
- Graceful fallback when API key is empty (logs warning, doesn't fail)
- **NOTE**: SENDGRID_API_KEY must be configured for emails to actually send

### Previous Work
- Brand Color System v5 applied across entire frontend
- Comprehensive developer documentation (docs/ directory)
- Admin panel with RBAC permissions system
- API-Football integration for live match data
- Push notification infrastructure (disabled pending config)
- Scoring engine with jolly/joker system

## Pending Issues

### P1 - Team Name Overlap Bug
- **Status**: USER VERIFICATION PENDING
- Long team names in prediction lists may overlap with match result
- A flexbox fix was implemented, needs user verification

## Completed - CORS Hardening (P1) - 2026-03-10
- CORS now reads allowed origins from `CORS_ORIGINS` env var in backend/.env
- Explicit allowlist: preview domain + fantapronostic.com
- Falls back to `["*"]` only if env var is empty (dev convenience)
- Verified: unauthorized origins are blocked

## Upcoming Tasks (P1)
- Activate Push Notifications (`PUSH_NOTIFICATIONS_ENABLED=True`)
- Integrate email service for password resets

### Jolly Dead Code Removal (Frontend) - COMPLETED 2026-03-10
- Removed all unused "jolly" references from frontend TypeScript code
- Files cleaned: `user-detail.tsx` (removed `jolly_used` from interface), `src/types/api.ts` (removed `jolly_used`, `jolly_active` from StandingEntry)
- Backend jolly/joker logic intentionally preserved (active feature)
- Zero frontend "jolly" references remaining (verified via grep)

## Future Tasks (P2)
- Add test dependencies (`requests`, `pytest`) to requirements.txt
- Improve error handling (specific exceptions, structured logging)
- Design "Achievements/Badges" system
- Implement "Championship Winner Predictions"
- Integrate Stripe for National League

## 3rd Party Integrations
- API-Football (API-Sports) - for live match data
- Expo Push - for mobile notifications
- Stripe - payment processing (in backlog)
- Emergent-managed Google Auth

## Test Credentials
- **Standard User**: ilio@raimondi.it / password123
- **Admin**: admin@fantapronostic.com / admin123
- **League Owner**: test@raimondi.it / password
