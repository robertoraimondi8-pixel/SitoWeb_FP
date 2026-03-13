# FantaPronostic - Product Requirements Document

## Original Problem Statement
App di pronostici sportivi con sistema di leghe, tornei e classifiche. L'utente prevede risultati di partite e accumula punti.

## Core Requirements
- **Global Integer Scoring**: 1X2=2, Goal/Over=1, Esatto=5
- **Context-Aware Navigation**: Tab "Pronostici" naviga dinamicamente
- **Visual Hierarchy**: Matchday card con metrica primaria prominente + messaggio contestuale
- **Mini Ranking**: Blocco competitivo sulla Home (classifica lega / girone torneo)
- **Simplified Last 5**: Pills semplici (punti per leghe, V/P/S per tornei)
- **Unified Tournament/League Layout**: Home screen identica per struttura e spaziature
- **Real Prediction Scores**: Punteggi pronostico reali su hero card e performance
- **Admin Dashboard Control Center**: Dashboard operativa con metriche corrette e drill-down
- **Admin Matches Management**: Pagina "Partite" con CRUD completo (filtra, modifica, elimina)
- **Lifecycle Management**: Season/League/Tournament states con auto-completion e palmares

## Lifecycle States
### Seasons: draft -> active -> completed -> archived
- **draft**: creata ma non ancora usata
- **active**: stagione corrente e giocabile
- **completed**: stagione finita, classifiche congelate, vincitori determinati
- **archived**: storica, visibile solo nel palmares

### Leagues: draft -> active -> completed -> cancelled
- Auto-completion quando end_matchday raggiunta e tutte le partite finite
- Vincitore e top 3 salvati nel palmares

### League Creation Constraints
- start_matchday >= prima giornata ancora giocabile (non retro-attiva)
- end_matchday <= ultima giornata della stagione
- Dropdown dinamici nell'admin UI

## Completed Features
- [x] Auth (JWT + Google OAuth), Leghe, Tornei, Pronostici, Live scores, Classifiche
- [x] Admin Panel, BOOST X3, Tournament 1v1 live view
- [x] P0 Navigation fix, Global scoring refactor, Data migration, Decimal formatting
- [x] Gerarchia visiva matchday card + messaggi contestuali
- [x] Fix classifica punti bianchi 4+, dropdown settimanale, TREND torneo
- [x] Mini Classifica Home + Ultime 5 Giornate Pills
- [x] Unificazione Layout Tournament/League Home
- [x] Ultime 5 Sfide V/P/S per tornei
- [x] Fix punteggi reali torneo (hero card + performance)
- [x] Messaggio "Hai fatto X punti su 10 partite"
- [x] Admin Dashboard Overhaul + Scadenze Pronostici
- [x] Admin Dashboard Metric Correctness (13/03/2026)
- [x] Admin Matches Management Page "Partite" (13/03/2026) - Testato 100%
- [x] **Season/League Lifecycle Management** (13/03/2026) - Testato 100%
  - Season states (draft/active/completed/archived) con transizioni admin
  - League states (draft/active/completed/cancelled) con auto-completion
  - Matchday range constraint per creazione leghe (no retro-attive)
  - Admin UI: badge stato stagioni/leghe, pulsante "Completa Stagione"
  - Admin UI: dropdown giornata dinamici nella creazione lega
  - Stagione corrente aggiornata a "Serie A 2025-2026"
  - Collezione palmares per risultati storici persistenti
  - 61 leghe migrated a status 'active'
  - Auto-completion hook nel flusso COMPLETED matchday

## Prioritized Backlog

### P1 - Next Up
- [ ] **Trophy System - Backfill**: Endpoint admin per trofei retroattivi
- [ ] **Trophy - League/Tournament Champion**: Logica per campioni (collegata al lifecycle)
- [ ] **Tournament Scheduling Fix**: Decidere come gestire torneo "RedBull"

### P2 - Future
- [ ] Championship Winner Predictions
- [ ] Integrazione Stripe
- [ ] Breakdown punti per tipo nel profilo

## Key Data State
- Season: "Serie A 2025-2026" (status=active)
- Matchdays: G1-G25 COMPLETED, G26 DRAFT
- National League: start_matchday=1, end_matchday=38
- Selectable range for new leagues: 26-26

## Credentials
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
