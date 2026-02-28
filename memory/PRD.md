# FantaPronostic - Product Requirements Document

## Original Problem Statement
Fantasy football predictions app where users join leagues, make match predictions, and compete on leaderboards. Built with React Native (Expo) frontend + FastAPI backend + MongoDB.

## Core Architecture
- **Backend**: FastAPI monolith (`/app/backend/server.py`) with MongoDB
- **Frontend**: React Native (Expo) at `/app/frontend/`
- **Database**: MongoDB (fantapronostic)
- **External APIs**: API-Football (API-Sports), Emergent Google Auth

## Data Isolation Model (NON-NEGOTIABLE)
Every league is an independent universe. All data must be strictly scoped by league_id.

### Predictions: unique per `(user_id, match_id, league_id)`
- Compound unique index: `user_match_league_unique`
- All prediction queries MUST include league_id filter

### Score Summaries: unique per `(user_id, matchday_id, league_id)`
- Compound unique index: `user_matchday_league_unique`
- All score_summaries queries MUST include league_id filter

## What's Been Implemented
- User auth (JWT + Google OAuth)
- League creation, joining, management
- Match predictions with multiple market types
- Live scoring and match status updates
- Standings (total, weekly, user profile)
- Admin panel for matchday management
- API-Football integration
- Full multi-league data isolation (Feb 22, 2026)
- Jolly removal (Feb 22, 2026)
- **Classifica LIVE** (Feb 22, 2026)
- **In-App Notification Center** (Feb 24, 2026) - Bell icon with unread badge in header, notifications page with mark-all-as-read on open
- **Push Notification Infrastructure** (Feb 26, 2026) - Expo Push API integration, push token management, reminder scheduler (24h/2h before deadline). Disabled by default, activate via PUSH_NOTIFICATIONS_ENABLED=true env var
- **Email Change in Profile** (Feb 26, 2026) - Users can change email with password confirmation. Also fixed change_password bug (password not fetched from DB)
- **RBAC System - STEP 0 Foundations** (Feb 28, 2026) - Full RBAC backend with:
  - `roles` collection with 4 default system roles (Super Admin, Moderatore, Gestore Leghe, Osservatore)
  - 12 granular permissions (admin.dashboard.view, admin.seasons.manage, etc.)
  - `require_permission()` middleware factory for endpoint-level access control
  - `is_super_admin` flag on users (bypasses all permission checks)
  - `role_ids[]` on users for multi-role assignment
  - Full RBAC API: `/api/rbac/permissions`, `/api/rbac/roles` (CRUD), `/api/rbac/users` (list + assign roles + super_admin toggle)
  - Enhanced audit logging: actor_roles, IP, before/after snapshots
  - Bootstrap on startup: creates default roles, marks admin as SUPER_ADMIN
  - Files: `permissions.py`, updated `database.py`, `models.py`, `server.py`
- **RBAC STEP 1 - Admin UI** (Feb 28, 2026) - Full web admin dashboard with RBAC:
  - Permission-based sidebar menu (sections only visible if user has corresponding permission)
  - Ruoli & Permessi page: list roles, create custom role with permission checkboxes, edit role, delete with strong "DELETE" confirmation
  - Gestione Utenti page: user list with search/filter, counter cards, assign/remove roles (multi-role), disable/enable accounts, super admin toggle
  - 403 "Accesso Non Autorizzato" page for unauthorized access
  - Security: `SUPER_ADMIN_EMAIL` env var (no hardcoded email), last super admin protection, disabled account check on every API call
  - Files: `admin_ui.py` (new), updated `auth.py`, `server.py`
- **RBAC STEP 2A - Migrazione require_admin → require_permission** (Feb 28, 2026):
  - Migrati tutti i 20 endpoint admin da `require_admin` a `require_permission` granulare
  - Mappatura: seasons→admin.seasons.manage, matchdays→admin.matchdays.manage, matches→admin.matches.manage, leagues→admin.leagues.manage, payments→admin.payments.view, audit→admin.audit.view, score-summaries→admin.dashboard.view, fixtures/refresh-live→admin.matches.manage
  - `require_admin` completamente rimosso da server.py
  - Testato con 3 ruoli: Super Admin (tutto), Osservatore (solo audit/payments/dashboard), Gestore Leghe (seasons/matchdays/matches/leagues)
  - Zero modifiche a scoring, classifiche, DB schema, match import
