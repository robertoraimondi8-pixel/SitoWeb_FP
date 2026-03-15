"""FantaPronostic Backend - Main FastAPI Application.

Thin application hub: creates the FastAPI app, includes all modular routers,
and manages startup/shutdown lifecycle events.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import asyncio
from datetime import datetime, timezone

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import create_indexes, matches_col, users_col, password_resets_col
from auth import hash_password
from services import bootstrap_rbac
import services as _svc

# Import routers from modular route files
from routes.auth import auth_router
from routes.user import user_router, news_router, reminder_scheduler_loop
from routes.leagues import league_router
from routes.predictions import prediction_router
from routes.standings import standings_router
from routes.live import live_router
from routes.payments import payment_router
from routes.admin import admin_router
from routes.fixtures import fixtures_router, live_fixtures_loop
from routes.stats import stats_router
from routes.rbac import rbac_router
from routes.tournaments import tournament_router
from routes.champion_picks import champion_router
from routes.trophies import trophy_router

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="FantaPronostic API", version="2.1.0")

_cors_origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# INCLUDE ALL ROUTERS
# ========================================
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(league_router)
app.include_router(prediction_router)
app.include_router(standings_router)
app.include_router(live_router)
app.include_router(payment_router)
app.include_router(admin_router)
app.include_router(fixtures_router)
app.include_router(stats_router)
app.include_router(news_router)
app.include_router(rbac_router)
app.include_router(tournament_router)
app.include_router(champion_router)
app.include_router(trophy_router)


# ========================================
# LEGAL PAGES (Privacy Policy & Terms)
# ========================================
@app.get("/api/privacy-policy", response_class=HTMLResponse)
async def privacy_policy():
    return """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy - FantaPronostic</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1f2937;line-height:1.7;background:#f9fafb}
