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
- [x] **Admin Dashboard Metric Correctness** (13/03/2026) - Testato 100%
- [x] **Admin Matches Management Page "Partite"** (13/03/2026) - Testato 100%
  - Tabella partite con colonne: Partita, Risultato, Stato, Giornata, Competizione, Kickoff, Azioni
  - Filtri: Tutte, Live, Programmate, Finite, Inconsistenti, Senza risultato
  - Modal Modifica: Gol Casa/Trasferta, Stato, Kickoff
  - Elimina con conferma e supporto force per partite con pronostici
  - Dashboard drill-down corretto (Live ora -> status:live, Inconsistenti -> filter:inconsistent)
  - Fix route conflict FastAPI: endpoint consolidati, duplicati rimossi

## Prioritized Backlog

### P1 - Next Up
- [ ] **Trophy System - Backfill**: Endpoint admin per trofei retroattivi
- [ ] **Trophy - League/Tournament Champion**: Logica per campioni
- [ ] **Tournament Scheduling Fix**: Decidere come gestire torneo "RedBull"

### P2 - Future
- [ ] Championship Winner Predictions
- [ ] Integrazione Stripe
- [ ] Breakdown punti per tipo nel profilo

## Credentials
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
