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
- **Home Gamification v2 (Elegant) - with refinements**

## Recent Changes (Feb 2026)

### Home Gamification v2 Refinements (Feb 22)
- Trend bars: unified to brand orange (38% opacity for past, 100% for current). No grey/blue.
- Performance labels: "Questa giornata" instead of "Punti giornata"
- Weekly Goal: REMOVED (no reliable backend logic for meaningful targets)

### Home Gamification v2 (Feb 21)
- Card Giornata: dynamic micro-messages (OPEN→countdown, LIVE→"In corso", COMPLETED→"Hai fatto X punti")
- Performance Card: large position (1°) + total/matchday/avg stats, vertical layout
- Trend Bar Chart: replaced colored circles
- Visual hierarchy: orange only for CTA, neutral secondaries

### Smart Predictions Tab (Feb 21)
- Shared `goToPredictionsHub()` in navigation.ts

## Pending Issues
- **i18n "Save Prediction" bug (P0)**: User verification pending
- **Expo Go Tunnel (P1)**: BLOCKED

## Upcoming Tasks
- Championship Winner Predictions feature
- Stripe integration for National League
- Re-enable email verification
- Push Notifications
- Refactor server.py

## Key Credentials
- Admin: admin@fantapronostic.com / admin123
- League Owner: ilio@raimondi.it / password123
- League Owner (National): desiree@raimondi.it / Roberto95
