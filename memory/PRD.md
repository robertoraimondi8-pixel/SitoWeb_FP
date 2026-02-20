# FantaPronostic - PRD (Product Requirements Document)

## Overview
FantaPronostic is a football prediction platform mobile app built with Expo React Native (frontend) and FastAPI + MongoDB (backend).

## Architecture
- **Frontend**: Expo React Native with TypeScript, expo-router, i18n (IT/EN), Zustand
- **Backend**: FastAPI (Python) with MongoDB, JWT auth, Stripe integration
- **Admin Dashboard**: Web admin served by FastAPI at /admin

## Features Implemented (MVP)

### 1. Authentication ✅
- Email + Password (register/login)
- Google OAuth via Emergent Auth (session verification on backend)
- JWT access + refresh tokens
- Role-based access: user / admin / superadmin
- Password show/hide toggle
- "Password dimenticata?" placeholder
- "Registrati" link

### 2. Home Hub ✅
- Dynamic matchday card (OPEN/LOCKED/LIVE/COMPLETED)
- Countdown to first_kickoff - 60s
- CTA for predictions or live view
- Rankings preview
- User leagues display
- Statistics placeholder with adapter pattern

### 3. Predictions ✅
- 11 matches per matchday
- **USER CHOOSES market type per match** (1X2=1pt, GOAL_NOGOL=0.5pt, OVER_UNDER_25=0.5pt, EXACT_SCORE=4pt)
- Only 1 market per match enforced (server rejects duplicate match_ids)
- EXACT_SCORE validated: format H-A, numbers >=0
- Lock per match: modifiable until match.start_time (server time)
- Other matches in same matchday remain editable until their start_time
- Batch save with per-match error reporting
- "Pronostici salvati!" success feedback

### 4. Joker System ✅
- 1 usage per half (andata/ritorno) per season
- Activatable/modifiable until first_kickoff - 60s
- x2 on valid match points only
- No points on void matches

### 5. Live ✅
- Shows user's 11 predictions with live scores
- Provisional points calculation
- Polling every 60s
- No public rankings during live

### 6. Rankings ✅
- Weekly and Total standings
- League filter
- Top 3 highlighted + user position
- Predictions visible only when matchday COMPLETED + same league

### 7. Leagues ✅
- National league (Stripe payment required)
- Private leagues (create with invite code)
- Join via invite code

### 8. Stripe Payments ✅
- Checkout session for national league membership (€20/season)
- Webhook verification
- Membership activated only after webhook confirmation

### 9. Admin Dashboard ✅
- Web dashboard at /admin
- CRUD: Seasons, Matchdays, Matches
- Live manual update (score + status)
- Confirm matchday → COMPLETED (triggers idempotent scoring)
- Audit log viewer
- League and payment management

### 10. i18n ✅
- Italian (default) + English
- All UI text in translation files
- Language selectable in profile

### 11. Database ✅ (MongoDB with relational references)
- Collections: users, seasons, leagues, memberships, payment_transactions, matchdays, matches, predictions, joker_usages, champion_picks, score_summaries, standings_cache, audit_logs, notifications
- Unique indexes enforced (user+match, user+season+half for joker, etc.)
- ObjectId excluded from all responses

### 12. Seed Data ✅
- 1 season (Serie A 2024-2025)
- 1 matchday with 11 matches (various competitions)
- 3 users (admin, Marco_FP, Giulia_Pro)
- 1 national league, 1 private league (code: AMICI2024)

## Login Credentials
- Admin: admin@fantapronostic.com / admin123
- User 1: marco@test.com / password123
- User 2: giulia@test.com / password123
- Private league code: AMICI2024

## API Endpoints
### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- GET /api/auth/me
- POST /api/auth/google/session (Emergent Google OAuth)

### User
- GET /api/home
- GET /api/profile
- PUT /api/profile

### Leagues
- GET /api/leagues
- POST /api/leagues (create private)
- POST /api/leagues/join
- GET /api/leagues/national
- GET /api/leagues/seasons

### Predictions
- GET /api/predictions/{matchday_id}
- POST /api/predictions/{matchday_id}
- POST /api/predictions/{matchday_id}/joker
- DELETE /api/predictions/{matchday_id}/joker

### Standings
- GET /api/standings/weekly/{matchday_id}?league=
- GET /api/standings/total?league=
- GET /api/standings/leagues/{league_id}/matchdays/{matchday_id}/users/{user_id}/predictions

### Live
- GET /api/live/matchday/{matchday_id}

### Payments
- POST /api/payments/checkout
- GET /api/payments/status/{session_id}
- POST /api/webhook/stripe

### Admin
- GET/POST /api/admin/seasons
- PUT /api/admin/seasons/{id}
- GET/POST /api/admin/matchdays
- PUT /api/admin/matchdays/{id}
- GET/POST /api/admin/matches
- PUT /api/admin/matches/{id}
- POST /api/admin/matches/{id}/live-update
- POST /api/admin/matchdays/{id}/confirm
- POST /api/admin/matchdays/{id}/recalc
- GET /api/admin/audit-logs
- GET /api/admin/leagues
- GET /api/admin/payments
- GET /api/admin/score-summaries/{matchday_id}

## Design
- Dark mode default with light toggle
- Primary: #1A3A6B (deep blue)
- Accent: #F5A623 (vibrant orange)
- Card-based UI, minimal modern style
- Official logo in login screen

## Multi-League Feature ✅ (Feb 2026)

### Private League Creation
- Create leagues with unique invite code
- Configure: name, logo, matchdays range, bet deadlines, scoring markets
- Scoring markets: 1X2, Goal/No Goal, Over/Under, Exact Score (on/off toggles)
- Rules locked after second member joins