- **Admin Governance Utenti/Leghe** (Feb 28, 2026):
  - Tab Utenti: colonne leghe_create/admin/member (cliccabili), ultimo login, soft-delete con protezione orfani
  - Soft-delete: conferma forte "DELETE", blocca se utente e' unico admin/owner di leghe (409 + lista leghe orfane)
  - Tab Leghe: mostra owner, admin, membri, pulsante "Gestisci"
  - Gestisci lega: trasferisci ownership, promuovi/rimuovi admin lega
  - `last_login` tracciato ad ogni login
  - Tutto loggato in audit con before/after
- **Dashboard Overview - STEP 3** (Feb 28, 2026):
  - Home del pannello admin con 5 sezioni KPI (Utenti, Leghe, Giornate, Pagamenti, Attivita Recente)
  - Leghe a rischio evidenziate con alert rosso + link Gestisci
  - Mobile responsive con hamburger menu
  - Endpoint: GET /api/rbac/dashboard-stats
- **Dashboard Navigabile + Allarmi Critici** (Feb 28, 2026):
  - Blocco "Allarmi Critici" in cima: leghe senza owner/admin, pagamenti pending, giornate OPEN/LIVE (cliccabili)
  - Ogni KPI cliccabile naviga alla sezione con filtro pre-applicato
  - Filtri aggiunti: Giornate per stato, Leghe per rischio + ricerca, Pagamenti per stato
  - Pattern: navigateWith(page, filter) → render_page consuma filtro e lo resetta
- **Enhanced User Management - STEP U1, U2, U3** (Feb 28, 2026):
  - **U1**: Dashboard KPIs "Nuovi 7gg" e "Login 24h" cliccabili (navigano a utenti con filtro). Aggiunto indicatore "Online ora" con pallino pulsante verde. Aggiunti filtri "Nuovi ultimi 7gg" e "Login ultime 24h" nel dropdown utenti.
  - **U2**: Pulsante "Dettagli" su ogni riga utente. Modale con campi modificabili username e email. Endpoint PUT /api/rbac/users/{user_id} con validazione formato username e unicita email. Audit log completo.
  - **U3**: Pulsante "Genera Link Reset Password" nel modale utente. Endpoint POST /api/rbac/users/{user_id}/reset-password-link genera token sicuro (SHA256 hash, scadenza 24h). Pagina pubblica GET /api/reset-password con form per impostare nuova password. Endpoint POST /api/reset-password valida token e aggiorna password. Token precedenti invalidati automaticamente. Link mostrato all'admin per invio manuale (no email service integrato).
  - Files: server.py (3 nuovi endpoint + 1 pagina pubblica), admin_ui.py (get_reset_password_html + UI modale + filtri), database.py (password_resets collection)
- **Sprint U-CR: User Control Room** (Feb 28, 2026):
  - Pulsante unico "Control Room" per ogni utente (sostituisce Dettagli/Ruoli/Disabilita/Elimina/Promuovi SA)
  - 4 Tab: Info & Profilo (griglia ID/email/username/auth/date/stato online-offline/ruoli RBAC/contatori leghe), Modifica (edit username/email + reset password + Zona Pericolo con disabilita/abilita, super admin toggle, soft delete con conferma DELETE), Leghe & Ruoli (lista leghe utente + assegnazione ruoli RBAC con checkbox), Attivita (audit log entries come attore o target)
  - Nuovo endpoint: GET /api/rbac/users/{user_id}/audit-log (filtro per admin_id OR entity_id)
  - Tutte le azioni restano nel modale (refresh in-place senza chiudere)
- **Creazione Utente e Lega da Admin** (Feb 28, 2026):
  - Pulsante "+ Nuovo Utente" nella pagina utenti con modale completo: Nome, Cognome, Email, Username (opzionale, auto-generato), Data Nascita, Password (min 8), Indirizzo, Citta, Paese, CAP. Endpoint POST /api/rbac/users/create con validazione email unica, username unico, email verificata e consensi auto-accettati.
  - Pulsante "+ Nuova Lega" nella pagina leghe con modale completo: Nome (3-40 char), Stagione (dropdown), Tipo Sorgente Match (Nazionale/Custom), Minuti prima del fischio, Giornata Inizio/Fine, Pronostici Campionato, Mercati e Punteggi (checkbox + punti). Endpoint POST /api/rbac/leagues/create con owner automatico (admin) e membership attiva. Audit log per entrambe le azioni.
- **Sprint L1 - Dashboard Leghe KPI Cliccabili** (Feb 28, 2026):
  - 5 KPI nella card Leghe: Totale, Nazionale (verde), Private Custom (blu), Private Naz. (teal), A Rischio (rosso)
  - Tutti cliccabili con filtro tipo pre-applicato sulla pagina leghe
  - Backend dashboard-stats arricchito con national_count, private_custom_count, private_national_count