h1{color:#1F3A8A;border-bottom:3px solid #F59E0B;padding-bottom:12px}
h2{color:#1F3A8A;margin-top:32px}
a{color:#F59E0B}
.updated{color:#6b7280;font-size:14px}
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p class="updated">Ultimo aggiornamento: 15 marzo 2026</p>

<p><strong>FantaPronostic</strong> ("noi", "nostro") gestisce l'applicazione mobile FantaPronostic (il "Servizio"). Questa pagina informa l'utente sulle nostre politiche relative alla raccolta, all'uso e alla divulgazione dei dati personali quando utilizza il nostro Servizio.</p>

<h2>1. Dati Raccolti</h2>
<p>Raccogliamo i seguenti dati personali forniti volontariamente dall'utente:</p>
<ul>
<li><strong>Dati di registrazione:</strong> nome, cognome, indirizzo email, data di nascita, indirizzo, citta, CAP, paese</li>
<li><strong>Dati di accesso:</strong> password (memorizzata in forma crittografata)</li>
<li><strong>Dati di utilizzo:</strong> pronostici inseriti, punteggi, classifiche, partecipazione a leghe e tornei</li>
<li><strong>Dati di pagamento:</strong> le transazioni sono gestite tramite Stripe. Non memorizziamo dati di carte di credito sui nostri server</li>
</ul>

<h2>2. Finalita del Trattamento</h2>
<p>I dati personali sono utilizzati per:</p>
<ul>
<li>Creare e gestire l'account utente</li>
<li>Fornire il servizio di pronostici sportivi</li>
<li>Gestire classifiche e punteggi</li>
<li>Elaborare pagamenti tramite Stripe</li>
<li>Inviare comunicazioni relative al servizio (verifica email, notifiche di gioco)</li>
</ul>

<h2>3. Condivisione dei Dati</h2>
<p>Non vendiamo ne condividiamo i dati personali con terze parti, ad eccezione di:</p>
<ul>
<li><strong>Stripe:</strong> per l'elaborazione dei pagamenti</li>
<li><strong>SendGrid:</strong> per l'invio di email transazionali</li>
<li><strong>MongoDB Atlas:</strong> per l'archiviazione sicura dei dati</li>
</ul>

<h2>4. Sicurezza</h2>
<p>Adottiamo misure di sicurezza tecniche e organizzative per proteggere i dati personali, tra cui crittografia delle password, connessioni HTTPS e accesso limitato ai database.</p>

<h2>5. Conservazione dei Dati</h2>
<p>I dati personali sono conservati per tutta la durata dell'account. L'utente puo richiedere la cancellazione dell'account e di tutti i dati associati in qualsiasi momento contattandoci.</p>

<h2>6. Diritti dell'Utente</h2>
<p>Ai sensi del GDPR, l'utente ha diritto a:</p>
<ul>
<li>Accedere ai propri dati personali</li>
<li>Rettificare dati inesatti</li>
<li>Richiedere la cancellazione dei dati</li>
<li>Opporsi al trattamento</li>
<li>Richiedere la portabilita dei dati</li>
</ul>

<h2>7. Minori</h2>
<p>Il Servizio non e destinato a minori di 18 anni. Non raccogliamo consapevolmente dati di minori.</p>

<h2>8. Contatti</h2>
<p>Per domande sulla privacy, contattaci a: <a href="mailto:robertoraimondi8@gmail.com">robertoraimondi8@gmail.com</a></p>

<h2>9. Modifiche</h2>
<p>Ci riserviamo il diritto di aggiornare questa Privacy Policy. Le modifiche saranno pubblicate su questa pagina.</p>
</body>
</html>"""


@app.get("/api/terms", response_class=HTMLResponse)
async def terms_of_service():
    return """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Termini di Servizio - FantaPronostic</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1f2937;line-height:1.7;background:#f9fafb}
h1{color:#1F3A8A;border-bottom:3px solid #F59E0B;padding-bottom:12px}
h2{color:#1F3A8A;margin-top:32px}
a{color:#F59E0B}
.updated{color:#6b7280;font-size:14px}
</style>
</head>
<body>
<h1>Termini di Servizio</h1>
<p class="updated">Ultimo aggiornamento: 15 marzo 2026</p>

<p>Utilizzando l'applicazione <strong>FantaPronostic</strong>, l'utente accetta i seguenti termini e condizioni.</p>

<h2>1. Descrizione del Servizio</h2>
<p>FantaPronostic e un'applicazione di pronostici sportivi a scopo ludico. Gli utenti possono creare o partecipare a leghe, effettuare pronostici su partite di calcio e competere in classifiche.</p>

<h2>2. Account</h2>
<p>L'utente e responsabile della sicurezza del proprio account e della password. FantaPronostic non sara responsabile per perdite derivanti dall'uso non autorizzato dell'account.</p>

<h2>3. Pagamenti</h2>
<p>Alcune funzionalita (es. leghe con partite personalizzate) richiedono un pagamento. I pagamenti sono gestiti tramite Stripe e non sono rimborsabili salvo diversa indicazione.</p>

<h2>4. Comportamento</h2>
<p>L'utente si impegna a non utilizzare il Servizio per scopi illeciti, non tentare di compromettere la sicurezza del sistema e rispettare gli altri utenti.</p>

<h2>5. Proprieta Intellettuale</h2>
<p>Tutti i contenuti, il design e il codice di FantaPronostic sono di proprieta del titolare. E vietata la riproduzione non autorizzata.</p>

<h2>6. Limitazione di Responsabilita</h2>
<p>Il Servizio e fornito "cosi com'e". Non garantiamo disponibilita ininterrotta. FantaPronostic non e un servizio di scommesse e non comporta vincite in denaro reale, salvo eventuali premi organizzati dal gestore della lega.</p>

<h2>7. Risoluzione</h2>
<p>Ci riserviamo il diritto di sospendere o terminare l'accesso al Servizio in caso di violazione dei presenti termini.</p>

<h2>8. Contatti</h2>
<p>Per domande: <a href="mailto:robertoraimondi8@gmail.com">robertoraimondi8@gmail.com</a></p>
</body>
</html>"""



@app.get("/api/delete-account", response_class=HTMLResponse)
async def delete_account_page():
    return """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elimina Account - FantaPronostic</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#1f2937;line-height:1.7}
.container{max-width:600px;margin:0 auto;padding:40px 20px}
h1{color:#1F3A8A;font-size:24px;margin-bottom:8px}
.subtitle{color:#6b7280;font-size:15px;margin-bottom:32px}
.warning-box{background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;margin-bottom:24px}
.warning-box h3{color:#DC2626;font-size:15px;margin-bottom:8px}
.warning-box ul{margin:8px 0 0 20px;color:#7F1D1D;font-size:14px}
.warning-box li{margin-bottom:4px}
.form-group{margin-bottom:16px}
label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
input{width:100%;padding:12px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;outline:none;transition:border-color .2s}
input:focus{border-color:#1F3A8A;box-shadow:0 0 0 3px rgba(31,58,138,.1)}
.btn-delete{width:100%;padding:14px;background:#DC2626;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;transition:background .2s}
.btn-delete:hover{background:#B91C1C}
.btn-delete:disabled{background:#9CA3AF;cursor:not-allowed}
.result{margin-top:20px;padding:16px;border-radius:10px;font-size:14px;display:none}
.result.success{display:block;background:#F0FDF4;border:1px solid #BBF7D0;color:#166534}
.result.error{display:block;background:#FEF2F2;border:1px solid #FECACA;color:#DC2626}
.footer{text-align:center;margin-top:40px;color:#9CA3AF;font-size:12px}
.logo{text-align:center;margin-bottom:24px}
.logo span:first-child{font-size:22px;font-weight:800;color:#F59E0B}
.logo span:last-child{font-size:22px;font-weight:600;color:#1F3A8A}
</style>
</head>
<body>
<div class="container">
  <div class="logo"><span>FANTA</span><span>Pronostic</span></div>
  <h1>Elimina il tuo Account</h1>
  <p class="subtitle">Questa azione e irreversibile. Tutti i tuoi dati verranno eliminati permanentemente.</p>

  <div class="warning-box">
    <h3>Cosa verra eliminato:</h3>
    <ul>
      <li>Il tuo profilo e tutti i dati personali</li>
      <li>I tuoi pronostici e il tuo storico punteggi</li>
      <li>Le tue iscrizioni a leghe e tornei</li>
      <li>Le leghe di cui sei proprietario</li>
    </ul>
  </div>

  <div id="form-section">
    <div class="form-group">
      <label for="email">Email del tuo account</label>
      <input type="email" id="email" placeholder="La tua email" required>
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" placeholder="La tua password" required>
    </div>
    <button class="btn-delete" id="delete-btn" onclick="handleDelete()">Elimina il mio Account</button>
  </div>

  <div id="result" class="result"></div>

  <p class="footer">FantaPronostic - Il gioco dei pronostici sportivi<br>
  Per assistenza: <a href="mailto:robertoraimondi8@gmail.com" style="color:#F59E0B">robertoraimondi8@gmail.com</a></p>
</div>

<script>
async function handleDelete() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('delete-btn');
  const result = document.getElementById('result');

  if (!email || !password) {
    result.className = 'result error';
    result.textContent = 'Inserisci email e password.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Eliminazione in corso...';
  result.style.display = 'none';

  try {
    const API = window.location.origin + '/api';

    const loginRes = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password})
    });
    const loginData = await loginRes.json();

    if (!loginRes.ok || !loginData.access_token) {
      throw new Error('Email o password non validi.');
    }

    const delRes = await fetch(API + '/auth/delete-account', {
      method: 'DELETE',
      headers: {'Authorization': 'Bearer ' + loginData.access_token}
    });
    const delData = await delRes.json();

    if (delRes.ok) {
      document.getElementById('form-section').style.display = 'none';
      result.className = 'result success';
      result.textContent = 'Account eliminato con successo. Tutti i tuoi dati sono stati rimossi.';
    } else {
      throw new Error(delData.detail || 'Errore durante l\\'eliminazione.');
    }
  } catch (e) {
    result.className = 'result error';
    result.textContent = e.message;
    btn.disabled = false;
    btn.textContent = 'Elimina il mio Account';
  }
}
</script>
</body>
</html>"""



# ========================================
# LIFECYCLE EVENTS
# ========================================
_live_task = None
_reminder_task = None


@app.on_event("startup")
async def startup():
    global _live_task, _reminder_task
    await create_indexes()
    await matches_col.create_index("external_fixture_id", sparse=True)
    await bootstrap_rbac()
    _live_task = asyncio.create_task(live_fixtures_loop())
    _reminder_task = asyncio.create_task(reminder_scheduler_loop())
    logger.info("FantaPronostic API started - indexes created - RBAC bootstrapped - live refresh started")


@app.on_event("shutdown")
async def shutdown():
    global _live_task, _reminder_task
    if _live_task:
        _live_task.cancel()
        try:
            await _live_task
        except asyncio.CancelledError:
            pass
    if _reminder_task:
        _reminder_task.cancel()
        try:
            await _reminder_task
        except asyncio.CancelledError:
            pass
    if _svc._apifootball_client:
        await _svc._apifootball_client.close()
    from database import client
    client.close()


# ========================================
# APP-LEVEL ROUTES
# ========================================
@app.get("/api")
async def api_root():
    return {"message": "FantaPronostic API v2.1", "status": "running"}


@app.post("/api/seed")
async def seed_data():
    """Seed demo data for development."""
    from seed import run_seed
    return await run_seed()


@app.get("/api/admin-ui", response_class=HTMLResponse)
@app.get("/api/admin-ui/{path:path}", response_class=HTMLResponse)
async def admin_dashboard(path: str = ""):
    from admin_ui import get_admin_html
    return HTMLResponse(
        content=get_admin_html(),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/api/reset-password", response_class=HTMLResponse)
async def reset_password_page(token: str = ""):
    """Public page for resetting a password via token."""
    from admin_ui import get_reset_password_html
    return get_reset_password_html()


@app.post("/api/reset-password")
async def reset_password_submit(request: Request):
    """Submit a new password using the reset token."""
    import hashlib

    body = await request.json()
    raw_token = body.get("token")
    new_password = body.get("new_password")

    if not raw_token or not new_password:
        raise HTTPException(400, "Token e nuova password sono richiesti")

    if len(new_password) < 6:
        raise HTTPException(400, "La password deve avere almeno 6 caratteri")

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    reset_doc = await password_resets_col.find_one({
        "token_hash": token_hash,
        "used": False,
    }, {"_id": 0})

    if not reset_doc:
        raise HTTPException(400, "Token non valido o già utilizzato")

    expires_at = reset_doc.get("expires_at", "")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(400, "Token scaduto")
        except ValueError:
            pass

    hashed = hash_password(new_password)
    await users_col.update_one({"id": reset_doc["user_id"]}, {"$set": {"password": hashed}})

    await password_resets_col.update_one({"id": reset_doc["id"]}, {"$set": {"used": True}})

    return {"message": "Password aggiornata con successo"}
