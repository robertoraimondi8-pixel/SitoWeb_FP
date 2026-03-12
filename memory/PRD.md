# FantaPronostic - Product Requirements Document

## Original Problem Statement
App di pronostici sportivi con sistema di leghe, tornei e classifiche. L'utente prevede risultati di partite e accumula punti.

## Core Requirements
- **Global Integer Scoring**: 1X2=2, Goal/Over=1, Esatto=5
- **Context-Aware Navigation**: Tab "Pronostici" naviga dinamicamente
- **Visual Hierarchy**: Matchday card con metrica primaria prominente + messaggio contestuale
- **Mini Ranking**: Blocco competitivo sulla Home (classifica lega / girone torneo)
- **Simplified Last 5**: Pills semplici al posto del bar chart per il trend
- **Unified Tournament/League Layout**: Home screen identica per struttura e spaziature

## Completed Features
- [x] Auth (JWT + Google OAuth), Leghe, Tornei, Pronostici, Live scores, Classifiche
- [x] Admin Panel, BOOST X3, Tournament 1v1 live view
- [x] P0 Navigation fix, Global scoring refactor, Data migration, Decimal formatting
- [x] Gerarchia visiva matchday card + messaggi contestuali
- [x] Fix classifica punti bianchi 4+, dropdown settimanale, TREND torneo
- [x] **Mini Classifica Home** (12/03/2026)
- [x] **Ultime 5 Giornate Pills** (12/03/2026)
- [x] **Unificazione Layout Tournament/League Home** (13/03/2026)
  - scrollContent gap:24 identico
  - marginHorizontal:16 su miniRankCard e last5Card
  - Rimosso marginBottom da heroCard e perfCardOuter
  - Fix sectionLabel duplicato (ora marginLeft:4)
  - Performance section in <View> wrapper (non fragment)
  - Shadow heroCard identico alla lega
  - Testato: 95% frontend (iteration_83)

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
