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
- Frontend: React Native (Expo) con expo-router
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

## Current Status (March 2026)
- **P0 RESOLVED**: Fix crash Vivo V50 - scoping bugs useTranslation() in 6 helper functions + API response guards + ErrorBoundary migliorato con component stack
- **PENDING USER VERIFICATION**: Crash fix richiede nuova build nativa

## Prioritized Backlog
### P0
- [x] Fix crash Vivo V50 (code fix done, needs build)

### P1
- [ ] Backfill trofei storici (Palmares) - endpoint admin
- [ ] Cambio icona app Android
- [ ] Verifica EAS OTA workflow su GitHub Actions

### P2
- [ ] Trofei campione lega/torneo
- [ ] Riattivare predizioni vincitore campionato
- [ ] Breakdown punti per tipo predizione nel profilo
- [ ] Stripe in produzione
- [ ] Fix scheduling torneo RedBull (circle method già implementato, serve decisione utente)

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
