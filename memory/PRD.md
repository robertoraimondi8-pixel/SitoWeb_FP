# FantaPronostic PRD

## Original Problem Statement
App di pronostici calcistici con sistema di leghe e tornei. React Native (Expo) frontend + FastAPI backend + MongoDB.

## Architecture
- Frontend: React Native (Expo SDK 54) con expo-router
- Backend: FastAPI (Python) con MongoDB
- Deploy: Railway (backend) + MongoDB Atlas (DB)
- CI/CD: GitHub Actions per EAS OTA updates

## Current Status (March 2026)

### Resolved (code-level, pending deployment)
- ✅ Fix crash iOS `EXC_BAD_ACCESS abstractEqualityTest` in statistics/fixtures screen
  - Root cause: `useTranslation()` hook in `FixturesWithRoundPicker` child component
  - Fix: Removed `useTranslation()` from child component, hardcoded Italian strings
  - Extra: Replaced loose equality `!= null` with strict `!== null && !== undefined` in fixture score rendering (Hermes safety)
- ✅ Fix scoping `useTranslation()` in 6 helper functions (MatchDetailSheet, MatchPreviewSheet, statistics)
- ✅ Fix `formatRound` scoping bug
- ✅ Array.isArray() guards on all API responses
- ✅ patch-package fix for expo-linear-gradient (Vivo V50)
- ✅ expo-build-properties with ProGuard keep rules
- ✅ Push notifications logging + diagnostics endpoint
- ✅ ErrorBoundary with component stack display
- ✅ Stripe integration for custom-matches leagues

### Pending User Action
- Deploy to Railway (backend changes: push logging, email logging)
- New native build for iOS + Android (ProGuard, patch-package)
- OTA update for JS-only fixes (statistics crash)
- SendGrid API key regeneration (401 Unauthorized)
- Verify PUSH_NOTIFICATIONS_ENABLED=true on Railway

## Prioritized Backlog
### P0
- [x] Fix crash iOS statistics screen (VERIFIED by testing agent - iteration_103)
- [x] Fix crash Vivo V50 LinearGradient (code done, needs native build)

### P1
- [ ] Push notifications end-to-end verification (blocked on Railway deploy)
- [ ] Email service fix (SendGrid 401) (blocked on user action)
- [ ] Backfill trofei storici (Palmares)
- [ ] Fix navigazione tab "Pronostici" per tornei

### P2
- [ ] Trofei campione lega/torneo
- [ ] Riattivare predizioni vincitore campionato
- [ ] Stripe in produzione

## Test Accounts
- Admin prod: robertoraimondi8@gmail.com / admin123
- User preview: ilio@raimondi.it / password123
- Test Google Review: test@fantapronostic.com / Test1234!
