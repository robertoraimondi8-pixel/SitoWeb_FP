# FantaPronostic - Product Requirements Document

## Original Problem Statement
App di pronostici sportivi con sistema di leghe, tornei e classifiche. L'utente prevede risultati di partite e accumula punti.

## Core Requirements
- **Global Integer Scoring**: 1X2=2, Goal/Over=1, Esatto=5
- **Context-Aware Navigation**: Tab "Pronostici" naviga dinamicamente
- **Visual Hierarchy**: Matchday card con metrica primaria prominente + messaggio contestuale
- **Mini Ranking**: Blocco competitivo sulla Home (classifica lega / girone torneo)
- **Simplified Last 5**: Pills semplici al posto del bar chart per il trend

## Completed Features
- [x] Auth (JWT + Google OAuth), Leghe, Tornei, Pronostici, Live scores, Classifiche
- [x] Admin Panel, BOOST X3, Tournament 1v1 live view
- [x] P0 Navigation fix, Global scoring refactor, Data migration, Decimal formatting
- [x] Gerarchia visiva matchday card + messaggi contestuali
- [x] Fix classifica punti bianchi 4°+, dropdown settimanale, TREND torneo
- [x] **Mini Classifica Home** (12/03/2026)
  - Lega: Top 3 classifica totale con highlight utente corrente
  - Torneo: Top 3 classifica girone utente con group_points
  - "Vedi classifica →" link al tab Classifiche
- [x] **Ultime 5 Giornate Pills** (12/03/2026)
  - Lega: 5 pills con punti + numeri giornata sotto
  - Torneo: Pills solo per sfide completate
  - Valori > 0 evidenziati in arancione (#F7A21B)
  - Layout: Hero → Mini Ranking → Performance → Last 5 Pills
  - Testato: 100% backend + frontend (iteration_82)

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
