# FantaPronostic - PRD

## Problem Statement
Fantasy sports prediction app for Italian football leagues. Users predict match outcomes (1/X/2), earn points, compete in private or national leagues. Admins manage seasons, matchdays, matches. Supports real-world match data via API-Football integration.

## App Architecture
- **Frontend**: React Native / Expo (web + mobile)
- **Backend**: FastAPI + Python
- **Database**: MongoDB
- **Auth**: JWT-based custom auth + Emergent Google OAuth

## Core User Personas
1. **Player**: Joins leagues, submits predictions, views standings
2. **League Owner**: Creates private leagues, manages matchdays/matches for their leagues
3. **Super Admin**: Full control - seasons, national leagues, API data imports, system config

## Implemented Features (Completed)

### Authentication & Onboarding (Complete)
- JWT login/register, Google OAuth (Emergent-managed)
- Onboarding flow: choose National League or create/join private league
- Multi-language support (IT/EN/ES) via react-i18next
- Language selector in onboarding + profile screens

### Home Screen (Complete)
- Active matchday card with prediction progress
- Live match scores with team logos + elapsed time
- Kickoff times for upcoming matches
- League summary (position, points, last 5 results)
- Countdown timer to next matchday

### Predictions Screen (Complete)
- 1/X/2 prediction input per match
- Joker feature (double points for one match)
- Match lock logic (prevents editing after kickoff)
- Team logo display

### Rankings Screen (Complete)
- Total and weekly standings per league

### Profile Screen (Complete)
- My Leagues section (national + private)
- Settings (dark/light mode)
- Language selector (IT/EN/ES)
- Admin Console shortcut (for admins/owners)
- Logout

### Admin Console (Complete)
- League/matchday/match management
- Match result editing + score saving
- Matchday status transitions (DRAFT → OPEN → LOCKED → LIVE → COMPLETED)
- Score recalculation
- **API-Football Import**: Search and import real fixtures from API-Football
- **Refresh Live Results**: Manual trigger for live score updates (POST /api/admin/real-fixtures/refresh-live)

### API-Football Integration (Complete)
- Backend client (`apifootball.py`) with TTL caching
- Admin endpoints: search fixtures, list leagues, import fixtures, refresh-live
- Background scheduler (configurable via APIFOOTBALL_LIVE_SYNC_ENABLED env var)
- Circuit breaker to protect API quota
- Team logos, elapsed time, kickoff times for imported matches

### i18n (Complete - Fixed 2026-02-21)
- Fallback language set to Italian (`fallbackLng: 'it'`)
- Auth screens (landing, login) fully translated
- Onboarding uses correct dot-notation keys, Spanish flag added
- Profile screen uses correct nested i18n keys
- All 3 locale files (IT/EN/ES) complete with all keys

## API Key Endpoints
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/live` - Live match data with logos/elapsed
- `GET /api/matchdays/{id}/matches` - Matches for a matchday
- `POST /api/predictions` - Submit predictions
- `GET /api/standings/{league_id}` - League standings
- `POST /api/admin/real-fixtures/import` - Import API-Football fixtures
- `GET /api/admin/real-fixtures/search` - Search API-Football fixtures
- `GET /api/admin/real-fixtures/leagues` - Supported leagues
- `POST /api/admin/real-fixtures/refresh-live` - Manual live score refresh

## Key DB Schema
- **users**: id, email, username, role, password_hash, language
- **leagues**: id, name, type (national/private), invite_code, season_id, match_source_type
- **seasons**: id, league_id, year, status
- **matchdays**: id, season_id, number, label, status, first_kickoff
- **matches**: id, matchday_id, home_team, away_team, status, score, home_logo, away_logo, elapsed, external_provider, external_fixture_id
- **predictions**: id, user_id, match_id, prediction (1/X/2), is_joker
- **scores**: id, user_id, matchday_id, league_id, points

## Environment Variables
- Backend: MONGO_URL, DB_NAME, JWT_SECRET, APIFOOTBALL_API_KEY, APIFOOTBALL_LIVE_SYNC_ENABLED
- Frontend: EXPO_PUBLIC_BACKEND_URL

## Known Issues
- **Expo Go Tunnel**: Non-functional in Kubernetes env (platform limitation). All dev/testing via web preview.
- **Admin Console 'Open Console' button in profile**: LOW priority - text may be low visibility inside dark card (pre-existing, cosmetic only)

## Prioritized Backlog

### P0 (Critical, do next)
- None currently

### P1 (High Priority)
- Re-enable email verification flow

### P2 (Medium)
- Championship Winner Predictions feature
- Push notifications

### P3 (Future/Backlog)
- Stripe integration (joining National League - €20/season)
- Advanced stats dashboard
- Match history / prediction history for users

## Test Credentials
- Super Admin: admin@fantapronostic.com / admin123
- League Owner (manual): ilio@raimondi.it / password123
- League Owner (national): desiree@raimondi.it / Roberto95
