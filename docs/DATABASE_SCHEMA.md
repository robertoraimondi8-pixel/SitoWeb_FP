# FantaPronostic — Schema Database (MongoDB)

Database: **fantapronostic**
Totale collections: **17**

---

## Collections Principali

### `users`
Utenti registrati.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico utente |
| `email` | string | Email (unique) |
| `username` | string | Nome utente (unique) |
| `password` | string | Hash bcrypt della password |
| `is_super_admin` | boolean | Super admin globale |
| `email_verified` | boolean | Email verificata |
| `email_verification_token` | string | Token per verifica email |
| `picture` | string | URL avatar (Google OAuth) |
| `last_login` | datetime | Ultimo login |
| `created_at` | datetime | Data registrazione |
| `accepted_privacy` | boolean | Accettazione privacy |
| `accepted_terms` | boolean | Accettazione termini |

**Indici:** `email` (unique), `username` (unique)

---

### `leagues`
Leghe di gioco (nazionali e private).

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico lega |
| `name` | string | Nome della lega |
| `league_type` | string | `"national"` o `"private"` |
| `match_source_type` | string | `"national"` o `"custom"` |
| `invite_code` | string | Codice invito (unique, 6 chars) |
| `owner_id` | string | ID creatore |
| `created_by` | string | ID creatore |
| `scoring_config` | object | Configurazione punteggi (1x2, exact_score, etc.) |
| `start_matchday` | number | Giornata iniziale |
| `end_matchday` | number | Giornata finale |
| `bet_deadline_minutes` | number | Minuti prima del kickoff per chiusura pronostici |
| `season_id` | string | ID stagione |
| `rules_locked` | boolean | Regole bloccate |
| `is_deleted` | boolean | Soft delete |
| `created_at` | datetime | Data creazione |

**Indici:** `id` (unique), `invite_code` (unique, sparse)

---

### `memberships`
Appartenenza utente-lega.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico membership |
| `user_id` | string | ID utente |
| `league_id` | string | ID lega |
| `role` | string | `"owner"`, `"admin"`, `"player"` |
| `status` | string | `"active"`, `"suspended"` |
| `joined_at` | datetime | Data di adesione |

**Indici:** `id` (unique), `(user_id, league_id)` (unique compound)

---

### `seasons`
Stagioni calcistiche.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico stagione |
| `name` | string | Es. "Serie A 2025/26" |
| `status` | string | `"current"`, `"completed"` |
| `created_at` | datetime | Data creazione |

**Indici:** `id` (unique)

---

### `matchdays`
Giornate di campionato.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico giornata |
| `season_id` | string | ID stagione |
| `league_id` | string | ID lega (per giornate private) |
| `number` | number | Numero giornata (1-38) |
| `label` | string | "Giornata 24" |
| `status` | string | `"OPEN"`, `"LOCKED"`, `"LIVE"`, `"COMPLETED"` |
| `start_time` | datetime | Orario prima partita |
| `created_at` | datetime | Data creazione |

**Indici:** `id` (unique), `(season_id, number, league_id)` (unique compound)

---

### `matches`
Partite singole all'interno di una giornata.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico partita |
| `matchday_id` | string | ID giornata |
| `league_id` | string | ID lega |
| `home_team` | string | Nome squadra casa |
| `away_team` | string | Nome squadra trasferta |
| `home_logo` | string | URL logo casa |
| `away_logo` | string | URL logo trasferta |
| `competition_name` | string | Nome competizione |
| `start_time` | datetime | Orario calcio d'inizio |
| `home_score` | number/null | Gol casa |
| `away_score` | number/null | Gol trasferta |
| `status` | string | `"scheduled"`, `"live"`, `"finished"` |
| `elapsed` | number/null | Minuto corrente (se live) |
| `external_fixture_id` | number | ID API-Football |
| `created_at` | datetime | Data creazione |

**Indici:** `id` (unique), `matchday_id`

---

