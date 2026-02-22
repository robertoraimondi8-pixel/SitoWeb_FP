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
- Home Gamification v2 (Elegant)
- National League setup (free, with 3 initial members)

## Recent Changes (Feb 2026)

### Bug Fix: Back Button from Live Screen (Feb 22)
- Fixed infinite redirect loop: Predictions tab now uses `router.replace` (not `push`) to avoid back→predictions→redirect→live loop
- Back button on live screen always navigates to Home via `router.replace('/(tabs)/home')`

### National League Setup (Feb 22)
- Lega Nazionale FantaPronostic set as free (no Stripe required)
- Added members: admin@fantapronostic.com (admin), desiree@raimondi.it (player), ilio@raimondi.it (player)
- Total members: 10 (including test users from previous sessions)

### Home Gamification v2 Refinements (Feb 22)
- Trend bars: unified to brand orange (38% opacity for past, 100% for current)
- Performance labels: "Questa giornata" instead of "Punti giornata"
- Weekly Goal: REMOVED (no reliable backend logic)

### Home Gamification v2 (Feb 21)
- Card Giornata: dynamic micro-messages (OPEN→countdown, LIVE→In corso, COMPLETED→Hai fatto X punti)
- Performance Card: large position (1°) + total/matchday/avg stats
- Trend Bar Chart: replaced colored circles
- Visual hierarchy: orange only for CTA

### Smart Predictions Tab (Feb 21)
- Shared `goToPredictionsHub()` in navigation.ts

## Pending Issues
- **i18n "Save Prediction" bug (P0)**: User verification pending
- **Expo Go Tunnel (P1)**: BLOCKED - platform issue

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

## National League
- ID: f1373417-43aa-4043-b6a2-125873181c95
- Name: Lega Nazionale FantaPronostic
- Type: national
- Status: free (no payment required)
- Members: admin@fantapronostic.com, desiree@raimondi.it, ilio@raimondi.it + 7 test users
