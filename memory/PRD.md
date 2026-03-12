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

### Trophy/Palmares System (NEW - March 2026)
- **Backend engine** (`trophies.py`): Automatic trophy assignment
  - Weekly trophies: Best matchday score, Perfect score (all correct), 5+ win streak
  - League trophies: Champion, 2nd place, 3rd place (at season end)
  - Tournament trophies: Champion, Finalist, Semifinalist (at tournament end)
- **API endpoints**: `GET /api/trophies/my`, `GET /api/trophies/user/{user_id}`
- **Hooks integrated** into scoring flows:
  - `services.py`: `award_weekly_trophies()` called after matchday scoring
  - `tournaments.py`: `award_tournament_trophies()` called when all rounds complete
- **Frontend Palmares screen** (`palmares.tsx`): 
  - Accessible via medal icon in header
  - Fetches real data from `/api/trophies/my`
  - 3 colored categories: Lega (blue), Tornei (green), Settimanali (purple)
  - Recent trophies list, empty state message
  - Pull-to-refresh

### Rankings & Standings
- General league standings
- Weekly/matchday standings
- Live standings during active matchdays
- Tournament brackets and group tables

### Profile
- User stats: leagues count, tournaments count, role
- Language selector (IT/EN/ES)
- Theme toggle removed (was non-functional)

## Database Collections
- users, seasons, leagues, memberships
- matchdays, matches, predictions
- joker_usages, champion_picks, score_summaries
- standings_cache, audit_logs, notifications
- push_tokens, roles, password_resets
- tournaments, tournament_registrations
- tournament_groups, tournament_rounds, tournament_matchups
- **trophies** (NEW)

## Test Credentials
- **Standard User**: ilio@raimondi.it / password123
- **Admin**: admin@fantapronostic.com / admin123

## Completed Tasks (March 12, 2026)
- [x] Removed "Tema Scuro" from Profile
- [x] Medal icon navigates to Palmares screen (was opening leagues list)
- [x] Created Palmares screen with 3 trophy categories (data from API)
- [x] Built trophy assignment engine (trophies.py)
- [x] Hooked trophy assignment into matchday scoring flow
- [x] Hooked trophy assignment into tournament completion flow
- [x] API endpoints for trophies (my + user)
- [x] All tests passed: 14/14 backend (pytest)
- [x] Hidden Championship Winner Predictions feature
- [x] Fixed team name overlap (flexShrink on vsContainer)

## Prioritized Backlog
### P1
- [ ] Re-enable Championship Winner Predictions when decided
- [ ] Award league trophies at end of season (needs admin trigger or auto-detection)

### P2
- [ ] Stripe integration for paid entry to leagues/tournaments
- [ ] Light/dark mode full implementation

### Completed Recently
- [x] Side Menu Redesign (2026-03-12): Header da arancione a gradiente blu navy, icone arancioni, coerente con il design dell'app
- [x] Admin Panel - Sezione Tornei (2026-03-12): Gestione completa tornei nel pannello admin esterno con creazione, eliminazione, apertura iscrizioni, avvio forzato
- [x] Logica Tornei Avanzata (2026-03-12): Calcolo automatico giornate gironi (N-1 andata, 2*(N-1) andata/ritorno), scelta formato andata/ritorno, calcolo automatico fase eliminatoria (32esimi/ottavi/quarti/ecc.), tabellone Champions League con incroci gironi, validazione potenza di 2 per qualificati

### Future
- [ ] Push notification improvements
- [ ] Social features (chat, comments)
- [ ] Advanced statistics dashboard
