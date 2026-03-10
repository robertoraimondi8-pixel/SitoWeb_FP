# FantaPronostic — Guida Deploy Consigliato

## Architettura di Produzione

```
                    ┌─────────────────┐
                    │   CDN / Vercel   │  ← Frontend (Expo Web) o App Store
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │  Reverse Proxy   │  ← Nginx / Caddy
                    │   (SSL/TLS)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   FastAPI App    │  ← Backend (uvicorn + gunicorn)
                    │   porta 8001     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   MongoDB        │  ← Database (Atlas o self-hosted)
                    │   porta 27017    │
                    └─────────────────┘
```

---

## Opzione 1: VPS (DigitalOcean / Hetzner / AWS EC2) — Consigliato

### Costo stimato: ~15-25 EUR/mese

### Passo 1: Server
- VPS con 2GB RAM, 1 vCPU (es. DigitalOcean Droplet $12/mese)
- Ubuntu 22.04 LTS

### Passo 2: Docker Compose (modo piu semplice)

```yaml
# docker-compose.yml
version: "3.8"
services:
  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    restart: always

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongo:27017
      - DB_NAME=fantapronostic
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - APIFOOTBALL_API_KEY=${APIFOOTBALL_API_KEY}
      - APIFOOTBALL_LIVE_SYNC_ENABLED=true
      - STRIPE_API_KEY=${STRIPE_API_KEY}
      - PUSH_NOTIFICATIONS_ENABLED=true
    depends_on:
      - mongo
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - backend
    restart: always

volumes:
  mongo_data:
```

### Passo 3: Dockerfile Backend

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
```

### Passo 4: SSL con Certbot
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d api.fantapronostic.com
```

---

## Opzione 2: Railway / Render — Zero Config

### Costo stimato: ~7-15 EUR/mese

1. Crea account su [railway.app](https://railway.app) o [render.com](https://render.com)
2. Collega il repo GitHub
3. Configura le variabili d'ambiente dalla dashboard
4. Il deploy e automatico ad ogni push

**Railway:**
- Backend: collega la cartella `backend/`, start command: `uvicorn server:app --host 0.0.0.0 --port 8001`
- Database: aggiungi il plugin MongoDB

**Render:**
- Backend: Web Service, root directory `backend/`, build `pip install -r requirements.txt`
- Database: usa MongoDB Atlas (free tier disponibile)

---

## Opzione 3: MongoDB Atlas (Database gestito)

Consigliato per qualsiasi opzione di deploy:

1. Vai su [cloud.mongodb.com](https://cloud.mongodb.com)
2. Crea un cluster gratuito (M0) o a pagamento (M10+)
3. Ottieni la connection string: `mongodb+srv://user:password@cluster.xxxxx.mongodb.net/fantapronostic`
4. Usala come `MONGO_URL` nel `.env`

---

## Frontend: Deploy Mobile

### Expo (EAS Build)
```bash
cd frontend
npm install -g eas-cli
eas login
eas build --platform ios     # Per App Store
eas build --platform android # Per Play Store
```

### Expo Web (opzionale)
```bash
npx expo export --platform web
# Deploy la cartella dist/ su Vercel, Netlify, o qualsiasi hosting statico
```

---

## Checklist Pre-Produzione

- [ ] Cambia `JWT_SECRET` e `JWT_REFRESH_SECRET` con valori lunghi e casuali
- [ ] Configura HTTPS/SSL sul dominio
- [ ] Imposta `PUSH_NOTIFICATIONS_ENABLED=true`
- [ ] Configura backup automatici MongoDB (Atlas lo fa di default)
- [ ] Imposta monitoring (UptimeRobot gratuito per health check)
- [ ] Configura CORS nel backend per il tuo dominio specifico
- [ ] Testa il flusso completo: registrazione → login → pronostici → live → classifica
- [ ] Configura un servizio email per il reset password (SendGrid, Resend, etc.)

---

## Backup MongoDB

### Manuale
```bash
mongodump --uri="mongodb://localhost:27017" --db=fantapronostic --out=/backup/$(date +%Y%m%d)
```

### Ripristino
```bash
mongorestore --uri="mongodb://localhost:27017" --db=fantapronostic /backup/20260301/fantapronostic/
```

### Automatico (cron)
```bash
# Aggiungi al crontab: backup giornaliero alle 3:00
0 3 * * * mongodump --uri="mongodb://localhost:27017" --db=fantapronostic --out=/backup/$(date +\%Y\%m\%d) --gzip
```
