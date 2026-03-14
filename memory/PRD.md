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

## Audit Pre-Store (COMPLETATO - 14 Mar 2026)
1. **Email verification gate**: Attivo in `index.tsx` L88-91
2. **Console.log removal**: 0 console.log/error rimasti nel frontend
3. **Accessibility props**: accessibilityLabel su bottoni principali
4. **eas.json**: Creato con profili development/preview/production
5. **Privacy policy**: Spostata da `/menu/privacy` a `/privacy-policy` (standalone, pubblica)

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

## Task Pendenti
### P1
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
    ├── app/ ((auth)/, (tabs)/, admin/, live/, menu/, tournament/, privacy-policy.tsx)
    ├── src/ (components/, contexts/, theme/, api/)
    └── eas.json
```

## Credenziali Test
- User: ilio@raimondi.it / password123
- Admin: admin@fantapronostic.com / admin123

## Integrazioni 3rd Party
- API-Football (API-Sports)
- Expo (Push Notifications)
- APScheduler
- SendGrid
- Stripe (chiave test disponibile)
