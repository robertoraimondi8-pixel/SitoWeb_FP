# FantaPronostic PRD

## Original Problem Statement
App di pronostici calcistici con sistema di leghe e tornei. React Native (Expo) frontend + FastAPI backend + MongoDB.

## Architecture
- Frontend: React Native (Expo SDK 54) con expo-router
- Backend: FastAPI (Python) con MongoDB
- Deploy: Railway (backend) + MongoDB Atlas (DB)
- CI/CD: GitHub Actions per EAS OTA updates

## Current Status (March 2026)

### Resolved (code-level, pending OTA deployment)
- ✅ Fix crash iOS Statistics screen tabs (useTranslation removed from FixturesWithRoundPicker)
- ✅ Fix crash iOS MatchDetailSheet (dettaglio partita) - NUOVA FIX:
  - Rimosso useTranslation() da TUTTI i componenti figli (EventsList, EventRow, StatsComparison, LineupsView)
  - Sostituiti operatori loose equality (!=, ==) con strict equality (!==, ===)
  - Aggiunto optional chaining (?.) su TUTTE le proprieta partita
  - Aggiunto fallback values: score mostra '-' se null, statistiche mostrano 0, loghi placeholder
  - Sanitizzazione risposta API nel useEffect (Array.isArray guards)
- ✅ Fix crash iOS MatchPreviewSheet (FormRow) - rimosso useTranslation da componente figlio
- ✅ Fix strict equality in statistics.tsx (f.home_goals, f.away_goals)
- ✅ patch-package fix per expo-linear-gradient (Vivo V50)
- ✅ expo-build-properties con ProGuard keep rules
- ✅ Push notifications logging + diagnostics endpoint
- ✅ ErrorBoundary con component stack display
- ✅ Stripe integration per leghe custom

### Pending User Action
- OTA update per JS-only fixes (statistics crash + match detail crash)
- Deploy Railway (backend: push logging, email logging)
- New native build iOS + Android (ProGuard, patch-package)
- SendGrid API key regeneration (401 Unauthorized)
- Verify PUSH_NOTIFICATIONS_ENABLED=true su Railway

## Prioritized Backlog
### P0
- [x] Fix crash iOS statistics screen tabs (VERIFIED - iteration_103)
- [x] Fix crash iOS match detail sheet (VERIFIED - iteration_104)
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

## Files Modified in This Session
- /app/frontend/src/components/MatchDetailSheet.tsx (REWRITTEN - null safety + removed useTranslation from children)
- /app/frontend/src/components/MatchPreviewSheet.tsx (FIXED - FormRow, h2h null safety)
- /app/frontend/app/(tabs)/statistics.tsx (FIXED - strict equality for scores)