### `predictions`
Pronostici degli utenti.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico pronostico |
| `user_id` | string | ID utente |
| `match_id` | string | ID partita |
| `matchday_id` | string | ID giornata |
| `league_id` | string | ID lega |
| `market_type` | string | `"1X2"`, `"GOAL_NOGOL"`, `"OVER_UNDER_25"`, `"EXACT_SCORE"` |
| `prediction_value` | string | Valore pronostico (es. "1", "Over", "2-1") |
| `outcome` | string | `"pending"`, `"correct"`, `"wrong"`, `"void"` |
| `points` | number | Punti assegnati |
| `is_special` | boolean | Pronostico speciale (x3) |
| `multiplier` | number | Moltiplicatore punti |
| `created_at` | datetime | Data inserimento |
| `updated_at` | datetime | Ultimo aggiornamento |

**Indici:** `id` (unique), `(user_id, match_id, league_id)` (unique compound), `(user_id, matchday_id)`

---

### `score_summaries`
Riepilogo punteggi per utente/giornata/lega.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico |
| `user_id` | string | ID utente |
| `matchday_id` | string | ID giornata |
| `league_id` | string | ID lega |
| `base_points` | number | Punti base |
| `special_bonus` | number | Bonus speciali |
| `total_points` | number | Totale punti |
| `valid_matches` | number | Partite valide |
| `correct_matches` | number | Pronostici corretti |

**Indici:** `id` (unique), `(user_id, matchday_id, league_id)` (unique compound)

---

### `standings_cache`
Cache classifiche per performance.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico |
| `league_id` | string | ID lega |
| `matchday_id` | string | ID giornata (o "total") |
| `standings_type` | string | `"total"`, `"weekly"` |
| `entries` | array | Lista posizioni classifica |
| `updated_at` | datetime | Ultimo aggiornamento |

**Indici:** `id` (unique), `(league_id, matchday_id, standings_type)` (unique compound)

---

### `notifications`
Notifiche push/in-app.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico |
| `user_id` | string | ID destinatario |
| `type` | string | Tipo notifica (matchday_open, reminder, etc.) |
| `title` | string | Titolo |
| `message` | string | Messaggio |
| `link` | string | Deep link in-app |
| `read` | boolean | Letta |
| `created_at` | datetime | Data creazione |

**Indici:** `id` (unique), `(user_id, read)`

---

### `push_tokens`
Token push Expo per le notifiche.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `user_id` | string | ID utente |
| `token` | string | ExponentPushToken |
| `created_at` | datetime | Data registrazione |

**Indici:** `(user_id, token)` (unique compound), `user_id`

---

## Collections Secondarie

### `payment_transactions`
Transazioni Stripe.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string (UUID) | ID unico |
| `user_id` | string | ID utente |
| `league_id` | string | ID lega |
| `session_id` | string | Stripe session ID |
| `status` | string | `"pending"`, `"completed"`, `"failed"` |
| `amount` | number | Importo in centesimi |
| `created_at` | datetime | Data creazione |

---

### `joker_usages`
Utilizzo del jolly (feature legacy).

### `champion_picks`
Pronostici vincitore campionato (feature futura).

### `roles`
Ruoli RBAC personalizzati per le leghe.

### `password_resets`
Token per il reset password.

### `audit_logs`
Log delle azioni amministrative.

### `news`
Notizie/comunicazioni pubblicate dall'admin.

---

## Relazioni tra Collections

```
users ──┬── memberships ──── leagues
        │
        ├── predictions ──── matches ──── matchdays ──── seasons
        │
        ├── score_summaries
        │
        ├── notifications
        │
        └── push_tokens

leagues ──── standings_cache
```

---

## Note per il Nuovo Sviluppatore

1. **Tutti gli ID sono UUID v4** (stringhe, non ObjectId di MongoDB)
2. **`_id` di MongoDB** viene SEMPRE escluso dalle risposte API (`{"_id": 0}`)
3. **Soft delete**: le leghe usano `is_deleted: true` invece di rimuovere il documento
4. **Date**: tutte in UTC con timezone (`datetime.now(timezone.utc)`)
5. **Gli indici vengono creati automaticamente** al primo avvio del backend (funzione `create_indexes` in `database.py`)
6. **Il campo `league_id`** e presente in quasi tutte le collections per isolare i dati tra leghe
