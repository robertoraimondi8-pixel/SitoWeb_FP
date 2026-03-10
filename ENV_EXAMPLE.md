# FantaPronostic — Variabili d'Ambiente

Copia le variabili qui sotto nei rispettivi file `.env`.

---

## Backend (`backend/.env`)

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=fantapronostic

# Auth / JWT
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here_min_32_chars

# API-Football (https://www.api-football.com/)
APIFOOTBALL_API_KEY=your_api_football_key_here
APIFOOTBALL_LIVE_SYNC_ENABLED=true
APIFOOTBALL_LIVE_INTERVAL=180

# Push Notifications (Expo)
PUSH_NOTIFICATIONS_ENABLED=false

# Stripe (Pagamenti)
STRIPE_API_KEY=sk_test_your_stripe_key_here

# Super Admin
SUPER_ADMIN_EMAIL=admin@fantapronostic.com
```

---

## Frontend (`frontend/.env`)

```env
# Backend URL
# Sviluppo locale: http://localhost:8001
# Produzione: https://api.tuodominio.com
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

---

## Note

| Variabile | Dove trovarla |
|-----------|--------------|
| `APIFOOTBALL_API_KEY` | [api-football.com](https://www.api-football.com/) — piano gratuito disponibile |
| `STRIPE_API_KEY` | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |
| `JWT_SECRET` | Genera con: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Genera con: `openssl rand -hex 32` |
