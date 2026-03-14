# FantaPronostic - PRD

## Problema Originale
App di pronostici calcistici con sistema di leghe, tornei, classifiche e punteggi. Full-stack: React Native (Expo) + FastAPI + MongoDB.

## Requisiti Core
- Sistema leghe con pronostici, live, risultati
- Sistema tornei con round-robin, knockout, 1v1
- Admin panel esterno (/api/admin-ui)
- BOOST X3 per match con moltiplicatore
- Navigazione context-aware per tab Pronostici
- Palmares (trofei) per utenti
- i18n completa (IT, EN, ES) con react-i18next
- Regolamento context-aware (regole diverse per leghe vs tornei)
- Testo criteri di spareggio nel regolamento

## Audit Pre-Store (COMPLETATO - 14 Mar 2026)
1. **Email verification gate**: Attivo in `index.tsx` L88-91
2. **Console.log removal**: 0 console.log/error rimasti nel frontend
3. **Accessibility props**: accessibilityLabel su bottoni principali
4. **eas.json**: Creato con profili development/preview/production
5. **Privacy policy**: Spostata da `/menu/privacy` a `/privacy-policy` (standalone, pubblica)

## i18n Refactoring (COMPLETATO - 14 Mar 2026)
### File di traduzione aggiornati:
- `/app/frontend/src/i18n/locales/it/common.json` - Italiano (completo)
- `/app/frontend/src/i18n/locales/en/common.json` - English (completo)
- `/app/frontend/src/i18n/locales/es/common.json` - Espanol (completo)

### Namespace tradotti:
- `tabs`, `home`, `rankings`, `predictions`, `statistics`, `profile`
- `side_menu`, `palmares`, `rules`, `matchDetail`, `matchPreview`
- `tournamentView`, `tournamentRankings`, `browseTournaments`
- `profileEdit`, `myLeagues`, `members`, `invites`, `myTournaments`
- `completeProfile`, `championPick`, `userPredictions`
- `auth`, `onboarding`, `news_screen`, `notifications_screen`

### File refactorizzati (i18n):
- `app/(tabs)/home.tsx`, `app/(tabs)/predictions.tsx`, `app/(tabs)/rankings.tsx`
- `app/(tabs)/statistics.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/_layout.tsx`
- `app/(auth)/login.tsx`, `app/(auth)/index.tsx`
- `app/live/[id].tsx`, `app/user-detail.tsx`, `app/user-predictions.tsx`
- `app/palmares.tsx`, `app/champion-pick.tsx`, `app/complete-profile.tsx`
- `app/onboarding.tsx`, `app/tournament/join.tsx`
- `app/menu/my-leagues.tsx`, `app/menu/members.tsx`, `app/menu/invites.tsx`
- `app/menu/my-tournaments.tsx`, `app/menu/browse-tournaments.tsx`
- `app/menu/profile-edit.tsx`, `app/menu/language.tsx`, `app/menu/rules.tsx`
- `src/components/SideMenu.tsx`, `src/components/MatchDetailSheet.tsx`
- `src/components/MatchPreviewSheet.tsx`, `src/components/TournamentView.tsx`

### Regolamento context-aware:
- `rules.tsx` mostra regole diverse per leghe e tornei
- Include criteri di spareggio per leghe e tornei
- Include regole knockout e gironi per tornei

## Cosa e' implementato
- Sistema leghe completo (CRUD, pronostici, live, risultati)
- Sistema tornei completo (admin panel, round-robin, knockout)
- Admin panel con gestione giornate e tornei
- BOOST X3 UI globale
- Google OAuth + JWT auth
- Push notifications
- Email verification gate
- Privacy policy standalone
- eas.json per build EAS
- Codebase pulito (no console.log)
- Accessibility props base
- i18n completa (IT, EN, ES) - tutti i file frontend refactorizzati
- Regolamento context-aware con criteri di spareggio

## Task Pendenti
### P1
- Fix navigazione tab "Pronostici" per tornei (bug critico, navigazione inconsistente)
- Fix scheduling round-robin torneo "RedBull" (algoritmo circle method implementato, ma vecchi matchup da rigenerare)
- Backfill trofei storici (endpoint POST /api/admin/recalculate-trophies)
- Trofei campione lega e torneo

### P2
- Riattivare feature "Pronostici vincitore campionato"
- Integrazione Stripe per iscrizioni a pagamento
- Breakdown punti per tipo di pronostico nel profilo

## Architettura
```
/app
├── backend/
│   ├── routes/ (admin.py, live.py, predictions.py, tournaments.py, auth.py, ...)
│   └── server.py
└── frontend/
    ├── app/ (Expo Router pages)
    │   ├── (auth)/ (login, register, index)
    │   ├── (tabs)/ (home, predictions, rankings, statistics, profile)
    │   ├── menu/ (rules, language, my-leagues, members, invites, etc.)
    │   └── tournament/ (join)
    └── src/
        ├── components/ (SideMenu, MatchDetailSheet, TournamentView, etc.)
        ├── i18n/ (locales: it/en/es common.json)
        └── theme/ (designSystem.ts)
```

## Credenziali Test
- Standard User: `ilio@raimondi.it` / `password123`
- Admin: `admin@fantapronostic.com` / `admin123`

## 3rd Party Integrations
- API-Football (API-Sports)
- Expo (Push)
- APScheduler
- SendGrid
- react-i18next
