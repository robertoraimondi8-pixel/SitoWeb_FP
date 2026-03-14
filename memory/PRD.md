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
- Testo criteri di spareggio nel regolamento
- Live wording corretto (presente durante LIVE, passato dopo COMPLETED)
- Admin panel: Lega Nazionale con entry_fee, league_type, is_system, season_id

## Lega Nazionale Admin UI (COMPLETATO - 14 Mar 2026)
### Campi aggiunti:
- `entry_fee` (EUR) - campo numerico nel form creazione e modifica
- `league_type` (national/private) - dropdown nel form creazione e modifica
- `is_system` (bool) - checkbox nel form creazione e modifica
- Sezione "Impostazioni di Sistema" visibile solo a Super Admin
- Info tab mostra Tipo Lega e Entry Fee
- Edit tab permette modifica di entry_fee, match_source_type, league_type, is_system

### File modificati:
- `/app/backend/admin_ui.py` - showCreateLeagueModal, renderCrInfo, renderCrEdit, doEditRules, doCreateLeague
- `/app/backend/routes/rbac.py` - rbac_get_leagues (aggiunto entry_fee, is_system nella risposta)

## i18n Refactoring (COMPLETATO - 14 Mar 2026)
### File di traduzione aggiornati:
- `/app/frontend/src/i18n/locales/it/common.json` - Italiano (completo)
- `/app/frontend/src/i18n/locales/en/common.json` - English (completo)
- `/app/frontend/src/i18n/locales/es/common.json` - Espanol (completo)

## Regolamento Context-Aware (COMPLETATO - 14 Mar 2026)
- `rules.tsx` legge dati dal livello root del torneo (non da settings)
- Usa scoring_config default per tornei
- Mostra regole diverse per leghe e tornei
- Include criteri di spareggio

## Live Wording Update (COMPLETATO - 14 Mar 2026)
- Lega LIVE: "Stai facendo X punti su Y partite"
- Lega COMPLETED: "Hai fatto X punti su Y partite"
- Torneo LIVE: "Stai vincendo/perdendo/Sei in parita"
- Torneo COMPLETED: "Hai vinto/perso/pareggiato"

## Task Pendenti
### P0
- Migrazione dati preview -> produzione (BLOCCATO - serve MONGO_URL produzione)

### P1
- Fix navigazione tab "Pronostici" per tornei (bug critico di UX)
- Fix scheduling round-robin torneo "RedBull"
- Backfill trofei storici
- Trofei campione lega e torneo

### P2
- Riattivare "Pronostici vincitore campionato"
- Integrazione Stripe
- Breakdown punti nel profilo

## Credenziali Test
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
