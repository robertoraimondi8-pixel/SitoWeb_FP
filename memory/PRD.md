# FantaPronostic - PRD

## Problem Statement
Fantasy sports prediction app where users join leagues, predict match outcomes, and compete on leaderboards.

## Core Architecture
- Frontend: React Native (Expo) - web + mobile
- Backend: FastAPI + MongoDB
- Auth: JWT + Google OAuth
- Sports Data: API-Football

## What's Been Implemented
- Auth, Leagues, Matchdays, Predictions, Rankings, Admin, i18n, Joker
- Smart navigation hub (shared routing)
- Home Gamification v2 (elegant)
- National League (free, 3 members)
- **LeagueContext as single source of truth** for active league across all screens

## Recent Changes (Feb 2026)

### P0 Fix: League Scoping (Feb 22)
- **P0-1 Fixed**: Home now uses `LeagueContext.activeLeague` instead of local state. Resets data/countdown when league changes.
- **P0-2 Fixed**: Rankings removed multi-league tabs. Shows only active league from context.
- All screens (Home, Rankings, Predictions) now use `LeagueContext` as single source of truth.

### Bug Fix: Back Button (Feb 22)
- Predictions tab uses `router.replace` for smart redirect (prevents loop)
- Live screen back button always goes to Home

### National League Setup (Feb 22)
- Free, 10 members (admin, desiree, ilio + test users)

### Home Gamification v2 + Refinements (Feb 21-22)
- Dynamic matchday card, Performance card, Trend bar chart
- Orange-only bars, natural labels, Weekly Goal removed

## Pending Issues
- i18n "Save Prediction" bug (P0): User verification pending
- Expo Go Tunnel (P1): BLOCKED

## Upcoming Tasks
- Championship Winner Predictions
- Stripe for National League
- Email verification
- Push Notifications
- Refactor server.py

## Credentials
- Admin: admin@fantapronostic.com / admin123
- League Owner: ilio@raimondi.it / password123
- League Owner: desiree@raimondi.it / Roberto95
