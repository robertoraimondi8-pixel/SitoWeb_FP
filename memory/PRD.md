# FantaPronostic - Product Requirements Document

## Original Problem Statement
App di pronostici sportivi con sistema di leghe, tornei e classifiche. L'utente prevede risultati di partite e accumula punti. Sistema completo con admin panel, gestione giornate, live scores e profili utente.

## Core Requirements
- **Global Integer Scoring**: Punteggi fissi globali (1X2=2, Goal/Over=1, Esatto=5)
- **Market Selection**: Le leghe private abilitano/disabilitano mercati, non valori punti
- **Multiplier x3**: Funziona con punteggi base (es. esatto x3 = 15 punti)
- **Context-Aware Navigation**: Tab "Pronostici" naviga dinamicamente per competizione/stato
- **Admin Panel**: Gestione completa leghe e tornei in `/api/admin-ui`
- **Tournament System**: Round-robin "circle method", gironi, knockout, matchup 1v1
- **Visual Hierarchy**: Card matchday con metrica primaria prominente + messaggio contestuale

## Tech Stack
- **Frontend**: React Native (Expo) Web
- **Backend**: FastAPI + MongoDB
- **3rd Party**: API-Football, Expo Push, APScheduler, SendGrid

## Completed Features
- [x] Auth (JWT + Google OAuth), Leghe, Tornei, Pronostici, Live scores, Classifiche
- [x] Admin Panel, BOOST X3, Tournament 1v1 live view
- [x] P0 Navigation fix, Global scoring refactor, Data migration
- [x] Rimozione formattazione decimale
- [x] Gerarchia visiva matchday card + messaggi contestuali
- [x] **Fix classifica punti bianchi 4°+ posto** (12/03/2026) - Top 3 arancio/oro, 4°+ bianco
- [x] **Fix dropdown settimanale Lega Nazionale** (12/03/2026) - Mostra tutte 25 giornate (1-25)
- [x] **Fix TREND torneo** (12/03/2026) - Solo round completati + spaziatura corretta
- [x] **Migrazione matchup torneo float→int** (12/03/2026) - 126 matchup migrati

## Prioritized Backlog

### P1 - Next Up
- [ ] **Trophy System - Backfill**: Endpoint admin per assegnare retroattivamente trofei
- [ ] **Trophy - League Champion**: Logica per campione lega
- [ ] **Trophy - Tournament Champion**: Logica per campione torneo
- [ ] **Tournament Scheduling Fix**: Decidere come gestire torneo "RedBull" con algoritmo vecchio

### P2 - Future
- [ ] Championship Winner Predictions
- [ ] Integrazione Stripe
- [ ] Breakdown punti per tipo nel profilo

### Known Issues
- Team Name Overlap Bug (UI minore, non verificato)
- Tournament matchup points may not be 100% accurate for old data (migrated from float by rounding, not recalculated from predictions)

## Credentials
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`