### Match Source Types
- **National**: Inherits fixtures from national league
- **Manual**: Creator manages own fixtures via Creator Console

### Creator Console (/league/[id]/manage)
- Add/edit/delete matchdays
- Add/edit/delete matches per matchday
- Only visible to manual league owners

### League Switcher
- Dropdown in home header to switch between user's leagues
- Persists selection via PATCH /api/profile/current-league
- Shows league name with trophy icon

### Bug Fixes (19 Feb 2026)
- ✅ P0: Manual leagues now show only their own fixtures (not national or other manual leagues)
- ✅ P1: Creator Console button visible to league owner (is_owner flag in /api/home response)
- ✅ P2: Redundant league list removed from home screen
- ✅ FIX DEFINITIVO: Isolamento completo tra leghe manuali A e B con stesso matchday.number
- ✅ FIX DEFINITIVO: /api/home restituisce matchday specifico per lega (manual vs national)
- ✅ FIX DEFINITIVO: Permessi 403 per non-owner su endpoint Creator Console

## Changelog

### 19 Feb 2026 (Fix Definitivo)
- Fixed: /api/home ora cerca matchday per league_id (manual) o season_id (national)
- Fixed: Aggiunto is_owner e my_role nella risposta league
- Fixed: Frontend predictions.tsx usa /api/leagues/{id}/fixtures come unico endpoint
- Added: Test suite isolamento multi-lega (/app/backend/tests/test_multi_league_isolation.py)
- Verified: 15/15 backend tests passati

### 20 Feb 2026 - Bugfix: GIORNATE contatore errato in home per leghe nazionali private
- **Root Cause**: `user_matchdays_played` usava `total_completed_in_season` (6 giornate nazionali completate) invece delle giornate dove l'utente ha predictions per questa lega specifica.
- **Fix** (`server.py`): Per leghe non-manuali, `user_matchdays_played = len(distinct matchday_id from predictions where user_id=X AND league_id=Y)`. Per leghe manuali: mantiene `total_completed_in_season`.
- **Risultato**: Desylega (nuova lega) mostra GIORNATE = 0. Dopo che desiree inserisce i suoi pronostici, il contatore aumenterà correttamente.

### 20 Feb 2026 - Bugfix: Isolamento Completo Dati Leghe Nazionali Private (league_id in predictions)
- **Root Cause**: Le predictions non avevano `league_id`, quindi standings/matchdays, standings/weekly, standings/total e home/last_5 mostravano dati storici della lega nazionale per tutte le leghe private di tipo national.
- **Fix 1** (`models.py`): Aggiunto `league_id: Optional[str] = None` a `PredictionsBatchRequest`.
- **Fix 2** (`server.py` - `save_predictions`): Ogni prediction viene salvata con `league_id` quando passato nel body POST.
- **Fix 3** (`server.py` - `get_available_matchdays`): Per leghe nazionali private, restituisce solo matchday con `predictions.league_id = current_league_id`.
- **Fix 4** (`server.py` - `get_weekly_standings`): Filtra predictions per `league_id` e mostra solo utenti che hanno giocato per questa lega.
- **Fix 5** (`server.py` - `get_total_standings`): Usa `predictions.distinct('matchday_id', {league_id: X})` per determinare matchday giocati.
- **Fix 6** (`server.py` - `home/last_5_performance`): Salta giornate senza `predictions.league_id = current_league_id`.
- **Fix 7** (`predictions.tsx`): Frontend ora passa `league_id` nel body del POST `/api/predictions/{matchday_id}`.
- **Risultato**: Una lega nuova parte da 0. Ogni lega vede solo le proprie giornate giocate.

### 20 Feb 2026 - Bugfix: Data Isolation for National-type Private Leagues
- **Root Cause**: `admin_confirm_matchday` creates score_summaries WITHOUT `league_id`. Queries for national-type private leagues incorrectly filtered by `league_id = private_league_id`, finding nothing.
- **Fix 1** (`/api/home` - `last_5_performance`): For national-type leagues, skip matchdays where user has no predictions (prevents historical national matchday "leakage").
- **Fix 2** (`/api/home` - `all_totals`): For national-type leagues, aggregate score_summaries by `matchday_id IN [national_md_ids]` instead of `league_id` filter.
- **Fix 3** (`/api/standings/total`): For national-type leagues, use national matchday IDs (not `league_id`) in the aggregation pipeline.
- **Regression confirmed**: Manual leagues (ilio@raimondi.it) continue to work correctly with `league_id` filter.

### 20 Feb 2026 - Feature: Predictions Completeness Validation
- **Frontend**: Bottone "Conferma Pronostici" disabilitato fino a quando non tutte le partite hanno un pronostico
- **Frontend**: Progress bar `completedCount/totalCount partite` nel footer della pagina Pronostici
- **Frontend**: Titolo bottone dinamico: "Completa tutti i pronostici" quando incompleto, "Salva Pronostici" quando completo
- **Backend**: `POST /api/predictions/{matchday_id}` restituisce HTTP 422 con `PREDICTIONS_INCOMPLETE` se non tutte le partite (non ancora iniziate) hanno un pronostico
- **Backend**: Logica cumulativa: controlla sia i pronostici nel payload sia quelli già salvati nel DB

### Previous Sessions
- Implemented private league creation with configurable rules
- Added manual vs national match source types
- Created Creator Console for manual leagues
- Implemented league switcher dropdown
- Fixed login bounce bug
- Fixed Google OAuth flow for web and native
