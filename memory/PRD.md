# FantaPronostic - Product Requirements Document

## Original Problem Statement
Fantasy football predictions app where users join leagues, make match predictions, and compete on leaderboards. Built with React Native (Expo) frontend + FastAPI backend + MongoDB.

## Core Architecture
- **Backend**: FastAPI monolith (`/app/backend/server.py`) with MongoDB
- **Frontend**: React Native (Expo) at `/app/frontend/`
- **Database**: MongoDB (fantapronostic)
- **External APIs**: API-Football (API-Sports), Emergent Google Auth

## Data Isolation Model (CRITICAL)
Two distinct isolation boundaries:
1. **score_summaries** → ALWAYS filtered by `league_id` (points/standings are per-league)
2. **predictions** → NEVER filtered by `league_id` for retrieval (predictions are per user+match, shared across leagues)

The `league_id` on predictions is tracking metadata (which league context the user saved from), NOT an isolation boundary. Score summaries hold the league-specific scoring.

## What's Been Implemented
- User auth (JWT + Google OAuth)
- League creation, joining, management
- Match predictions with multiple market types
- Live scoring and match status updates
- Standings (total, weekly, user profile)
- Admin panel for matchday management
- API-Football integration

## Bug Fixes Applied

### P0 - League Data Isolation (Feb 22, 2026) - COMPLETED
Enforced `league_id` on all score_summaries queries. 16/16 backend tests passed.

### P0 - Predictions "Spariti" su Matchday LIVE (Feb 22, 2026) - COMPLETED
**Root Cause**: Previous league isolation fix applied `league_id` filter too aggressively on predictions queries. When user saved predictions from "Lega Nazionale" but viewed live from "Lega Amici", predictions disappeared because the `league_id` didn't match.

**Fix**: Removed `league_id` filter from ALL prediction retrieval endpoints (live, home, GET predictions, transparency). Predictions are per user+match and should always be visible regardless of league context. Score_summaries retain strict league_id isolation for standings/rankings.

**Endpoints fixed**:
- `GET /api/live/{matchday_id}` — predictions visible regardless of league context
- `GET /api/live/matchday/{matchday_id}` — same fix
- `GET /api/home` — predictions count and live data no longer filtered by league_id
- `GET /api/predictions/{matchday_id}` — user's own predictions always visible
- `/api/predictions/user/{target_user_id}/{matchday_id}` — transparency view
- `compute_matchday_points()` — predictions fetched without league_id filter

## Prioritized Backlog

### P1
- Remove legacy "Jolly" feature from codebase and database

### P2
- Implement "Championship Winner Predictions" feature
- Integrate Stripe for joining National League
- Re-enable email verification
- Implement Push Notifications

### P3
- Refactor monolithic server.py into modular architecture

## Credentials
- Admin: admin@fantapronostic.com / admin123
- User 1 (Desylega): desiree@raimondi.it / Roberto95
- User 2 (liga2): ilio@raimondi.it / password123
- NATIONAL_LEAGUE_ID: f1373417-43aa-4043-b6a2-125873181c95
