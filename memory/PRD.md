# FantaPronostic - Product Requirements Document

## Original Problem Statement
Fantasy football predictions app (FantaPronostic) where users join leagues, make match predictions, and compete on leaderboards. Built with React Native (Expo) frontend + FastAPI backend + MongoDB.

## Core Architecture
- **Backend**: FastAPI monolith (`/app/backend/server.py`) with MongoDB
- **Frontend**: React Native (Expo) at `/app/frontend/`
- **Database**: MongoDB (fantapronostic)
- **External APIs**: API-Football (API-Sports), Emergent Google Auth

## Key Data Model
- `users`, `leagues`, `memberships` (user-league association)
- `seasons`, `matchdays`, `matches` (match data)
- `predictions` (user predictions with league_id)
- `score_summaries` (cached points per user+matchday+league_id)
- `standings_cache` (total standings per user+league_id)

## What's Been Implemented
- User auth (JWT + Google OAuth)
- League creation, joining, management
- Match predictions with multiple market types (1X2, GOAL/NOGOL, etc.)
- Live scoring and match status updates
- Standings (total, weekly, user profile)
- Admin panel for matchday management
- API-Football integration for real fixtures

## P0 Bug Fix - League Data Isolation (Feb 22, 2026) - COMPLETED
**Problem**: Data (points, standings, matchdays) was being mixed between different leagues, breaking core principle of league isolation.

**Root Cause**: Multiple database queries across the application lacked `league_id` filtering, causing cross-league data contamination.

**Fixes Applied**:
1. `compute_matchday_points()` - Added `league_id` parameter, filter on score_summaries and predictions
2. `/api/home` - All queries already had league_id (verified)
3. `/api/standings/total` - Fixed `current_week_points` query to filter by league_id
4. `/api/standings/weekly/{matchday_id}` - Already had league_id filter (verified)
5. `/api/standings/user/{target_user_id}` - Fixed 4 queries: total points aggregation, current score, ranking pipeline, matchday breakdown
6. `/api/standings/matchdays` - Already had league_id filter (verified)
7. `GET /api/predictions/{matchday_id}` - Added league_id filter to predictions query
8. `POST /api/predictions/{matchday_id}` - Added server-side guard: validates league membership, enforces league_id on all predictions
9. `POST /api/predictions/{matchday_id}/confirm` - Added league_id filter
10. `/api/live/{matchday_id}` - Added league_id filter to predictions query
11. Legacy `/api/live/matchday/{matchday_id}` - Added league_id filter + match source query
12. `/api/predictions/user/{target_user_id}/{matchday_id}` - Added league_id filters to predictions and score_summary queries

**Testing**: 16/16 backend tests passed. Verified with two users across different leagues.

## Prioritized Backlog

### P1
- Remove legacy "Jolly" feature from codebase and database

### P2
- Implement "Championship Winner Predictions" feature
- Integrate Stripe for joining National League
- Re-enable email verification
- Implement Push Notifications

### P3
- Refactor monolithic server.py into modular architecture (routes, services, data access)

## Credentials
- Admin: admin@fantapronostic.com / admin123
- User 1 (Desylega): desiree@raimondi.it / Roberto95
- User 2 (liga2): ilio@raimondi.it / password123
- NATIONAL_LEAGUE_ID: f1373417-43aa-4043-b6a2-125873181c95
