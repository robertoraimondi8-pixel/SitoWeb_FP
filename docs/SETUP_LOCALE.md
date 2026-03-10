# FantaPronostic — Guida Avvio Locale

## Prerequisiti

| Software | Versione minima |
|----------|----------------|
| **Node.js** | v20+ |
| **Python** | 3.11+ |
| **MongoDB** | 7.0+ |
| **Yarn** | 1.22+ |
| **Expo CLI** | installato globalmente |

---

## 1. Clona il repository

```bash
git clone https://github.com/tuo-utente/fantapronostic.git
cd fantapronostic
```

---

## 2. Configura le variabili d'ambiente

```bash
# Backend
cp .env.example backend/.env
# Modifica backend/.env con i tuoi valori reali (vedi .env.example per la lista completa)

# Frontend
# Crea frontend/.env con:
echo 'EXPO_PUBLIC_BACKEND_URL=http://localhost:8001' > frontend/.env
```

---

## 3. Avvia MongoDB

```bash
# Opzione A — MongoDB locale
mongod --dbpath /data/db

# Opzione B — Docker
docker run -d -p 27017:27017 --name fantapronostic-mongo mongo:7
```

---

## 4. Avvia il Backend (FastAPI)

```bash
cd backend

# Crea virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Installa dipendenze
pip install -r requirements.txt

# Avvia il server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Il backend sara disponibile su **http://localhost:8001**

### Verifica che funzioni:
```bash
curl http://localhost:8001/api/admin-ui
# Dovresti vedere la pagina HTML dell'admin UI
```

---

## 5. Crea l'utente Admin (prima volta)

```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fantapronostic.com",
    "username": "admin",
    "password": "la_tua_password_sicura"
  }'
```

> L'email definita in `SUPER_ADMIN_EMAIL` nel .env avra automaticamente i permessi super admin.

---

## 6. Avvia il Frontend (Expo)

```bash
cd frontend

# Installa dipendenze (SEMPRE con yarn, mai npm)
yarn install

# Avvia Expo
npx expo start --web        # Browser web
npx expo start --ios        # iOS simulator
npx expo start --android    # Android emulator
npx expo start              # Menu interattivo
```

L'app web sara disponibile su **http://localhost:8081**

---

## 7. Struttura delle cartelle

```
fantapronostic/
├── backend/
│   ├── server.py           # Entry point FastAPI (tutte le route)
│   ├── database.py         # Connessione MongoDB + collections
│   ├── models.py           # Pydantic models
│   ├── auth.py             # JWT authentication logic
│   ├── scoring.py          # Calcolo punteggi
│   ├── permissions.py      # RBAC permessi
│   ├── apifootball.py      # Client API-Football
│   ├── requirements.txt    # Dipendenze Python
│   └── .env                # Variabili ambiente
│
├── frontend/
│   ├── app/                # Schermate (Expo Router file-based routing)
│   │   ├── (auth)/         # Login, Register, Callback
│   │   ├── (tabs)/         # Tab principali: Home, Predictions, Rankings, Statistics, Profile
│   │   ├── admin/          # Console admin
│   │   ├── league/         # Gestione leghe
│   │   ├── live/           # Schermata live
│   │   └── menu/           # Menu laterale (profilo, notifiche, etc.)
│   ├── src/
│   │   ├── api/client.ts   # HTTP client con auth
│   │   ├── components/     # Componenti UI riutilizzabili
│   │   ├── contexts/       # React Context (Auth, League, Theme)
│   │   ├── theme/          # Design System + Brand Colors
│   │   ├── i18n/           # Traduzioni (it, en, es)
│   │   └── types/          # TypeScript types
│   ├── package.json
│   └── .env
│
└── .env.example            # Template variabili ambiente
```

---

## Comandi utili

| Comando | Dove | Cosa fa |
|---------|------|---------|
| `uvicorn server:app --reload --port 8001` | backend/ | Avvia API in dev mode |
| `yarn start` | frontend/ | Avvia Expo dev server |
| `yarn start --clear` | frontend/ | Avvia con cache pulita |
| `pip freeze > requirements.txt` | backend/ | Aggiorna dipendenze |
| `yarn add <pacchetto>` | frontend/ | Aggiungi dipendenza frontend |

---

## Troubleshooting

**MongoDB non si connette:**
- Verifica che `mongod` sia in esecuzione: `mongosh --eval "db.adminCommand('ping')"`
- Controlla la `MONGO_URL` nel `.env`

**Frontend non vede il backend:**
- Verifica che `EXPO_PUBLIC_BACKEND_URL` punti a `http://localhost:8001`
- Verifica che il backend sia avviato e risponda: `curl http://localhost:8001/api/admin-ui`

**Errori di dipendenze frontend:**
- Cancella `node_modules` e reinstalla: `rm -rf node_modules && yarn install`
- Pulisci cache Metro: `npx expo start --clear`
