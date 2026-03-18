# FantaPronostic PRD

## Original Problem Statement
App di pronostici calcistici con sistema di leghe e tornei. React Native (Expo) frontend + FastAPI backend + MongoDB.

## Core Requirements
- Sistema leghe con pronostici, classifiche, live, risultati
- Sistema tornei (round-robin, knockout)
- Admin panel esterno (`/api/admin-ui`)
- Push notifications per eventi chiave
- Stabilità su tutti i dispositivi Android (Google Play Internal Testing)
- OTA updates automatici via GitHub Actions

## Architecture
- Frontend: React Native (Expo SDK 54) con expo-router
- Backend: FastAPI (Python) con MongoDB
- Deploy: Railway (backend) + MongoDB Atlas (DB)
- CI/CD: GitHub Actions per EAS OTA updates

## What's Been Implemented
- Sistema leghe completo (CRUD, pronostici, live, risultati, classifiche)
- Sistema tornei (admin panel, round-robin, knockout, matchups 1v1)
- Push notifications (expo-notifications)
- Admin panel (`/api/admin-ui`) per gestione leghe e tornei
- BOOST X3 visual treatment per match con moltiplicatore
- ErrorBoundary + setupErrorHandlers per crash prevention
- Dynamic NATIONAL_LEAGUE_ID resolution
- SafeArea handling per bottom tab bar Android
- ProGuard keep rules per expo-linear-gradient (fix crash Vivo V50)

## Current Status (March 2026)
- **P0 RESOLVED (code)**: Fix crash Vivo V50 - Root cause: ProGuard/R8 stripping expo-linear-gradient native code in release builds. Fix: expo-build-properties con ProGuard keep rules.
- **PENDING USER VERIFICATION**: Richiede nuova build nativa (`eas build`)

## Root Cause Analysis - Vivo V50 Crash
- **Error**: `Cannot read property 'map' of undefined` in `LinearGradient` component
- **Root Cause**: Known expo-linear-gradient bug (#21562). ProGuard/R8 strips `LinearGradientView.java` constructor in release builds
- **Fix**: Added `expo-build-properties` with `-keep class expo.modules.lineargradient.** { *; }` ProGuard rule
- **Additional defensive fixes**: useTranslation() scoping in 6 helper functions, Array.isArray() guards on API responses

## Prioritized Backlog
### P0
- [x] Fix crash Vivo V50 (ProGuard rules + defensive code, needs build)

### P1
- [ ] Backfill trofei storici (Palmares) - endpoint admin
- [ ] Cambio icona app Android
- [ ] Verifica EAS OTA workflow su GitHub Actions

### P2
- [ ] Trofei campione lega/torneo
- [ ] Riattivare predizioni vincitore campionato
- [ ] Breakdown punti per tipo predizione nel profilo
- [ ] Stripe in produzione
- [ ] Fix scheduling torneo RedBull (circle method già implementato)

## 3rd Party Integrations
- API-Football (API-Sports)
- Expo (EAS, Push Notifications)
- APScheduler
- SendGrid
- Railway (hosting)
- MongoDB Atlas
- Google OAuth

## Test Accounts
- Admin prod: robertoraimondi8@gmail.com / admin123
- User preview: ilio@raimondi.it / password123
- Test Google Review: test@fantapronostic.com / Test1234!

## Key Files Modified (This Session)
- `/app/frontend/app.json` - Added expo-build-properties plugin with ProGuard rules
- `/app/frontend/src/components/ErrorBoundary.tsx` - Added component stack display
- `/app/frontend/src/components/MatchDetailSheet.tsx` - Fixed useTranslation() scoping in 4 helpers
- `/app/frontend/src/components/MatchPreviewSheet.tsx` - Fixed useTranslation() scoping in FormRow
- `/app/frontend/app/(tabs)/statistics.tsx` - Fixed formatRound scoping
- `/app/frontend/app/(tabs)/home.tsx` - Array.isArray() guard on tournaments API
- `/app/frontend/src/contexts/LeagueContext.tsx` - Array.isArray() guard on leagues API
- `/app/frontend/src/components/TournamentView.tsx` - Safe destructuring for matches
