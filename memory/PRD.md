# FantaPronostic - Product Requirements Document

## Original Problem Statement
Fantasy football predictions platform where users join leagues, predict match outcomes, and compete on leaderboards. The platform supports both Leagues (leghe) and Tournaments (tornei) as different competition contexts within the same unified app shell.

## Core Architecture
- **Frontend**: React Native (Expo) with web support
- **Backend**: FastAPI (Python) 
- **Database**: MongoDB
- **External APIs**: API-Football (API-Sports) for real match data
- **Notifications**: Expo Push + SendGrid emails
- **Scheduler**: APScheduler for background tasks

## Key Features Implemented

### Authentication & User Management
- JWT-based auth with refresh tokens
- User registration, login, email verification
- Profile management with avatar, city, country
- Password reset via email

### Leagues System
- National League (Lega Nazionale) with API-Football data
- Private leagues with invite codes
- League creation with configurable rules
- Member management, admin roles

### Predictions System  
- Match-by-match predictions (1X2 format)
- Joker usage (double points)
- Auto-scoring with configurable point system
- Matchday status tracking

### Championship Winner Predictions (HIDDEN - ready for future)
- Backend fully implemented at `/api/champion-picks/`
- Frontend screen at `/champion-pick.tsx`
- UI entry points hidden (banner + side menu removed)

### Tournament System (Competition Context)
- Tournaments as competition context within existing app shell
- Shared `CompetitionContext` provider
- Context-aware tabs: Home, Predictions, Rankings
- Tournament views: Gironi, Tabellone, Partite
- BOOST X3 premium card design for special matches
- 1v1 live matchup view with score comparison
- Round-robin scheduling with "circle method" algorithm

### Dynamic Tab Navigation (NEW - March 2026)
- Tab press listener in `_layout.tsx` dynamically resolves destination
- League OPEN/LOCKED → predictions form
- League LIVE/COMPLETED → `/live/{matchdayId}` (live/results screen)
- Tournament OPEN → predictions form
- Tournament LIVE/COMPLETED → Home tab with TournamentView matchup auto-opened via `pendingMatchupOpen` context signal
- No generic Home fallback — every navigation is context-aware

### Trophy/Palmares System
- **Backend engine** (`trophies.py`): Automatic trophy assignment
  - Weekly trophies: Best matchday score, Perfect score (all correct), 5+ win streak
  - League trophies: Champion, 2nd place, 3rd place (at season end)
  - Tournament trophies: Champion, Finalist, Semifinalist (at tournament end)
- **API endpoints**: `GET /api/trophies/my`, `GET /api/trophies/user/{user_id}`
- **Hooks integrated** into scoring flows
- **Frontend Palmares screen** (`palmares.tsx`)

### Admin Panel (Server-Side Rendered)
- Full tournament management (CRUD, groups, knockouts)
- Giornate management for leagues and tournaments
- Force-start tournaments, manage round states
- Accessible at `/api/admin-ui`

### Rankings & Standings
- General league standings
- Weekly/matchday standings
- Live standings during active matchdays
- Tournament brackets and group tables

### Profile
- User stats: leagues count, tournaments count, role
- Language selector (IT/EN/ES)

## Database Collections
- users, seasons, leagues, memberships
- matchdays, matches, predictions
- joker_usages, champion_picks, score_summaries
- standings_cache, audit_logs, notifications
- push_tokens, roles, password_resets
- tournaments, tournament_registrations
- tournament_groups, tournament_rounds, tournament_matchups
- trophies

## Test Credentials
- **Standard User**: ilio@raimondi.it / password123
- **Admin**: admin@fantapronostic.com / admin123

## Completed Tasks

### March 12, 2026 (Latest)
- [x] **P0 FIX: Dynamic Pronostici Tab Navigation** — Tab press listener in `_layout.tsx` intercepts and resolves destination dynamically based on competition mode + matchday state. Leagues LIVE/COMPLETED → `/live/{id}`. Tournaments LIVE/COMPLETED → Home + matchup auto-open via `pendingMatchupOpen`. Testing: 100% backend + frontend pass.
- [x] Tournament Admin Panel (creation, configuration, force-start, round management)
- [x] Tournament App Integration (predictions, live, fixtures endpoints support tournaments)
- [x] BOOST X3 Global UI Refactor (premium card design across all screens/states)
- [x] Tournament Live View Overhaul (1v1 matchup screen)
- [x] Side Menu Redesign (navy gradient, consistent with app design)
- [x] Round-robin scheduling with "circle method" algorithm

### Earlier (March 2026)
- [x] Removed "Tema Scuro" from Profile
- [x] Medal icon navigates to Palmares screen
- [x] Created Palmares screen with 3 trophy categories
- [x] Built trophy assignment engine (trophies.py)
- [x] Hooked trophy assignment into matchday/tournament scoring flows
- [x] API endpoints for trophies
- [x] All tests passed: 14/14 backend (pytest)
- [x] Hidden Championship Winner Predictions feature
- [x] Fixed team name overlap (flexShrink on vsContainer)

## Prioritized Backlog

### P1
- [ ] Retroactively award trophies for past events (backfill: `POST /api/admin/recalculate-trophies`)
- [ ] Implement League Champion trophy logic
- [ ] Implement Tournament Champion trophy logic
- [ ] Fix scheduling for existing "RedBull" tournament (regenerate matchups or recreate?)

### P2
- [ ] Re-enable Championship Winner Predictions when decided
- [ ] Stripe integration for paid entry to leagues/tournaments

### Future
- [ ] Push notification improvements
- [ ] Social features (chat, comments)
- [ ] Advanced statistics dashboard
- [ ] Light/dark mode full implementation
