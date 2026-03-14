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

## Completed (13/03/2026 - Latest Session)
- [x] **Tournament Control Room** - Sostituzione completa della pagina "Modifica" con Control Room a 5 tab
- [x] **Elimination Bracket Visualization** - Barra progressione fasi con bracket eliminazione e matchup cards
- [x] **Dynamic Round Naming** - Round eliminazione calcolati dinamicamente dal numero di qualificati (groups × advance). Es: 16 qualificati → Ottavi → Quarti → Semi → Finale
- [x] **Impersonate User** - Pulsante "Accedi come utente" nella User Control Room (solo Super Admin), con endpoint POST /api/admin/impersonate/{user_id}, audit log, sessione autenticata completa con banner arancione e pulsante "Esci"
- [x] **Auth Provider Badges** - Badge colorati (EMAIL, GOOGLE, APPLE, FACEBOOK) nella lista utenti e nella User Control Room, supporto provider futuri
- [x] **Push Notification History** - Storico notifiche migliorato con badge tipo (BROADCAST, DIRETTO, AUTO, GIORNATA, CLASSIFICA), colonna Destinatari/Scope, supporto notifiche automatiche con deduplicazione
- [x] **Push Notification Preview** - Anteprima mobile in tempo reale nel form broadcast con titolo, messaggio, immagine opzionale e icona app
- [x] **Stripe Payments Admin** - Username+email cliccabili (apre User Control Room), badge stato colorati (pending=blu, paid=verde, failed=rosso, expired=grigio, refunded=viola), colonna "Oggetto" (League/Tournament name), link "Stripe →" per dashboard, filtri completi con conteggi
- [x] **Backend API tornei** - Nuovi endpoint: PUT update, GET/POST/DELETE participants, POST reset-groups
- [x] **Bug Fix: Admin UI JS Parse Error** - Fixed quote escaping in showLeagueStandings
- [x] **Colonna "Progressione" Lista Leghe** - Giornata corrente vs totale con barra di progresso
- [x] **Pulsante "Apri Classifica" in Control Room Leghe** - Modale classifica completa
- [x] **Bug Fix: Match Import duplicated function** - Rinominata funzione duplicata `doImportFixtures`
- [x] **Matchday Control Room parity** - Tab "Partite" con funzionalità complete (Edit, Delete, X3, Status, Score)

## Completed (13/03/2026 - Trophy System)
- [x] **Trophy System - Campione Lega** - Logica `award_league_trophies` con fallback da `score_summaries` quando `standings_cache` è vuoto. Assegna Campione, 2° e 3° classificato.
- [x] **Trophy System - Campione Torneo** - Fix bug critici (field names errati: `round_name`→`label`, `round_order`→`round_number`, `round_id`→`round_number+round_type`). Protezione per tornei non completati.
- [x] **Trophy Backfill Retroattivo** - Endpoint `POST /api/admin/trophies/backfill` che processa tutte le giornate completate (1524 processate, 48 trofei assegnati). Duplicati ignorati automaticamente.
- [x] **Admin Pagina Trofei** - Nuova sezione "Trofei" nel pannello admin con statistiche, distribuzione per tipo, backfill, e tabella trofei recenti.
- [x] **Award Trophies da Control Room** - Pulsanti "Assegna Trofei" in Zona Pericolo di League e Tournament Control Room.
- [x] **Trophy Stats API** - Endpoint `GET /api/admin/trophies/stats` con totale, per tipo, e trofei recenti.
- [x] **Season completion trophy integration** - `complete_season` ora chiama `award_tournament_trophies` per tornei completati.

## Completed (13/03/2026 - Tiebreak System)
- [x] **League Tiebreak Rules** - Ordinamento classifica: Punti → Indovinati → Esatti → 1X2 → Random. Implementato nell'endpoint `/standings/total` e nella `standings_cache`.
- [x] **Tournament Knockout Tiebreak** - Risoluzione matchup 1v1 con stessa logica tiebreak. Quando i punti sono pari: confronto indovinati → esatti → 1X2 → random. Salva `tiebreak_reason` sul matchup.
- [x] **Nuovi campi per-giornata** - `total_correct_predictions`, `exact_score_hits`, `one_x_two_hits`, `over_under_hits`, `goal_nogol_hits` salvati in `score_summaries` e aggregati in `standings_cache`.
- [x] **Colonna "Indovinati" Classifica Mobile** - Colonna "Ind." nel tab Totale della classifica dell'app.
- [x] **Colonna "Indovinati/Esatti/1X2" Admin** - Classifica admin con tutte e 3 le colonne aggiuntive per spiegare spareggi.
- [x] **UI Tiebreak Torneo** - Indicatore "Vince per tiebreak: [motivo]" nella hero card del matchup 1v1 e nelle righe matchup della classifica torneo.
- [x] **Backfill Tiebreak Stats** - Endpoint `POST /api/admin/backfill-tiebreak-stats` ricalcola statistiche da predictions esistenti (90 summaries, 50 cache aggiornate).
- [x] **Admin Backfill Button** - Pulsante "Esegui Backfill Tiebreak" nella pagina Trofei admin.
- [x] **`total_correct_predictions`** = 1X2 + Over/Under + Goal/NoGoal + Esatti corretti (somma di TUTTI i mercati corretti)

## Completed (14/03/2026 - Standings UI Improvement)
- [x] **Rimossa label "Ind."** - La colonna separata accanto ai punti è stata eliminata.
- [x] **Stats come metadata** - Le statistiche (Correct X · Exact Y · 1X2 Z) ora appaiono come riga secondaria sotto il nome del giocatore.
- [x] **Layout unificato** - Stesso layout sia per classifica Totale che Settimanale.
- [x] **Punti rimangono elemento primario** - I punti restano l'elemento visivo principale a destra.
- [x] **Weekly standings con exact_correct** - Aggiunto il campo `exact_correct` anche alla classifica settimanale.

## Completed (14/03/2026 - Standings UI Refinement)
- [x] **Lista principale semplificata** - Mostra solo "Indovinati X" sotto il nome (rimossi Esatti e 1X2 dalla lista)
- [x] **Vista dettaglio utente con stats tiebreak** - Sezione "Statistiche Spareggio" con Indovinati, Risultati esatti, 1X2 indovinati e nota ordine spareggio
- [x] **Labels in italiano** - Indovinati, Risultati esatti, 1X2 indovinati
- [x] **Stessa regola per Totale e Settimanale** - Entrambe le viste mostrano solo "Indovinati" nella lista

## Completed (14/03/2026 - Tournament Groups UI + Regolamento)
- [x] **Qualification highlight dinamico** - Il numero di righe evidenziate in verde corrisponde a `qualified_per_group` dalla configurazione torneo (non più fisso a 2)
- [x] **Messaggio qualificazione** - "I primi X giocatori di ogni girone si qualificano per la fase a eliminazione diretta" sopra ogni tabella girone
- [x] **Tab Regolamento** - Quarto tab nel torneo con: struttura torneo, formato knockout (dinamico), regole tiebreak (4 livelli), regole gironi (3/1/0 punti)
- [x] **API gruppi migliorata** - Ritorna `qualifies`, `advance_count`, `players_per_group`, `groups_count` + statistiche tiebreak per giocatore
- [x] **Tiebreak classifica gironi** - Ordinamento: punti girone → punti pronostici → indovinati → esatti → 1X2

## Prioritized Backlog

### P1 - Next Up
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