- **Sprint L2 - League Control Room** (Feb 28, 2026):
  - Pulsante unico "Control Room" per ogni lega (sostituisce Dettaglio + Gestisci)
  - 3 tab: Info & Regole (griglia completa + tabella mercati/punteggi), Modifica (form completo), Team & Admin (owner + trasferimento + membri con promozione/rimozione admin)
  - Tab Modifica: edita TUTTI i campi lega: Nome, Mercati (checkbox + punti), Giornata Inizio/Fine, Minuti prima del fischio d'inizio, Pronostici Campionato
  - Warning ATTENZIONE rosso + doppia conferma (browser confirm + confirm=true API)
  - Solo Super Admin puo modificare, non-super-admin bloccati (403)
  - Validazione nome 2-60 caratteri, audit log completo
- **League Governance Fixes (5 correzioni)** (Feb 28, 2026):
  - **Fix 1**: Colonna "Admin Lega" nella tabella leghe - conta admin a livello lega (da memberships role=admin/owner), non RBAC.
  - **Fix 2**: Lega Nazionale esclusa dagli alert "a rischio". Owner mostrato come "Sistema". Alert "senza admin" solo per leghe private custom.
  - **Fix 3**: 3 badge tipo lega visivamente distinti: NAZIONALE (verde), PRIVATA NAZ. (teal), PRIVATA CUSTOM (blu). Filtro dropdown per tipo. Leghe private-national escluse da alert "senza admin".
  - **Fix 4**: Colonna "Regole" nella tabella con riassunto sintetico (mercati:punti | Gx-y | Xmin). Modale "Dettaglio Lega" con griglia info completa + tabella mercati e punteggi.
  - **Fix 5**: Super Admin puo modificare regole lega dal pannello (PUT /api/rbac/leagues/{id}/rules). Modale edit con warning rosso ATTENZIONE, conferma forte (confirm=true + browser confirm), audit log. Non-super-admin bloccati con 403.

## Changes Applied

### P1 - API-Football Import per Leghe Private (Feb 22, 2026) - COMPLETED
Extended the national league's API-Football import to private leagues with `match_source_type: "api"`.
- **Backend**:
  - Added `"api"` to all ~10 `match_source_type` checks so API-type leagues own their matchdays/matches (like manual leagues).
  - Updated `_require_league_admin` to allow API-type league owners to manage matchdays.
  - Changed fixtures search/leagues auth from `require_admin` to `get_current_user` (read-only).
  - Changed fixtures import auth: super admin OR owner of target API-type league.
  - `admin_v3_leagues` returns `_can_manage_matches=true` for API-type leagues.
- **Frontend**:
  - League creation: Added third option "Partite da API" (`match_source_type: "api"`).
  - Admin panel: Shows "Importa Partite Reali" + "Risultati Live" for API-type leagues (not just national).
- **NOT touched**: National league logic, scoring, DB schema, existing match management for manual leagues.


Real-time live standings integrated into the existing Weekly Rankings screen.
- **Backend**:
  - `get_home()`: Added live ranking computation (live_rank, live_points, total_members) when matchday is LIVE
  - `get_weekly_standings()`: Shows ALL league members for LIVE matchdays (including 0-point users). Added `matchday_status` to response. Computes effective matchday status.
  - `get_available_matchdays()`: Includes OPEN/LIVE matchdays even without predictions. Computes effective status for OPEN matchdays.
  - `get_user_predictions_transparency()`: Fixed LIVE match points calculation — added `"live"` to match status check so live matches with scores calculate points on the fly (was treating them as "pending" with 0 pts).
  - NO new endpoints created. NO DB changes. NO score_summaries writes.
- **Frontend**:
  - Home: Replaced LIVE points box with "Classifica LIVE" button showing provisional rank + points. Click navigates to Rankings > Weekly with LIVE matchday auto-selected.
  - Rankings: Reads navigation params (tab, matchdayId). Auto-switches to weekly tab + selects LIVE matchday. Shows LIVE banner and green styling.
  - User-predictions: Added "Nessun pronostico" empty state for users without predictions.
- **NOT touched**: Scoring logic, score_summaries, COMPLETED matchday behavior, admin flows.

### P0 - League Data Isolation (Feb 22, 2026) - COMPLETED
Enforced `league_id` on all score_summaries queries.

