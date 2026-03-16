# FantaPronostic - PRD

## Problema Originale
App di pronostici calcistici con sistema di leghe, tornei, classifiche e punteggi. Full-stack: React Native (Expo) + FastAPI + MongoDB.

## Architettura
- **Frontend**: React Native (Expo) con expo-router
- **Backend**: FastAPI su Railway
- **Database**: MongoDB Atlas (produzione)
- **Admin Panel**: Server-side rendered via Jinja2 a `/api/admin-ui`

## Requisiti Core
- Sistema leghe con pronostici, live, risultati
- Sistema tornei con round-robin, knockout, 1v1
- Admin panel esterno (/api/admin-ui)
- BOOST X3 per match con moltiplicatore
- Palmares (trofei) per utenti
- i18n (IT, EN, ES) con react-i18next
- Stripe per leghe custom a pagamento (89,99 EUR)
- Push Notifications via Expo Push

## Bug Fix Critico: NATIONAL_LEAGUE_ID Dinamico (16 Mar 2026)
- **Problema**: L'app su produzione mostrava "Nessuna giornata" perché `NATIONAL_LEAGUE_ID` era hardcoded con l'ID della preview locale. Su Railway/MongoDB Atlas la lega nazionale ha un ID diverso.
- **Fix**: `init_national_league_id()` risolve l'ID dal DB all'avvio del server. Tutti i route file (user, admin, fixtures, leagues, live, predictions, standings, rbac) ora leggono `services.NATIONAL_LEAGUE_ID` a runtime.
- **File modificati**: `services.py`, `server.py`, + 8 route files

## Push Notifications (16 Mar 2026)
- Frontend: `expo-notifications` + hook `usePushNotifications` in `_layout.tsx`
- Backend: Trigger automatici per giornata OPEN e apertura torneo
- Plugin `expo-notifications` in `app.json` (richiede native rebuild)

## Bug Fix: Import Partite Lega Nazionale (16 Mar 2026)
- Fix check permessi: bypass per `is_super_admin` e `league_type == "national"`

## Task Completati
- [x] Sistema leghe completo
- [x] Sistema tornei completo
- [x] Admin panel (CRUD leghe, tornei, giornate, partite)
- [x] BOOST X3 UI
- [x] Stripe integration (standard library)
- [x] Email verification (SendGrid)
- [x] Google OAuth
- [x] EAS config (eas.json, app.json)
- [x] GitHub Actions per OTA updates
- [x] Legal pages (privacy, terms, delete-account)
- [x] Test account per Google Review
- [x] Push notifications (frontend + backend)
- [x] NATIONAL_LEAGUE_ID dinamico

## Task Pendenti
### P0
- [ ] Verificare deploy su Railway e giornata visibile

### P1
- [ ] Fix navigazione tab "Pronostici" per tornei
- [ ] Stripe production key su Railway
- [ ] Backfill trofei storici
- [ ] Trofei campione lega e torneo

### P2
- [ ] Riattivare "Pronostici vincitore campionato"
- [ ] Breakdown punti nel profilo
- [ ] Migrazione dati preview → produzione

## Credenziali Test
- Preview User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
- Production Admin: `robertoraimondi8@gmail.com` / `admin123`
- Test Account (Google Review): `test@fantapronostic.com` / `Test1234!`
