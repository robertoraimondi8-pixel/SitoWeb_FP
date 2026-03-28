# FantaPronostic PRD

## Original Problem Statement
App di pronostici calcistici con sistema di leghe e tornei. React Native (Expo) frontend + FastAPI backend + MongoDB.

## Architecture
- Frontend: React Native (Expo SDK 54) con expo-router
- Backend: FastAPI (Python) con MongoDB
- Deploy: Railway (backend) + MongoDB Atlas (DB)
- CI/CD: GitHub Actions per EAS OTA updates

## Current Status (March 2026)

### Google OAuth Direct Flow — COMPLETATO
Migrazione da Emergent-managed Google Auth a flusso diretto:
- Backend: `/api/auth/google/verify-token` verifica id_token via `google-auth` library
- Frontend: `login.tsx` usa `expo-auth-session/providers/google` con 3 Client ID (Web, Android, iOS)
- Redirect URI: `fantapronostic://callback` (scheme in app.json)
- Legacy endpoint `/api/auth/google/session` mantenuto per backward compat
- `callback.tsx` è legacy (usato dal vecchio flusso Emergent), può essere rimosso in futuro

### Pronostici Tab Navigation Fix — COMPLETATO
Bug ricorrente da 3+ fork risolto architetturalmente:
- **Rimossa** tutta la logica di redirect da `predictions.tsx` (redirect a `/live/` e `/(tabs)/home`)
- **Unico punto decisionale**: tab listener in `_layout.tsx` (righe 142-166)
- Logica: se matchday è LIVE/COMPLETED → intercetta tab press e naviga a:
  - League: `/live/{matchdayId}?league_id={leagueId}`
  - Tournament: `setPendingMatchupOpen` + navigate a `/(tabs)/home` (TournamentView apre il matchup)
- Se matchday è OPEN → nessun intercept → predictions.tsx mostra form editabile

### Stabilizzazione App (sessioni precedenti) — COMPLETATO
- Fix crash iOS (Hermes patterns)
- Fix crash Android Vivo V50 (AAB split APK, newArchEnabled: false)
- Fix Google Sign-In state corruption
- Fix App Logout crash (safe context defaults)
- Fix OTA updates (channel: production)
- UI/UX fixes (hamburger menu, scroll Android, delete account, bottom tabs safe area)
- Live Data Refresh robustificato (circuit breaker, diagnostica admin)

## Prioritized Backlog

### P0
- [x] Fix crash iOS statistics screen tabs
- [x] Fix crash iOS match detail sheet
- [x] Fix TUTTI i pattern `!= null`/`== null` nel frontend (7 file)
- [x] Fix crash Vivo V50 LinearGradient (code done, needs native build)
- [x] Fix Live Data Refresh (circuit breaker, logging, diagnostica admin)
- [x] Fix Google Sign-In Android crash/stuck
- [x] Fix hamburger menu touch area Android
- [x] Fix onboarding lingua
- [x] Fix delete account
- [x] Fix verify email
- [x] Google OAuth Direct Flow (no Emergent dependency)
- [x] Fix navigazione tab "Pronostici" (routing dinamico in _layout.tsx)

### P1
- [ ] Backfill trofei storici (Palmares)
- [ ] Push notifications end-to-end verification (blocked on Railway deploy)
- [ ] Email service fix (SendGrid 401) (blocked on user action)

### P2
- [ ] Trofei campione lega/torneo
- [ ] Riattivare predizioni vincitore campionato
- [ ] Stripe in produzione

## Test Accounts
- Admin prod: robertoraimondi8@gmail.com / admin123
- Admin preview: admin@fantapronostic.com / admin123
- User preview: ilio@raimondi.it / password123
- Test Google Review: test@fantapronostic.com / Test1234!

## Key Endpoints
- `POST /api/auth/google/verify-token` - Verifica id_token Google diretto
- `POST /api/auth/google/session` - Legacy Emergent auth (backward compat)
- `GET /api/admin/real-fixtures/live-status` - Diagnostica sistema live refresh
- `POST /api/admin/real-fixtures/refresh-live` - Forza refresh manuale
- `POST /api/admin/real-fixtures/reset-circuit-breaker` - Reset circuit breaker

## 3rd Party Integrations
- Google OAuth (User Client IDs) — Direct flow via expo-auth-session
- API-Football (API-Sports) — Match data
- Expo Application Services (EAS) — Build & OTA
- SendGrid — Emails
