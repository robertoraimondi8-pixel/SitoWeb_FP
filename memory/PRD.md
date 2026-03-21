# FantaPronostic PRD

## Original Problem Statement
App di pronostici calcistici con sistema di leghe e tornei. React Native (Expo) frontend + FastAPI backend + MongoDB.

## Architecture
- Frontend: React Native (Expo SDK 54) con expo-router
- Backend: FastAPI (Python) con MongoDB
- Deploy: Railway (backend) + MongoDB Atlas (DB)
- CI/CD: GitHub Actions per EAS OTA updates

## Current Status (March 2026)

### CRITICAL: iOS Crash Fix - Completato
Il crash iOS era causato da 2 pattern pericolosi nel motore Hermes:
1. `useTranslation()` nei componenti figli (non top-level)
2. Operatori loose equality (`!=`, `==`) su valori null/undefined
Fix applicato su 7 file. Zero pattern pericolosi rimasti.

### Live Data Refresh - MIGLIORATO
Il sistema di refresh live dei punteggi dalle API-Football è stato significativamente migliorato:
- Circuit breaker ridotto da 3600s a 300s (configurabile via env `APIFOOTBALL_CIRCUIT_BREAKER_COOLDOWN`)
- Backoff progressivo (300s → 600s → 1200s... max 3600s) invece di cooldown fisso
- Auto-reset del circuit breaker al primo successo API
- Tracking `last_live_update` timestamp per ogni match
- Log dettagliati per debugging in produzione
- 3 nuovi endpoint admin: `/live-status`, `/refresh-live` (migliorato), `/reset-circuit-breaker`
- Pannello diagnostico nella Dashboard Admin UI

### Azioni richieste all'utente
1. **Deploy Railway**: per portare i fix del live refresh in produzione
2. **Verificare API key**: API-Football key potrebbe essere scaduta/sospesa
3. **Test Live Refresh**: Usare il pannello admin per monitorare lo stato del refresh durante partite live

## Prioritized Backlog

### P0
- [x] Fix crash iOS statistics screen tabs
- [x] Fix crash iOS match detail sheet
- [x] Fix TUTTI i pattern `!= null`/`== null` nel frontend (7 file)
- [x] Fix crash Vivo V50 LinearGradient (code done, needs native build)
- [x] Fix Live Data Refresh (circuit breaker, logging, diagnostica admin)

### P1
- [ ] Fix navigazione tab "Pronostici" per tornei (routing dinamico in _layout.tsx)
- [ ] Backfill trofei storici (Palmares)
- [ ] Push notifications end-to-end verification (blocked on Railway deploy)
- [ ] Email service fix (SendGrid 401) (blocked on user action)

### P2
- [ ] Trofei campione lega/torneo
- [ ] Riattivare predizioni vincitore campionato
- [ ] Stripe in produzione

## Test Accounts
- Admin prod: robertoraimondi8@gmail.com / admin123
- User preview: ilio@raimondi.it / password123
- Test Google Review: test@fantapronostic.com / Test1234!

## Key Endpoints
- `GET /api/admin/real-fixtures/live-status` - Diagnostica sistema live refresh
- `POST /api/admin/real-fixtures/refresh-live` - Forza refresh manuale
- `POST /api/admin/real-fixtures/reset-circuit-breaker` - Reset circuit breaker
