# FantaPronostic - PRD (Product Requirements Document)

## Overview
FantaPronostic is a football prediction platform mobile app built with Expo React Native (frontend) and FastAPI + MongoDB (backend).

## Architecture
- **Frontend**: Expo React Native with TypeScript, expo-router, i18n (IT/EN), Zustand
- **Backend**: FastAPI (Python) with MongoDB, JWT auth
- **Admin Console v3**: Unified admin console at `/admin` — replaces old separate national/private admin consoles
- **Expo Preview**: Runs in `--web` mode (not tunnel) for K8s compatibility

## Features Implemented

### 1. Authentication
- Email + Password (register/login)
- Google OAuth via Emergent Auth
- JWT access + refresh tokens
- Role-based access: user / admin / superadmin

### 2. Home Hub
- Dynamic matchday card (OPEN/LOCKED/LIVE/COMPLETED)
- Countdown to first_kickoff
- CTA for predictions or live view
- Rankings preview, user leagues, statistics
- **Matchday priority: LIVE > OPEN > LOCKED > current_matchday_id > latest** (Fixed Feb 21, 2026)

### 3. Predictions
- Max 10 matches per matchday
- Market types: 1X2 (1pt), GOAL_NOGOL (0.5pt), OVER_UNDER (0.5pt), EXACT_SCORE (4pt)
- Lock per match at start_time
- Batch save

### 4. Joker System
- 1 Joker per matchday, doubles points

### 5. Scoring Engine
- Automatic calculation on matchday COMPLETED
- score_summaries per user per matchday per league
- Standing recalculation across all matchdays

### 6. League System
- Private leagues with invite codes
- National league (NATIONAL_LEAGUE_ID = f1373417-43aa-4043-b6a2-125873181c95)
- Strict data isolation via mandatory league_id

### 7. Admin Console v3
- Unified console replacing old separate admin pages
- Backend endpoints: /api/admin/v3/leagues, /api/admin/v3/matchdays, /api/admin/matchday/{id}/transition
- Guided state flow: DRAFT > OPEN > LOCKED > LIVE > COMPLETED
- Role-based: SUPER_ADMIN vs LEAGUE_ADMIN
- All UI in Italian

### 8. Live Screen
- Polling every 60s for live matchdays
- Per-match points display with outcome indicators
- Joker bonus display

## Completed Bug Fixes (Feb 21, 2026)
- Fixed LIVE mode inconsistency: /api/home now prioritizes LIVE > OPEN > LOCKED (was OPEN > LOCKED|LIVE combined)
- Fixed "Completa e Calcola" button (Alert.alert web incompatibility)
- Fixed incorrect active matchday on home page
- Fixed admin access for national-type league owners
- Expo tunnel fixed by switching to --web mode

## P0 Backlog
- (none)

## P1 Backlog
- Fix frontend ESLint TypeScript parser configuration

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
- MEMBER: test@raimondi.it / password123

## Key Files
- `/app/backend/server.py` — Main backend
- `/app/frontend/app/admin/index.tsx` — Admin Console v3
- `/app/frontend/app/(tabs)/home.tsx` — Home screen
- `/app/frontend/app/live/[id].tsx` — Live matchday screen
- `/app/frontend/app/(tabs)/profile.tsx` — Profile with admin navigation