### P0 - Multi-League Predictions Architecture (Feb 22, 2026) - COMPLETED
Predictions unique per `(user_id, match_id, league_id)`. Score summaries unique per `(user_id, matchday_id, league_id)`.

### P1 - Jolly Removal (Feb 22, 2026) - COMPLETED
**Approach**: Neutralize at input, zero changes to math functions.
- **Backend**: `joker_active = False` forced at all 5 input points. 3 joker endpoints removed.
- **Frontend**: Jolly toggle banner removed from predictions screen. Jolly x2 badge removed from rankings. Bonus Jolly row + JOLLY ATTIVO banner removed from live screen.
- **NOT touched**: calculate_match_points(), calculate_matchday_total(), database schema, indexes.

### Bug Fix - Import Button Condition (Feb 22, 2026) - COMPLETED
Fixed logical bug in `frontend/app/admin/index.tsx` where the "Importa Partite Reali" section was not visible for private leagues with `match_source_type: "national"`. The condition checked for `_is_national`, `'api'`, `'custom'`, and `'manual'` but missed `'national'`. Fixed by replacing with `['api', 'custom', 'national'].includes(match_source_type)`.

### Bug Fix - Import Duplicate Check Scoped per League (Feb 22, 2026) - COMPLETED
Fixed critical data isolation bug in `backend/server.py` `real_fixtures_import()`: the duplicate check for `external_fixture_id` was **global** (across all leagues), preventing custom/api leagues from importing matches already present in other leagues (e.g., the National League). Fixed by adding `"league_id": req.league_id` to the duplicate query filter — each league is now independent.

### Bug Fix - X3 Multiplier Ignored at COMPLETED (Feb 23, 2026) - COMPLETED
Critical scoring bug: `_calculate_matchday_scores` called `calculate_match_points` without `multiplier` parameter, defaulting to 1.0. X3 bonus worked during LIVE but was lost when matchday transitioned to COMPLETED. Fixed by adding `m.get("multiplier", 1.0)` to both occurrences. Also fixed:
- `recalculate_user_total_standings`: replaced find+insert with `update_one(upsert=True)` to prevent DuplicateKeyError
- `standings_cache` index: recreated with `user_id` to allow per-user records
- `force_recalculate_matchday`: added super admin bypass
- All 8 affected matchdays ricalculated to correct historical scores

Fixed bug in `frontend/app/admin/index.tsx` where `selectedMatchday` state was not updated when `matchdays` were reloaded. This caused `first_kickoff` (and other updated fields like status) to not reflect in the UI after importing matches, showing "Nessun orario kickoff" even though the backend had computed the kickoff time. Fixed by syncing `selectedMatchday` with fresh data in `loadMatchdays()`.

### UX - Admin Console League Lock per Owner (Feb 22, 2026) - COMPLETED
Removed the league dropdown for league owners in the Admin Console. Owners now see only the active league (from Home context) as a static display. Super admins retain the full dropdown to switch between all leagues.
- **Frontend (`admin/index.tsx`)**:
  - Added `useLeague()` hook to get `activeLeague` from context
  - `loadLeagues`: super admin auto-selects first league; owner locks to activeLeague matching admin leagues list
  - League selector: `TouchableOpacity` with chevron for super admin, plain `View` for owner
  - League dropdown modal: wrapped in `isSuperAdmin` guard

### Feature - Statistics Section (Feb 23, 2026) - COMPLETED
New "Statistiche" tab with real football data from API-Football.
- **Backend**:
  - Added `stats_router` with 4 endpoints: `GET /api/stats/leagues`, `GET /api/stats/standings/{league_id}`, `GET /api/stats/results/{league_id}`, `GET /api/stats/upcoming/{league_id}`
  - Added `get_standings()`, `get_recent_results()`, `get_upcoming_fixtures()` methods to `apifootball.py` with TTL caching
  - Fixed leagues: Serie A (135), Premier League (39), La Liga (140), Bundesliga (78), Ligue 1 (61)
- **Frontend**:
  - Created `/app/frontend/app/(tabs)/statistics.tsx`: League chip selector, sub-tabs (Classifica/Risultati/Prossime), standings table with team logos, fixture cards with scores
  - Updated `_layout.tsx`: 5-tab bar: Home > Statistiche > Pronostici > Classifiche > Profilo
  - Removed CLASSIFICHE preview section from `home.tsx`
  - Updated i18n (it, en, es) with `tabs.statistics` and `stats.*` keys
  - **Round Picker**: Added dropdown to select specific matchday (Giornata) in Results/Upcoming tabs. Bottom-sheet modal with list of rounds. Auto-selects first round on load.
  - **League chips fix**: Applied `flexShrink: 0` to prevent text truncation on horizontal scroll

