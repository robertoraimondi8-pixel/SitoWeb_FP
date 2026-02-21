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
- **Matchday priority: LIVE > OPEN > LOCKED > current_matchday_id > latest**
- **Ultimi 5 risultati**: Shows real points for all league types (national filter fix applied)

### 3. Predictions
- Max 10 matches per matchday
- Market type: Always 1X2 (market selector removed from UI)
- Lock per match at start_time
- Batch save

### 4. Joker System
- 1 Joker per matchday, doubles points

### 5. Scoring Engine
- Automatic calculation on matchday COMPLETED
- **Live provisional points**: calculated during LIVE status
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
- **"Tipo Mercato" removed** from match creation UI (always defaults to 1X2)
- All UI in Italian

### 8. Live Screen
- Polling every 60s for live matchdays
- Per-match points display with outcome indicators
- Joker bonus display
- **Provisional points calculated during LIVE** (not just COMPLETED)

### 9. Rankings
- **Classifica settimanale**: Shows `total_correct` (pronostici corretti) instead of old `exact_correct`
- **Classifica totale**: Aggregated across all matchdays
- Matchday-by-matchday breakdown

## Completed Bug Fixes
- Fixed LIVE mode inconsistency: /api/home now prioritizes LIVE > OPEN > LOCKED
- Fixed provisional points not showing during LIVE: scoring.py accepts "live" status
- Fixed "Ultimi 5 pronostici" showing 0 for national-type leagues (removed league_id filter)
- Fixed "Classifica settimanale" showing "0 risultati esatti" (replaced with total_correct)
- Removed "Tipo Mercato" selector from Admin Console and league console
- Fixed "Completa e Calcola" button (Alert.alert web incompatibility)
- Fixed incorrect active matchday on home page
- Fixed admin access for national-type league owners
- Expo tunnel fixed by switching to --web mode

## E2E Test Status (Feb 21, 2026)
- Login/Registration: OK
- Home page + matchday: OK  
- Match creation (admin): OK
- Match visibility: OK
- Predictions: OK
- Results entry: OK
- Score calculation: OK
- Weekly standings: OK
- Total standings: OK
- Ultimi 5 risultati: OK
- Admin transitions: OK
- Profile + admin access: OK
- LIVE view: OK (limited test)
- Weekly/Final prizes: NOT IMPLEMENTED

### 10. i18n Multi-lingua (IT / EN / ES)
- i18next + react-i18next + expo-localization
- 3 locale files: `/src/i18n/locales/{it,en,es}/common.json`
- Language selector in Profile (3 buttons, live switch)
- localStorage persistence on web, device language detection
- Screens migrated: Home, Tab nav, Profile, Rankings, Predictions
- SSR-safe (no AsyncStorage at module init)

## Completed Refactoring (Feb 21, 2026)
- TypeScript: Removed all 102 `any` types from frontend codebase
- Created `/app/frontend/src/types/api.ts` with 30+ shared interfaces
- All catch blocks use `unknown` instead of `any`
- All useState hooks use explicit types (HomeData, PredictionsData, etc.)

## P1 Backlog
- Implement weekly/final prizes system

## P2 Backlog
- Implement "Championship Winner Predictions" feature
- Integrate Stripe for joining National League
- Re-enable email verification
- Implement Push Notifications
- Refactor server.py into modular routes

### 11. API-Football Integration (Feb 21, 2026)
- **Provider**: API-Sports (v3.football.api-sports.io)
- **Client**: `/app/backend/apifootball.py` — async httpx client with in-memory TTL cache
- **Env var**: `APIFOOTBALL_API_KEY` in `backend/.env`
- **Cache TTL**: Leagues 15min, Fixtures 5min, Live: no cache
- **Admin Endpoints** (require admin auth):
  - `GET /api/admin/real-fixtures/leagues` — Top 5 leagues (Serie A, PL, LaLiga, Bundesliga, Ligue 1)
  - `GET /api/admin/real-fixtures/search?league=&season=&from=&to=` — Search real fixtures
  - `POST /api/admin/real-fixtures/import` — Import fixtures as matches (body: league_id, matchday_id, fixture_ids[])
- **Match fields added**: `external_provider`, `external_fixture_id` (indexed, sparse)
- **Background scheduler**: Every 60s refreshes imported matches with status `live`/`scheduled`
- **Auto-complete**: When all matches in a matchday are finished, auto-sets COMPLETED and calculates scores
- **Error handling**: Proper 502 errors for API-Football issues (suspended key, rate limits)
- **Duplicate protection**: Won't re-import already-imported fixture IDs
- **Status mapping**: API-Football status → internal (1H/2H/HT → live, FT/AET → finished, NS → scheduled, PST → postponed)
- **NOTE**: API key may be suspended due to quota — user needs to check dashboard.api-football.com

## Credentials
- SUPER_ADMIN: admin@fantapronostic.com / admin123
- LEAGUE_OWNER (National): desiree@raimondi.it / Roberto95
- LEAGUE_OWNER (Manual): ilio@raimondi.it / password123
- MEMBER: test@raimondi.it / password123

## Key Files
- `/app/backend/server.py` — Main backend
- `/app/backend/scoring.py` — Points calculation engine
- `/app/backend/apifootball.py` — API-Football client with TTL caching
- `/app/frontend/app/admin/index.tsx` — Admin Console v3
- `/app/frontend/app/admin/league.tsx` — League management console
- `/app/frontend/app/(tabs)/home.tsx` — Home screen
- `/app/frontend/app/(tabs)/rankings.tsx` — Rankings/standings screen
- `/app/frontend/app/live/[id].tsx` — Live matchday screen
- `/app/frontend/app/(tabs)/profile.tsx` — Profile with admin navigation
