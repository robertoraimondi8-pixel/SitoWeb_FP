# FantaPronostic - Product Requirements Document

## Original Problem Statement
Build and maintain FantaPronostic, an Italian sports prediction app with league management, real-time match tracking, and automated matchday lifecycle. The platform uses Expo/React Native (web + mobile), FastAPI backend, and MongoDB.

## Core Requirements
1. **League System**: National league + private leagues (manual/custom/national source types)
2. **Prediction System**: Users predict match outcomes, earn points based on accuracy
3. **Matchday Lifecycle**: Automated state machine driven by real match kickoff times
4. **Admin Console**: Unified admin for managing leagues, matchdays, matches, and scores
5. **Live Data Integration**: API-Football for real-time match data
6. **Authentication**: Google OAuth + email/password via JWT

## Architecture
- **Frontend**: Expo/React Native Web (port 3000)
- **Backend**: FastAPI (port 8001, proxied via /api)
- **Database**: MongoDB (local)
- **Auth**: JWT + Emergent Google Auth
- **External APIs**: API-Football (API-Sports)

## Key Credentials
- Super Admin: admin@fantapronostic.com / admin123
- League Owner: ilio@raimondi.it / password123
- National League Owner: desiree@raimondi.it / Roberto95

## Completed Features

### P0: Data Leakage Fix (COMPLETED)
- Fixed `/api/home` endpoint - added `league_id` filters to predictions and score_summaries queries

### P0: State Sync Fix (COMPLETED)
- Refactored Home and Rankings screens to use global `LeagueContext`

### Feature: Home Screen Gamification (COMPLETED)
- Dynamic cards for matchday status, user performance, bar chart for recent results

### Feature: Smart Predictions Tab (COMPLETED)
- Auto-redirect to correct screen based on matchday status

### Bug Fix: Navigation Loop (COMPLETED)
- Fixed back button infinite redirect using router.replace

### Feature: Kickoff-Driven Matchday State Machine (COMPLETED - Feb 22, 2026)
- **Backend**:
  - `compute_matchday_status()` auto-computes effective status based on match data
  - `VALID_TRANSITIONS`: Only DRAFT→OPEN is manual; OPEN→LIVE and LIVE→COMPLETED are automatic
  - `POST /api/admin/matchday/{id}/transition`: Manual DRAFT→OPEN publish
  - `POST /api/admin/matchday/{id}/override`: SUPER_ADMIN force any status
  - Removed LOCKED state from the flow
  - Auto-compute `first_kickoff` from earliest match when publishing
- **Frontend Admin Console**:
  - Removed date/time picker from matchday creation (auto-computed from matches)
  - State flow: BOZZA → APERTA → LIVE → COMPLETATA (no BLOCCATA)
  - "Pubblica Giornata" button for DRAFT matchdays
  - Auto-status info banners (countdown to LIVE, progress to COMPLETED)
  - SUPER_ADMIN Override modal for emergency status changes
  - Delete only available for DRAFT matchdays

### Feature: Partita Speciale X3 (COMPLETED - Feb 22, 2026)
- Admin can designate one match per matchday as "special" with a 3x score multiplier
- Backend: `PUT /api/admin/matches/{match_id}/special`, updated scoring logic
- Frontend: Admin UI for setting special match, user predictions show special badge

### P0 Bug Fix: Match Import Clarity (COMPLETED - Feb 22, 2026)
- Import now returns `skipped_details` with existing matchday name and match teams when fixtures are already imported
- Frontend displays clear message: "X già presenti in [matchday name]"

### P0 Bug Fix: Predictions Disappear on LIVE/COMPLETED (COMPLETED - Feb 22, 2026)
- Removed incorrect `league_id` filter from live endpoint prediction query
- Predictions now correctly visible regardless of matchday status

### P0 Bug Fix: Home Screen Stale Data (COMPLETED - Feb 22, 2026)
- Root cause: National league completed matchday discovery queried predictions (inconsistent league_ids) instead of matchdays collection
- Fix: Query matchdays directly with `NATIONAL_LEAGUE_ID` for completed matchdays
- Fix: Use `score_summaries` for user matchdays_played count instead of predictions

### P0 Bug Fix Sprint 2 — LIVE Scoring & X3 Visibility (COMPLETED - Feb 22, 2026)
- **P0-1 LIVE scoring**: Removed `league_id` filter from prediction queries in `/api/home` (my_predictions_count, LIVE section). Added `multiplier` param to all `calculate_match_points` calls in home LIVE, live endpoint, and legacy live endpoint.
- **P0-2 Giornata 16 cleanup**: Deleted test G16 matchday + all associated matches/predictions/scores from DB.
- **P0-3 X3 badge visibility**: Added `is_special`/`multiplier` to `MatchItem` TypeScript type, `LiveMatch` type, and live endpoint response payload. Frontend already had X3 badge rendering code, now receives the data correctly.
- **X3 badge in Live screen**: Added orange X3 badge and special border for special matches in live view.

## Backlog (Prioritized)

### P1
- Remove legacy "Jolly" feature from codebase and database
- Implement "Championship Winner Predictions" Feature
- Integrate Stripe for joining the National League

### P2
- Re-enable email verification
- Implement Push Notifications

### Known Issues
- Expo Go Tunnel: Non-functional (platform issue, use web preview)
