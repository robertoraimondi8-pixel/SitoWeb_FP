# FantaPronostic - PRD (Product Requirements Document)

## Overview
FantaPronostic is a football prediction platform mobile app built with Expo React Native (frontend) and FastAPI + MongoDB (backend).

## Architecture
- **Frontend**: Expo React Native with TypeScript, expo-router, i18n (IT/EN), Zustand
- **Backend**: FastAPI (Python) with MongoDB, JWT auth
- **Admin Console v3**: Unified admin console at `/admin` — replaces old separate national/private admin consoles

## Features Implemented

### 1. Authentication
- Email + Password (register/login)
- Google OAuth via Emergent Auth
- JWT access + refresh tokens
- Role-based access: user / admin / superadmin
- Password show/hide, forgot password, register link

### 2. Home Hub
- Dynamic matchday card (OPEN/LOCKED/LIVE/COMPLETED)
- Countdown to first_kickoff
- CTA for predictions or live view
- Rankings preview, user leagues, statistics

### 3. Predictions
- Max 10 matches per matchday
- User chooses market type per match (1X2=1pt, GOAL_NOGOL=0.5pt, OVER_UNDER=0.5pt, EXACT_SCORE=4pt)
- Lock per match at start_time
- Batch save with per-match error reporting

### 4. Joker System
- 1 Joker per matchday, doubles points for chosen match
- Joker_active flag per matchday per user

### 5. Scoring Engine
- Automatic calculation on matchday COMPLETED
- score_summaries per user per matchday per league
- Standing recalculation across all matchdays

### 6. League System
- Private leagues with invite codes
- National league (uses NATIONAL_LEAGUE_ID constant)
- Strict data isolation via mandatory league_id on all entities
- League creation, join, leave

### 7. Admin Console v3 (NEW - Feb 2026)
**Unified console replacing old separate national/private admin pages.**

**Bug Fix (21 Feb)**: `Alert.alert` callback-based confirmation on React Native Web never resolves Promise, blocking all transition actions. Fixed by using React Native `Modal` for feedback and removing pre-confirmation dialogs.

#### Backend Endpoints:
- `GET /api/admin/v3/leagues` — Role-based league listing (SUPER_ADMIN sees all + national, LEAGUE_ADMIN sees owned only)
- `GET /api/admin/v3/matchdays?league_id=X` — Enriched matchdays with match_count, results_count, predictions_user_count, auto-lock check
- `POST /api/admin/matchday/{id}/transition` — Unified state transition (DRAFT→OPEN→LOCKED→LIVE→COMPLETED) with validations
- `POST /api/admin/matchday/{id}/recalculate` — SUPER_ADMIN only, recalculates scores for COMPLETED matchdays

#### Frontend Features:
- League selector header (National always on top, private leagues below)
- Matchday section with stats (partite, risultati, pronostici)
- Guided state flow indicator (BOZZA→APERTA→BLOCCATA→LIVE→COMPLETATA)
- Context-sensitive transition buttons (no free status dropdown)
- Inline result entry with progress bar
- Role-based permissions (SUPER_ADMIN vs LEAGUE_ADMIN)
- Ricalcola Giornata button (SUPER_ADMIN only on COMPLETED)
- Match CRUD (create/delete with max 10 validation)
- All UI labels in Italian

#### Validations:
- Cannot open matchday with 0 matches
- Cannot add more than 10 matches
- Cannot complete without all results inserted
- Cannot modify matches after LOCKED
- Cannot modify anything after COMPLETED (except recalc for SUPER_ADMIN)
- Cannot skip or go backwards in state flow

### 8. Data Model (Hardened)
- All entities (matches, matchdays, predictions, score_summaries) have mandatory `league_id`
- NATIONAL_LEAGUE_ID = `f1373417-43aa-4043-b6a2-125873181c95`
- No $or/$exists fallbacks — all queries explicit

### 9. Expo Web Preview
- Expo runs in `--web` mode (not tunnel) for K8s compatibility
- Accessible via `https://matchday-state-flow.preview.emergentagent.com`

## P0 Backlog
- (none)

## P1 Backlog
- Fix redundant settings/gear icon in home header
- Fix linter parsing errors in frontend

## P2 Backlog
- Full E2E test of complete flow
- Implement "Championship Winner Predictions" feature
- Integrate Stripe for joining National League
- Re-enable email verification
- Implement Push Notifications
- Integrate live sports data API
- Refactor server.py into modular routes

## Credentials
- SUPER_ADMIN: admin@fantapronostic.com / admin123
- LEAGUE_OWNER (National): desiree@raimondi.it / Roberto95
- LEAGUE_OWNER (Manual): ilio@raimondi.it / password123

## Key Files
- `/app/backend/server.py` — Main backend (includes Admin v3 endpoints)
- `/app/frontend/app/admin/index.tsx` — Admin Console v3 (unified)
- `/app/frontend/app/admin/league.tsx` — Old league admin (deprecated, replaced by v3)
- `/app/frontend/app/(tabs)/profile.tsx` — Profile with admin console navigation
- `/app/backend/tests/test_admin_v3_console.py` — Admin v3 test suite
