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

### File:
- Backend: `/app/backend/routes/payments.py` (emergentintegrations Stripe SDK)
- Frontend: `/app/frontend/app/league/create.tsx` (UI condizionale)
- Frontend: `/app/frontend/app/league/payment-success.tsx` (polling + success)
- DB: `payment_transactions` collection

### Campi League:
- `custom_matches_enabled: true`
- `custom_matches_paid: true`
- `payment_id: string`

## Admin UI Lega Nazionale (COMPLETATO - 14 Mar 2026)
- entry_fee, league_type, is_system nel form creazione e modifica
- Sezione "Impostazioni di Sistema" Super Admin only
- Backend API aggiornato per nuovi campi

## i18n Refactoring (COMPLETATO)
- Tutte le stringhe in react-i18next (IT, EN, ES)

## Task Pendenti
### P0
- Migrazione dati preview → produzione (BLOCCATO - serve MONGO_URL produzione)

### P1
- Fix navigazione tab "Pronostici" per tornei (bug critico UX)
- Fix scheduling round-robin torneo "RedBull"
- Backfill trofei storici
- Trofei campione lega e torneo

### P2
- Riattivare "Pronostici vincitore campionato"
- Breakdown punti nel profilo

## Credenziali Test
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
