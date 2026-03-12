# FantaPronostic - Product Requirements Document

## Original Problem Statement
App di pronostici sportivi con sistema di leghe, tornei e classifiche. L'utente prevede risultati di partite e accumula punti. Sistema completo con admin panel, gestione giornate, live scores e profili utente.

## Core Requirements
- **Global Integer Scoring**: Punteggi fissi globali (1X2=2, Goal/Over=1, Esatto=5). Nessun valore custom per lega.
- **Market Selection**: Le leghe private possono solo abilitare/disabilitare mercati (1X2, Goal/Over, Esatto), non i valori dei punti.
- **Multiplier x3**: Funziona con i nuovi punteggi base (es. esatto su match x3 = 15 punti).
- **Context-Aware Navigation**: Tab "Pronostici" naviga dinamicamente in base alla competizione selezionata e stato della giornata.
- **Admin Panel**: Gestione completa leghe e tornei in `/api/admin-ui`.
- **Tournament System**: Round-robin con "circle method", gironi, knockout, matchup 1v1.

## Tech Stack
- **Frontend**: React Native (Expo) Web
- **Backend**: FastAPI + MongoDB
- **3rd Party**: API-Football, Expo Push, APScheduler, SendGrid

## What's Been Implemented

### Completed Features
- [x] Sistema di autenticazione (JWT + Google OAuth)
- [x] Sistema leghe (creazione, iscrizione, gestione)
- [x] Sistema tornei (admin panel, round-robin, gironi, knockout)
- [x] Pronostici e calcolo punteggi
- [x] Live scores (API-Football integration)
- [x] Classifiche (totali, settimanali, profilo utente)
- [x] Admin Panel completo (`/api/admin-ui`)
- [x] BOOST X3 visual treatment
- [x] Tournament 1v1 live view
- [x] P0 Navigation fix - Tab "Pronostici" con routing dinamico
- [x] Global scoring refactor (1X2=2, Goal/Over=1, Esatto=5)
- [x] Data migration script per punteggi storici
- [x] **Rimozione formattazione decimale** - Tutti i punti mostrati come interi puri (12/03/2026)
  - Backend: `int()` wrapping su tutte le risposte API (standings, home, predictions, live, tournaments)
  - Frontend: `.toString()` dopo `Math.round()` per evitare rendering "0.0" su React Native Web
  - Verificato con testing agent: 100% backend + frontend

## Prioritized Backlog

### P1 - Next Up
- [ ] **Trophy System - Backfill**: Endpoint admin per assegnare retroattivamente trofei per eventi passati (pendente da 3 sessioni)
- [ ] **Trophy - League Champion**: Logica per assegnare trofeo campione lega
- [ ] **Trophy - Tournament Champion**: Logica per assegnare trofeo campione torneo
- [ ] **Tournament Scheduling Fix**: Decidere con utente come gestire torneo "RedBull" creato con algoritmo vecchio (eliminare/ricreare vs script fix)

### P2 - Future
- [ ] Championship Winner Predictions (codice pronto, nascosto)
- [ ] Integrazione Stripe per iscrizioni a pagamento
- [ ] Breakdown punti per tipo nel profilo utente

### Known Issues
- Team Name Overlap Bug (UI minore, non verificato)

## Key API Endpoints
- `GET /api/home` - Home screen data
- `GET /api/standings/total` - Classifica totale
- `GET /api/standings/weekly/{id}` - Classifica settimanale
- `GET /api/predictions` - Pronostici giornata
- `GET /api/live/{id}` - Partite live
- `GET /api/tournaments` - Lista tornei
- `POST /api/admin/tournaments` - Crea torneo (admin)

## DB Schema (Key Collections)
- `leagues`, `memberships`, `matchdays`, `matches`
- `predictions`, `score_summaries`, `joker_usages`
- `tournaments_col`, `tournament_rounds_col`, `tournament_matchups_col`
- `users`, `trophies`, `notifications`

## Credentials
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