### UI Polish - Premium Look (Feb 24, 2026) - COMPLETED
- Header arancione brand con logo bianco, icone bianche su sfondo semi-trasparente, ombra soft
- Menu hamburger: header arancione, Logout separato con divider, micro-interazioni (scale 0.97 sui bottoni, animazione slide 240ms)

### Feature - Hamburger Side Menu (Feb 24, 2026) - COMPLETED
Added sidebar drawer menu accessible via hamburger icon (3 lines) in top-left of Home page.
- **Structure**: 
  - ACCOUNT: Profilo (edit username/password/delete account), Lingua, Logout
  - LEGA: Le mie leghe, Partecipanti (current league members), Regolamento (scoring rules), I miei inviti (join via code)
  - COMUNICAZIONI: News (admin announcements), Notifiche
- **Backend**: Added `PUT /api/profile/password`, `DELETE /api/profile`, `GET /api/leagues/{id}/members`, `GET/POST /api/news`, `GET /api/notifications`, `PATCH /api/notifications/{id}/read`
- **Frontend**: SideMenu.tsx drawer component, 8 menu pages under `/menu/*`, hamburger icon in home.tsx

### Feature - Match Preview Stats Button (Feb 23, 2026) - COMPLETED
Added "Statistiche" button on each API-imported match card in the Predictions screen. Opens a bottom sheet with:
- **Last 5 matches** for both teams (W/D/L badges + scores)
- **Head-to-Head** last 5 encounters
- **Current league standing position** (rank, points, played)
Only visible for API-Football matches (not manual). No navigation, no schema changes.
- Backend: `GET /api/stats/match-preview/{match_id}` endpoint
- Frontend: `MatchPreviewSheet.tsx` component + integration in `predictions.tsx`

### Bug Fix - Predictions Screen Shows OPEN Instead of LIVE (Feb 23, 2026) - COMPLETED
The `/api/leagues/{league_id}/fixtures` endpoint returned raw matchday status from DB without computing effective status. This caused the Predictions tab to show "APERTA" (OPEN) for matchdays that should be "LIVE" (first kickoff already passed). Fixed by adding `compute_matchday_status()` call in the fixtures loop so OPEN→LIVE and LIVE→COMPLETED transitions are applied.

## Prioritized Backlog

### P1
- Activate Push Notifications when app is published to stores (set PUSH_NOTIFICATIONS_ENABLED=true, install expo-notifications on frontend, register push tokens on login)
- Integrate email service (SendGrid/Resend) to automate password reset link delivery

### P2
- Implement "Championship Winner Predictions" feature
- Integrate Stripe for joining National League
- Re-enable email verification
- Deploy to custom domain
- Publish to App Store / Play Store
- Refactor frontend rendering condition in frontend/app/admin/index.tsx

### P3
- Refactor monolithic server.py into modular architecture
- Clean up dead Jolly code (type definitions, unused functions, CSS)
- Remove dead "jolly" code from codebase

## Credentials
- Admin: admin@fantapronostic.com / admin123
- User 1 (Desylega): desiree@raimondi.it / Roberto95
- User 2 (liga2): ilio@raimondi.it / password123
- User 3: robrai@gmail.com / password
- NATIONAL_LEAGUE_ID: f1373417-43aa-4043-b6a2-125873181c95
- LIVE Matchday ID (current): 23c88f47-475f-4aa5-8fe8-f13d61d43cbe

## Key Files
- `/app/backend/server.py`: All business logic and API endpoints
- `/app/backend/apifootball.py`: API-Football client with caching (standings, fixtures, results)
- `/app/backend/scoring.py`: Points calculation engine
- `/app/backend/database.py`: MongoDB connection and indexes
- `/app/frontend/app/(tabs)/home.tsx`: Home screen with Classifica LIVE
- `/app/frontend/app/(tabs)/statistics.tsx`: Statistics page (real league data)
- `/app/frontend/app/(tabs)/rankings.tsx`: Rankings with LIVE mode
- `/app/frontend/app/(tabs)/_layout.tsx`: Tab bar layout (5 tabs)
- `/app/frontend/app/user-predictions.tsx`: User predictions detail
- `/app/frontend/app/live/[id].tsx`: Live match view
- `/app/frontend/app/menu/notifications.tsx`: Notifications page (in-app center)
- `/app/frontend/src/components/SideMenu.tsx`: Side menu component
