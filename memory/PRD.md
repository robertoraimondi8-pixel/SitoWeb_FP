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
- Compound unique index: `user_match_league_unique`
- All prediction queries MUST include league_id filter

### Score Summaries: unique per `(user_id, matchday_id, league_id)`
- Compound unique index: `user_matchday_league_unique`
- All score_summaries queries MUST include league_id filter

## What's Been Implemented
- User auth (JWT + Google OAuth)
- League creation, joining, management
- Match predictions with multiple market types
- Live scoring and match status updates
- Standings (total, weekly, user profile)
- Admin panel for matchday management
- API-Football integration
- Full multi-league data isolation (Feb 22, 2026)
- Jolly removal (Feb 22, 2026)
- **Classifica LIVE** (Feb 22, 2026)

## Changes Applied

### P1 - Classifica LIVE (Feb 22, 2026) - COMPLETED
Real-time live standings integrated into the existing Weekly Rankings screen.
- **Backend**:
  - `get_home()`: Added live ranking computation (live_rank, live_points, total_members) when matchday is LIVE
  - `get_weekly_standings()`: Shows ALL league members for LIVE matchdays (including 0-point users). Added `matchday_status` to response. Computes effective matchday status.
  - `get_available_matchdays()`: Includes OPEN/LIVE matchdays even without predictions. Computes effective status for OPEN matchdays.
  - NO new endpoints created. NO DB changes. NO score_summaries writes.
- **Frontend**:
  - Home: Replaced LIVE points box with "Classifica LIVE" button showing provisional rank + points. Click navigates to Rankings > Weekly with LIVE matchday auto-selected.
  - Rankings: Reads navigation params (tab, matchdayId). Auto-switches to weekly tab + selects LIVE matchday. Shows LIVE banner and green styling.
  - User-predictions: Added "Nessun pronostico" empty state for users without predictions.
- **NOT touched**: Scoring logic, score_summaries, COMPLETED matchday behavior, admin flows.

### P0 - League Data Isolation (Feb 22, 2026) - COMPLETED
Enforced `league_id` on all score_summaries queries.

### P0 - Multi-League Predictions Architecture (Feb 22, 2026) - COMPLETED
Predictions unique per `(user_id, match_id, league_id)`. Score summaries unique per `(user_id, matchday_id, league_id)`.

### P1 - Jolly Removal (Feb 22, 2026) - COMPLETED
**Approach**: Neutralize at input, zero changes to math functions.
- **Backend**: `joker_active = False` forced at all 5 input points. 3 joker endpoints removed.
- **Frontend**: Jolly toggle banner removed from predictions screen. Jolly x2 badge removed from rankings. Bonus Jolly row + JOLLY ATTIVO banner removed from live screen.
- **NOT touched**: calculate_match_points(), calculate_matchday_total(), database schema, indexes.

## Prioritized Backlog

### P2
- Implement "Championship Winner Predictions" feature
- Integrate Stripe for joining National League
- Re-enable email verification
- Implement Push Notifications

### P3
- Refactor monolithic server.py into modular architecture
- Clean up dead Jolly code (type definitions, unused functions, CSS)

## Credentials
- Admin: admin@fantapronostic.com / admin123
- User 1 (Desylega): desiree@raimondi.it / Roberto95
- User 2 (liga2): ilio@raimondi.it / password123
- User 3: robrai@gmail.com / password
- NATIONAL_LEAGUE_ID: f1373417-43aa-4043-b6a2-125873181c95
- LIVE Matchday ID (current): 23c88f47-475f-4aa5-8fe8-f13d61d43cbe

## Key Files
- `/app/backend/server.py`: All business logic and API endpoints
- `/app/backend/scoring.py`: Points calculation engine
- `/app/backend/database.py`: MongoDB connection and indexes
- `/app/frontend/app/(tabs)/home.tsx`: Home screen with Classifica LIVE
- `/app/frontend/app/(tabs)/rankings.tsx`: Rankings with LIVE mode
- `/app/frontend/app/user-predictions.tsx`: User predictions detail
- `/app/frontend/app/live/[id].tsx`: Live match view
