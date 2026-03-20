# FantaPronostic PRD

## Original Problem Statement
App di pronostici calcistici con sistema di leghe e tornei. React Native (Expo) frontend + FastAPI backend + MongoDB.

## Architecture
- Frontend: React Native (Expo SDK 54) con expo-router
- Backend: FastAPI (Python) con MongoDB
- Deploy: Railway (backend) + MongoDB Atlas (DB)
- CI/CD: GitHub Actions per EAS OTA updates

## Current Status (March 2026)

### CRITICAL: iOS Crash Fix - Completato, in attesa OTA
Il crash iOS e' causato da 2 pattern pericolosi nel motore Hermes:
1. `useTranslation()` nei componenti figli (non top-level)
2. Operatori loose equality (`!=`, `==`) su valori null/undefined

**Fix applicato su 7 file:**
- `MatchDetailSheet.tsx` - RISCRITTO: rimosso useTranslation da 4 componenti figli, null safety completa
- `MatchPreviewSheet.tsx` - rimosso useTranslation da FormRow, null safety h2h
- `statistics.tsx` - strict equality per score
- `live/[id].tsx` - strict equality per elapsed
- `TournamentView.tsx` - strict equality per predictions e elapsed
- `home.tsx` - strict equality per punti
- `menu/rules.tsx` - strict equality per scoring values

**RISULTATO: Zero pattern `!= null` / `== null` rimasti nell'intero frontend.**

### Il crash log mostra ErrorRecovery.crash()
Questo e' il crash loop di Expo Error Recovery DOPO il crash originale.
La sequenza e': click partita con dati null -> crash Hermes -> app si riavvia -> Expo Error Recovery non riesce a recuperare -> SIGABRT.
Il fix nel codice risolve la ROOT CAUSE. Serve OTA update per portarlo sul dispositivo.

### Azioni richieste all'utente per sbloccare
1. **OTA Update**: `eas update --branch production` per pubblicare i fix JS
2. **Se crash loop persiste**: disinstallare e reinstallare l'app da TestFlight (cancella bundle corrotto)
3. **Native build Android (Vivo V50)**: `eas build --platform android --profile production`
4. **Deploy Railway**: per push notifications e email logging
5. **SendGrid**: verificare/rigenerare API key

## Prioritized Backlog
### P0
- [x] Fix crash iOS statistics screen tabs (VERIFIED - iteration_103)
- [x] Fix crash iOS match detail sheet (VERIFIED - iteration_104)
- [x] Fix TUTTI i pattern `!= null`/`== null` nel frontend (7 file)
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
