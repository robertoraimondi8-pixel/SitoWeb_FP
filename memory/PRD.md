# FantaPronostic - PRD

## Problem Statement
Fantasy sports prediction app (FantaPronostic) where users join leagues, predict match outcomes (1X2, Goal/NoGoal, Over/Under, Exact Score), and compete on leaderboards.

## Core Architecture
- **Frontend**: React Native (Expo) - web + mobile
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT + Emergent-managed Google Auth
- **Sports Data**: API-Football integration for live fixtures/scores

## What's Been Implemented
- User auth (email/password + Google OAuth)
- League system (create, join, manage)
- Matchday/fixtures management (manual + API import)
- Predictions CRUD with market types (1X2, GNG, O/U, Exact Score)
- Live score tracking with polling
- Rankings/leaderboard
- Admin console with fixture import + refresh results
- i18n (Italian/English/Spanish)
- Joker/Jolly system (double points)
- Smart navigation hub (shared routing logic)

## Recent Changes (Feb 2026)
### Smart Predictions Tab (Feb 21)
- Created shared `goToPredictionsHub()` function in `/app/frontend/src/utils/navigation.ts`
- Tab "Predictions" now mirrors the Home CTA button logic:
  - OPEN → predictions edit form
  - LOCKED → predictions read-only
  - LIVE → live screen redirect
  - COMPLETED → results screen redirect
  - No matchday → empty state
- Both Home CTA and Predictions tab use the same shared function
- Tested: 100% pass rate

### i18n Overhaul (Previous session)
- Fixed hardcoded strings across login, onboarding, profile, predictions
- Corrected fallback language to Italian
- Added Spanish flag to language selector

## Pending Issues
- **i18n "Save Prediction" bug (P0)**: User verification pending - text may show English instead of Italian after Metro bundler cache clear
- **Expo Go Tunnel (P1)**: BLOCKED - platform infrastructure issue

## Upcoming Tasks
- Championship Winner Predictions feature
- Stripe integration for National League
- Re-enable email verification
- Push Notifications
- Refactor server.py (too large)

## Key Credentials
- Admin: admin@fantapronostic.com / admin123
- League Owner: ilio@raimondi.it / password123
- League Owner (National): desiree@raimondi.it / Roberto95

## 3rd Party Integrations
- API-Football (sports data)
- Emergent-managed Google Auth
- Stripe (planned)
