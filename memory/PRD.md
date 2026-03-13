# FantaPronostic - Product Requirements Document

## Original Problem Statement
App di pronostici sportivi con sistema di leghe, tornei e classifiche. L'utente prevede risultati di partite e accumula punti.

## Core Requirements
- **Global Integer Scoring**: 1X2=2, Goal/Over=1, Esatto=5
- **Context-Aware Navigation**: Tab "Pronostici" naviga dinamicamente
- **Lifecycle Management**: Season/League/Tournament states con auto-completion e palmares
- **Season Configuration**: total_matchdays + current_matchday guidano tutta la logica
- **League Matchday Constraint**: Dropdown limitati a giornate giocabili (no retro-attive)
- **Admin Dashboard**: Dashboard operativa con metriche corrette e drill-down
- **Admin Matches/Seasons CRUD**: Pagine admin complete per gestione partite e stagioni

## Season Model
```
{
  name: "Serie A 2025-2026",
  year: "2025-2026",
  total_matchdays: 38,
  current_matchday: 26,
  status: "active"  // draft | active | completed | archived
}
```

## League Matchday Range Logic
- `first_selectable = season.current_matchday` (se la giornata corrente e LIVE/COMPLETED, +1)
- `last_matchday = season.total_matchdays`
- Esempio: current=26, total=38 → range selezionabile: 26-38
- Validazione backend + dropdown frontend dinamici

## Completed Features
- [x] Auth, Leghe, Tornei, Pronostici, Live scores, Classifiche
- [x] Admin Panel, BOOST X3, Tournament 1v1 live view
- [x] Admin Dashboard + Partite CRUD
- [x] Season/League Lifecycle (draft/active/completed/archived)
- [x] **Season Configuration Fields** (13/03/2026) - Testato 100%
  - total_matchdays e current_matchday nel modello Season
  - Admin edit modal per modificare tutti i parametri stagione
  - Colonne "Giornate" e "Giornata Attuale" nella tabella stagioni
- [x] **League Matchday Range Fix** (13/03/2026) - Testato 100%
  - Range dinamico basato su season.current_matchday → season.total_matchdays
  - Frontend mobile: fetch /leagues/matchday-range, dropdown limitati
  - Admin UI: dropdown limitati + info "Range giornate disponibili: G26 → G38"
  - Backend validation: blocca start_matchday < first_selectable
  - Endpoint pubblico GET /leagues/matchday-range per mobile app

## Prioritized Backlog

### P1 - Next Up
- [ ] Trophy System - Backfill trofei retroattivi
- [ ] Trophy - Campione Lega/Torneo
- [ ] Tournament Scheduling Fix (torneo "RedBull")

### P2 - Future
- [ ] Championship Winner Predictions
- [ ] Integrazione Stripe
- [ ] Breakdown punti per tipo nel profilo

## Key Data State
- Season: "Serie A 2025-2026" (status=active, total_matchdays=38, current_matchday=26)
- Matchdays: G1-G25 COMPLETED, G26 DRAFT
- Selectable range: 26-38

## Credentials
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
