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
- League creation with configurable rules (scoring, matchdays, deadlines)
- Member management, admin roles

### Predictions System  
- Match-by-match predictions (1X2 format)
- Joker usage (double points)
- Auto-scoring with configurable point system
- Matchday status tracking (upcoming, live, completed)

### Championship Winner Predictions (NEW - March 2026)
- Users predict which team will win the league championship
- Full team list from API-Football standings (20 Serie A teams)
- Save/update predictions per league
- View all league members' picks with team summary
- Accessible via Home page banner and Side Menu
- Backend: `/api/champion-picks/` (teams, save, my pick, league picks)
- Frontend: `/champion-pick` screen with two tabs (La mia scelta, Lega)

### Tournament System (Competition Context)
- Tournaments treated as a competition context within the existing app shell
- Shared `CompetitionContext` provider for mode switching
- Context-aware tabs: Home, Predictions, Rankings
- Tournament-specific views: Gironi, Tabellone, Partite
- Tournament registration and group management

### Rankings & Standings
- General league standings
- Weekly/matchday standings
- Live standings during active matchdays
- Tournament brackets and group tables

### Live Features
- Real-time match score updates via API-Football
- Live provisional standings
- Auto-refresh background task

### Admin Panel
- Web-based admin UI at `/api/admin-ui`
- Matchday management (create, edit, set results)
- Match import from API-Football
- User and league management
- RBAC role management

### UI/UX
- Premium dark navy gradient design
- Performance cards, trend charts
- Side menu navigation
- Notification system with badges
- Multi-language support (i18n)

## Database Collections
- users, seasons, leagues, memberships
- matchdays, matches, predictions
- joker_usages, champion_picks, score_summaries
- standings_cache, audit_logs, notifications
- push_tokens, roles, password_resets
- tournaments, tournament_registrations
- tournament_groups, tournament_rounds, tournament_matchups

## Test Credentials
- **Standard User**: ilio@raimondi.it / password123
- **Admin**: admin@fantapronostic.com / admin123

## Completed Tasks (Latest Session - March 12, 2026)
- [x] Verified P0 UI changes: disabled theme toggle, tournament counter in profile, Palmares icon
- [x] Fixed team name overlap (flexShrink: 0 on vsContainer)
- [x] Implemented Championship Winner Predictions feature (backend + frontend)
- [x] Added champion pick banner to Home page
- [x] Added "Pronostico Vincitore" to Side Menu
- [x] Fixed MongoDB index for champion_picks (added league_id)
- [x] All tests passed: 100% backend (15/15), 100% frontend

## Prioritized Backlog
### P1
- [ ] Implement Achievements/Badges system (trophy icon placeholder exists)

### P2
- [ ] Stripe integration for paid entry to leagues/tournaments
- [ ] Light/dark mode full implementation (currently disabled)

### Future
- [ ] Push notification improvements
- [ ] Social features (chat, comments)
- [ ] Advanced statistics dashboard
