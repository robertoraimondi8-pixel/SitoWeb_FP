# FantaPronostic - PRD

## Problema Originale
App di pronostici calcistici con sistema di leghe, tornei, classifiche e punteggi. Full-stack: React Native (Expo) + FastAPI + MongoDB.

## Requisiti Core
- Sistema leghe con pronostici, live, risultati
- Sistema tornei con round-robin, knockout, 1v1
- Admin panel esterno (/api/admin-ui)
- BOOST X3 per match con moltiplicatore
- Navigazione context-aware per tab Pronostici
- Palmares (trofei) per utenti
- i18n completa (IT, EN, ES) con react-i18next
- Regolamento context-aware (regole diverse per leghe vs tornei)
- Admin panel: Lega Nazionale con entry_fee, league_type, is_system, season_id
- **Stripe: Leghe custom a pagamento (89,99 EUR)**
- **Push Notifications: Expo Push per notifiche real-time su dispositivi**

## Monetizzazione Leghe (COMPLETATO - 14 Mar 2026)
### Modello:
- **Lega Nazionale** (match_source=national) → GRATIS
- **Partite Personalizzate** (match_source=custom) → 89,99 EUR via Stripe

### Flusso:
1. Utente seleziona "Personalizzate" nel form creazione
2. Badge "89,99 EUR" e nota informativa compaiono
3. Pulsante diventa "PAGA E CREA LEGA - 89,99 EUR"
4. Click → checkout Stripe → pagamento → redirect a /league/payment-success
5. Polling status pagamento → creazione lega automatica
6. Pagina successo con codice invito

## Push Notifications (COMPLETATO - 16 Mar 2026)
### Implementazione:
- **Frontend**: `expo-notifications` + `expo-device` + `expo-constants` installati
- **Hook**: `usePushNotifications` registra token push automaticamente al login
- **Plugin**: `expo-notifications` aggiunto ad `app.json` (richiede native rebuild)
- **Backend**: Token push salvati in `push_tokens` collection
- **Expo Push API**: Notifiche inviate via `https://exp.host/--/api/v2/push/send`

### Trigger automatici:
1. **Partite importate in giornata OPEN** → notifica a tutti i membri della lega
2. **Apertura iscrizioni torneo** → notifica a TUTTI gli utenti
3. **Giornata aperta (OPEN)** → notifica a membri lega (pre-esistente)
4. **Classifica aggiornata (COMPLETED)** → notifica a membri lega (pre-esistente)
5. **Broadcast admin** → notifica manuale a tutti/lega specifica

### File:
- Frontend: `/app/frontend/src/hooks/usePushNotifications.ts`
- Frontend: `/app/frontend/app/(tabs)/_layout.tsx` (integrazione hook)
- Backend: `/app/backend/services.py` (send_expo_push, create_notification)
- Backend: `/app/backend/routes/fixtures.py` (notifica dopo import)
- Backend: `/app/backend/routes/admin.py` (notifica apertura torneo)
- Backend: `/app/backend/routes/tournaments.py` (notifica apertura torneo)

## Bug Fix: Import Partite Lega Nazionale (COMPLETATO - 16 Mar 2026)
- Problema: "Questa lega usa le partite della Lega Nazionale" errore quando admin importa partite
- Causa: Lega Nazionale non ha `match_source_type` + check `is_super` non usava `is_super_admin`
- Fix: Bypass check per `league_type == "national"` e per utenti con `is_super_admin`

## Task Pendenti
### P0
- EAS OTA Update: `runtimeVersion: "1.0.0"` aggiunto, in attesa verifica utente

### P1
- Fix navigazione tab "Pronostici" per tornei (bug critico UX)
- Stripe production key su Railway (azione utente)
- Backfill trofei storici
- Trofei campione lega e torneo

### P2
- Riattivare "Pronostici vincitore campionato"
- Breakdown punti nel profilo
- Migrazione dati preview → produzione

## Note Importanti
- Push notifications funzionano SOLO su dispositivi fisici (non web preview)
- L'aggiunta di `expo-notifications` plugin richiede un nuovo native build (eas build)
- OTA update NON basta per questa modifica - serve rebuild .ipa/.aab

## Credenziali Test
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
- Production Admin: `robertoraimondi8@gmail.com` / `admin123`
- Test Account (Google Review): `test@fantapronostic.com` / `Test1234!`
