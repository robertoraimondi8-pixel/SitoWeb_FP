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

### Palmares / Trophies Screen (NEW - March 2026)
- Accessible via medal icon in header (top right)
- Three trophy categories:
  - Trofei Lega (blue): Campione, 2° classificato, 3° classificato
  - Trofei Tornei (green): Campione, Finalista, Semifinalista
  - Trofei Settimanali (purple): Miglior punteggio, Punteggio perfetto, Serie positiva
- Currently showing 0 for all (placeholder for future data)

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

## Test Credentials
- **Standard User**: ilio@raimondi.it / password123
- **Admin**: admin@fantapronostic.com / admin123

## Completed Tasks (March 12, 2026)
- [x] Removed "Tema Scuro" from Profile (non-functional toggle)
- [x] Medal icon now navigates to Palmares screen (was opening leagues list)
- [x] Created Palmares screen with 3 trophy categories
- [x] Hidden Championship Winner Predictions feature (backend + frontend kept)
- [x] Fixed team name overlap (flexShrink on vsContainer)
- [x] Fixed MongoDB index for champion_picks

## Prioritized Backlog
### P1
- [ ] Connect trophies to real data when competitions complete
- [ ] Re-enable Championship Winner Predictions when decided

### P2
- [ ] Stripe integration for paid entry to leagues/tournaments
- [ ] Full achievements/badges system
- [ ] Light/dark mode implementation
