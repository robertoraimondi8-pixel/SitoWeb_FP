# FantaPronostic - Product Requirements Document

## Original Problem Statement
Fantasy football predictions app where users join leagues, make match predictions, and compete on leaderboards. Built with React Native (Expo) frontend + FastAPI backend + MongoDB.

## Core Architecture
- **Backend**: FastAPI monolith (`/app/backend/server.py`) with MongoDB
- **Frontend**: React Native (Expo) at `/app/frontend/`
- **Database**: MongoDB (fantapronostic)
- **External APIs**: API-Football (API-Sports), Emergent Google Auth

## Data Isolation Model (NON-NEGOTIABLE)
Every league is an independent universe. All data must be strictly scoped by league_id.

### Predictions: unique per `(user_id, match_id, league_id)`
- A user can have DIFFERENT predictions for the same match in different leagues
- Compound unique index: `user_match_league_unique`
- All prediction queries MUST include league_id filter
- POST /api/predictions requires league_id (422 if missing), validates membership (403 if non-member)

### Score Summaries: unique per `(user_id, matchday_id, league_id)`
- Points are calculated per league
- Compound unique index: `user_matchday_league_unique`
- All score_summaries queries MUST include league_id filter
- Admin recalculation groups by (user_id, league_id) when creating summaries

### Why (Product Rationale)
1. Leagues have different rules/multipliers (e.g., X3 special match in one league but not another)
2. Future: leagues can have different pricing (paid national, free private)
3. Auditability: each prediction is deterministically traceable to its league
4. Scalability: clean multi-tenancy prevents data corruption at any scale

## What's Been Implemented
- User auth (JWT + Google OAuth)
- League creation, joining, management
- Match predictions with multiple market types
- Live scoring and match status updates
- Standings (total, weekly, user profile)
- Admin panel for matchday management
- API-Football integration
- **FULL multi-league data isolation (Feb 22, 2026)**

## Bug Fixes Applied

### P0 - League Data Isolation (Feb 22, 2026) - COMPLETED
Enforced `league_id` on all score_summaries queries. 16/16 backend tests passed.

### P0 - Multi-League Predictions Architecture (Feb 22, 2026) - COMPLETED
**Migration**: Changed predictions from `(user_id, match_id)` unique to `(user_id, match_id, league_id)`. Score summaries from `(user_id, matchday_id)` to `(user_id, matchday_id, league_id)`.

**Changes applied**:
- database.py: New compound unique indexes
- server.py: ALL prediction queries updated to filter by league_id
- save_predictions: lookup/upsert by (user_id, match_id, league_id)
- compute_matchday_points: predictions filtered by league_id
- home, live, standings, transparency endpoints: all prediction queries scoped
- Admin recalculation: groups predictions by (user_id, league_id)
- Server-side validation: league_id required (422), membership check (403)

**Testing**: 13/13 tests passed (iteration_35). Full cross-league isolation verified.

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
