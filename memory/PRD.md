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
- **Home Gamification v2 (Elegant)**

## Recent Changes (Feb 2026)

### Home Gamification v2 (Feb 21)
Complete redesign of the Home screen for elegant gamification:
1. **Matchday Card** - Dynamic micro-messages: OPEN→countdown, LIVE→"In corso", COMPLETED→"Hai fatto X punti"
2. **Performance Card** - Replaced rigid stat table with narrative layout: large position (1°), total/matchday/avg stats
3. **Trend Bar Chart** - Replaced colored circles with elegant mini bar chart (orange highlight on latest matchday)
4. **Visual Hierarchy** - Orange reserved for CTA only, better spacing, premium feel
5. **Weekly Goal** - New motivational section: "Fai almeno X punti per mantenere il Y° posto"
6. **Removed**: Old "Stats coming soon" placeholder, colored circles, live preview card (merged into matchday card)

Files changed:
- `/app/frontend/app/(tabs)/home.tsx` - Complete rewrite
- `/app/frontend/src/components/ui/LastFiveIndicator.tsx` - Bar chart redesign
- `/app/frontend/src/i18n/locales/{it,en,es}/common.json` - New gamification keys

### Smart Predictions Tab (Feb 21)
- Created shared `goToPredictionsHub()` in `/app/frontend/src/utils/navigation.ts`
- Predictions tab mirrors Home CTA logic (OPEN→edit, LOCKED→readonly, LIVE→live screen, COMPLETED→results)

## Pending Issues
- **i18n "Save Prediction" bug (P0)**: User verification pending after Metro cache clear
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
