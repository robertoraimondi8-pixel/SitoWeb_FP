"""Admin UI HTML for FantaPronostic - RBAC-enabled web dashboard."""


def get_reset_password_html():
    return """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset Password - FantaPronostic</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0F172A;color:#F1F5F9;min-height:100vh;display:flex;align-items:center;justify-content:center}
.reset-box{background:#1E293B;padding:40px;border-radius:16px;width:400px;max-width:90vw;border:1px solid #334155}
.reset-box h1{color:#F5A623;margin-bottom:8px;font-size:24px}
.reset-box p{color:#94A3B8;font-size:14px;margin-bottom:24px}
.reset-box label{color:#94A3B8;font-size:12px;display:block;margin-bottom:4px}
.reset-box input{width:100%;padding:12px;margin-bottom:16px;background:#0F172A;border:1px solid #334155;border-radius:8px;color:#F1F5F9;font-size:14px}
.reset-box input:focus{outline:none;border-color:#F5A623}
.reset-box button{width:100%;padding:12px;background:#F5A623;color:#0F172A;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px}
.reset-box button:hover{background:#E09215}
.reset-box button:disabled{background:#475569;cursor:not-allowed}
#reset-msg{margin-top:12px;font-size:14px;text-align:center}
.success{color:#10B981}
.error{color:#EF4444}
</style>
</head>
<body>
<div class="reset-box" data-testid="reset-password-box">
  <h1>Reset Password</h1>
  <p>Inserisci la tua nuova password.</p>
  <div id="reset-form">
    <label>Nuova Password</label>
    <input id="new-pass" type="password" placeholder="Minimo 6 caratteri" data-testid="reset-new-password">
    <label>Conferma Password</label>
    <input id="confirm-pass" type="password" placeholder="Ripeti la password" data-testid="reset-confirm-password">
    <button onclick="doResetPassword()" id="reset-btn" data-testid="reset-submit-btn">Cambia Password</button>
  </div>
  <div id="reset-msg"></div>
</div>
<script>
function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
}

async function doResetPassword() {
  const token = getTokenFromUrl();
  const newPass = document.getElementById('new-pass').value;
  const confirmPass = document.getElementById('confirm-pass').value;
  const msgEl = document.getElementById('reset-msg');

  if (!token) {
    msgEl.innerHTML = '<span class="error">Token mancante nell\\'URL.</span>';
    return;
  }
  if (newPass.length < 6) {
    msgEl.innerHTML = '<span class="error">La password deve avere almeno 6 caratteri.</span>';
    return;
  }
  if (newPass !== confirmPass) {
    msgEl.innerHTML = '<span class="error">Le password non coincidono.</span>';
    return;
  }

  document.getElementById('reset-btn').disabled = true;
  document.getElementById('reset-btn').textContent = 'Attendere...';

  try {
    const r = await fetch('/api/reset-password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: token, new_password: newPass})
    });
    const data = await r.json();
    if (r.ok) {
      msgEl.innerHTML = '<span class="success">Password aggiornata con successo! Puoi chiudere questa pagina e accedere con la nuova password.</span>';
      document.getElementById('reset-form').style.display = 'none';
    } else {
      msgEl.innerHTML = '<span class="error">' + (data.detail || 'Errore sconosciuto') + '</span>';
      document.getElementById('reset-btn').disabled = false;
      document.getElementById('reset-btn').textContent = 'Cambia Password';
    }
  } catch(e) {
    msgEl.innerHTML = '<span class="error">Errore di rete. Riprova.</span>';
    document.getElementById('reset-btn').disabled = false;
    document.getElementById('reset-btn').textContent = 'Cambia Password';
  }
}

// Check token on load
if (!getTokenFromUrl()) {
  document.getElementById('reset-msg').innerHTML = '<span class="error">Link non valido: token mancante.</span>';
  document.getElementById('reset-form').style.display = 'none';
}
</script>
</body>
</html>"""


def get_admin_html():
    return """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FantaPronostic Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0F172A;color:#F1F5F9;min-height:100vh}
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:#1E293B;padding:40px;border-radius:16px;width:360px}
.login-box h1{color:#F5A623;margin-bottom:24px;font-size:24px}
.login-box input{width:100%;padding:12px;margin-bottom:16px;background:#0F172A;border:1px solid #334155;border-radius:8px;color:#F1F5F9;font-size:14px}
.login-box button{width:100%;padding:12px;background:#F5A623;color:#0F172A;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px}
.login-box button:hover{background:#E09215}
.dashboard{display:flex;min-height:100vh}
.sidebar{width:250px;background:#1E293B;padding:20px;border-right:1px solid #334155;display:flex;flex-direction:column}
.sidebar h2{color:#F5A623;font-size:20px;margin-bottom:24px}
.sidebar .nav-section{font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px 12px;font-weight:600}
.sidebar a{display:flex;align-items:center;gap:8px;padding:10px 12px;color:#94A3B8;text-decoration:none;border-radius:8px;margin-bottom:2px;font-size:14px;transition:all .15s}
.sidebar a:hover,.sidebar a.active{background:#0F172A;color:#F5A623}
.sidebar a.active{border-left:3px solid #F5A623;padding-left:9px}
.sidebar .spacer{flex:1}
.main{flex:1;padding:24px;overflow-y:auto;max-height:100vh}
.main h2{color:#F5A623;margin-bottom:16px;font-size:22px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #334155;font-size:13px}
th{background:#1E293B;color:#F5A623;position:sticky;top:0;z-index:1}
tr:hover{background:rgba(245,166,35,0.05)}
.btn{padding:8px 16px;background:#F5A623;color:#0F172A;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;margin:2px;transition:all .15s}
.btn:hover{background:#E09215;transform:scale(0.98)}
.btn-danger{background:#EF4444;color:#fff}
.btn-danger:hover{background:#DC2626}
.btn-success{background:#10B981;color:#fff}
.btn-success:hover{background:#059669}
.btn-outline{background:transparent;border:1px solid #475569;color:#94A3B8}
.btn-outline:hover{border-color:#F5A623;color:#F5A623}
.btn-sm{padding:4px 10px;font-size:12px}
.form-row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.form-row input,.form-row select,.form-row textarea{padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px;flex:1;min-width:120px}
.form-row textarea{min-height:60px;resize:vertical}
.card{background:#1E293B;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #334155}
.status-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.status-scheduled{background:#3B82F6;color:#fff}
.status-live{background:#10B981;color:#fff}
.status-finished{background:#6B7280;color:#fff}
.status-void{background:#EF4444;color:#fff}
.status-OPEN{background:#3B82F6;color:#fff}
.status-LOCKED{background:#F59E0B;color:#000}
.status-LIVE{background:#10B981;color:#fff}
.status-COMPLETED{background:#6B7280;color:#fff}
.status-DRAFT{background:#475569;color:#fff}
.toast{position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;z-index:9999;font-size:14px;display:none;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.toast.success{background:#10B981}
.toast.error{background:#EF4444}
#app{min-height:100vh}
/* Modal */
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.modal{background:#1E293B;border-radius:16px;padding:24px;width:95%;max-width:900px;max-height:85vh;overflow-y:auto;border:1px solid #334155;box-shadow:0 8px 32px rgba(0,0,0,.4)}
.modal h3{color:#F5A623;margin-bottom:16px;font-size:18px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
/* Permissions grid */
.perm-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0}
.perm-item{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#0F172A;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid transparent;transition:all .15s}
.perm-item:hover{border-color:#475569}
.perm-item.checked{border-color:#F5A623;background:rgba(245,166,35,.08)}
.perm-item input[type=checkbox]{accent-color:#F5A623;width:16px;height:16px}
/* Search */
.search-bar{padding:10px 14px;background:#0F172A;border:1px solid #334155;border-radius:8px;color:#F1F5F9;font-size:14px;width:100%;margin-bottom:16px}
.search-bar:focus{outline:none;border-color:#F5A623}
/* Tags */
.tag{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin:1px}
.tag-role{background:rgba(245,166,35,.15);color:#F5A623;border:1px solid rgba(245,166,35,.3)}
.tag-super{background:rgba(239,68,68,.15);color:#EF4444;border:1px solid rgba(239,68,68,.3)}
.tag-disabled{background:rgba(107,114,128,.15);color:#9CA3AF;border:1px solid rgba(107,114,128,.3)}
.tag-system{background:rgba(59,130,246,.15);color:#3B82F6;border:1px solid rgba(59,130,246,.3)}
/* Forbidden */
.forbidden{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;color:#94A3B8}
.forbidden h2{color:#EF4444;font-size:28px;margin-bottom:12px}
.forbidden p{font-size:16px}
/* Pulse animation for online indicator */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
/* Counters */
.counter-row{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.counter-box{background:#1E293B;border:1px solid #334155;border-radius:12px;padding:16px 24px;flex:1;min-width:140px}
.counter-box .num{font-size:28px;font-weight:700;color:#F5A623}
.counter-box .label{font-size:12px;color:#94A3B8;margin-top:4px}
/* Hamburger */
.hamburger{display:none;position:fixed;top:12px;left:12px;z-index:60;background:#1E293B;border:1px solid #334155;border-radius:8px;padding:8px 12px;cursor:pointer;color:#F5A623;font-size:20px;line-height:1}
.sidebar-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:49}
/* Mobile responsive */
@media(max-width:768px){
  .hamburger{display:block}
  .sidebar{position:fixed;top:0;left:-260px;z-index:50;height:100vh;width:250px;transition:left .25s ease;overflow-y:auto}
  .sidebar.open{left:0}
  .sidebar-overlay.open{display:block}
  .main{padding:16px;padding-top:52px}
  .main h2{font-size:18px}
  table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .counter-row{gap:8px}
  .counter-box{min-width:100px;padding:10px 14px}
  .counter-box .num{font-size:20px}
  .form-row{flex-direction:column}
  .form-row input,.form-row select,.form-row textarea{min-width:100%}
  .modal{width:95%;max-width:none;padding:16px}
  .perm-grid{grid-template-columns:1fr}
  .btn-sm{padding:4px 8px;font-size:11px}
  .login-box{width:90%;padding:24px}
}
</style>
</head>
<body>
<div id="app"></div>
<div id="toast" class="toast"></div>
<div id="modal-root"></div>
<script>
const API = '/api';
let token = localStorage.getItem('admin_token');
let userPerms = JSON.parse(localStorage.getItem('admin_perms') || '[]');
let isSuperAdmin = localStorage.getItem('admin_is_super') === 'true';
let currentPage = 'seasons';
let allRolesCache = [];

function hasPerm(p) { return isSuperAdmin || userPerms.includes(p); }

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}

function showModal(html) {
  document.getElementById('modal-root').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

async function apiCall(url, method='GET', body=null) {
  const opts = {method, headers: {'Content-Type':'application/json'}};
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + url, opts);
  if (r.status === 403) {
    const e = await r.json().catch(()=>({}));
    if (e.detail === 'Account disabilitato') { doLogout(); return; }
    throw new Error(e.detail || 'Accesso negato');
  }
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail || r.statusText); }
  return r.json();
}

function renderLogin() {
  document.getElementById('app').innerHTML = `
  <div class="login-wrap"><div class="login-box">
    <h1>FantaPronostic Admin</h1>
    <input id="email" placeholder="Email" type="email" data-testid="admin-login-email">
    <input id="pass" placeholder="Password" type="password" data-testid="admin-login-password">
    <button onclick="doLogin()" data-testid="admin-login-btn">Accedi</button>
    <p id="login-err" style="color:#EF4444;margin-top:12px;font-size:13px"></p>
  </div></div>`;
}

async function doLogin() {
  try {
    const res = await apiCall('/auth/login', 'POST', {
      email: document.getElementById('email').value,
      password: document.getElementById('pass').value
    });
    token = res.access_token;
    localStorage.setItem('admin_token', token);
    // Fetch RBAC permissions
    const permsData = await apiCall('/rbac/my-permissions');
    userPerms = permsData.permissions || [];
    isSuperAdmin = permsData.is_super_admin || false;
    localStorage.setItem('admin_perms', JSON.stringify(userPerms));
    localStorage.setItem('admin_is_super', isSuperAdmin.toString());
    if (!hasPerm('admin.dashboard.view')) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_perms');
      localStorage.removeItem('admin_is_super');
      token = null; userPerms = []; isSuperAdmin = false;
      renderLogin();
      document.getElementById('login-err').textContent = 'Accesso non autorizzato al pannello admin';
      return;
    }
    renderDashboard();
  } catch(e) { document.getElementById('login-err').textContent = e.message; }
}

const MENU_ITEMS = [
  {section: 'PANORAMICA'},
  {id:'dashboard', label:'Dashboard', perm:'admin.dashboard.view'},
  {section: 'GESTIONE GIOCO'},
  {id:'seasons', label:'Stagioni', perm:'admin.seasons.manage'},
  {id:'matchdays', label:'Giornate', perm:'admin.matchdays.manage'},
  {id:'leagues', label:'Leghe', perm:'admin.leagues.manage'},
  {id:'tournaments', label:'Tornei', perm:'admin.tournaments.manage'},
  {section: 'AMMINISTRAZIONE'},
  {id:'roles', label:'Ruoli & Permessi', perm:'admin.roles.manage'},
  {id:'users', label:'Utenti', perm:'admin.users.manage'},
  {section: 'MONITORAGGIO'},
  {id:'push', label:'Push Notifiche', perm:'admin.dashboard.view'},
  {id:'payments', label:'Pagamenti', perm:'admin.payments.view'},
  {id:'audit', label:'Audit Log', perm:'admin.audit.view'},
];

function renderDashboard() {
  let navHtml = '<h2>Admin</h2>';
  MENU_ITEMS.forEach(item => {
    if (item.section) {
      navHtml += `<div class="nav-section">${item.section}</div>`;
    } else if (hasPerm(item.perm)) {
      navHtml += `<a href="#" onclick="navigate('${item.id}')" id="nav-${item.id}" data-testid="nav-${item.id}">${item.label}</a>`;
    }
  });
  navHtml += '<div class="spacer"></div>';
  navHtml += `<a href="#" onclick="doLogout()" style="color:#EF4444" data-testid="nav-logout">Logout</a>`;

  document.getElementById('app').innerHTML = `
  <div class="dashboard">
    <div class="hamburger" id="hamburger" onclick="toggleSidebar()" data-testid="hamburger-btn">&#9776;</div>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
    <div class="sidebar" id="sidebar">${navHtml}</div>
    <div class="main" id="content"></div>
  </div>`;

  // Navigate to first available page
  const firstAvail = MENU_ITEMS.find(m => m.id && hasPerm(m.perm));
  navigate(firstAvail ? firstAvail.id : 'forbidden');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

let navFilter = {};
function navigateWith(page, filter) { navFilter = filter || {}; navigate(page); }

function navigate(page) {
  currentPage = page;
  closeSidebar();
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
  const nav = document.getElementById('nav-'+page);
  if(nav) nav.classList.add('active');
  const fn = window['render_'+page];
  if (fn) fn();
  else render_forbidden();
}

function render_forbidden() {
  document.getElementById('content').innerHTML = `
  <div class="forbidden" data-testid="forbidden-page">
    <h2>403 - Accesso Non Autorizzato</h2>
    <p>Non hai i permessi necessari per accedere a questa sezione.</p>
  </div>`;
}

function doLogout() {
  token=null; userPerms=[]; isSuperAdmin=false;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_perms');
  localStorage.removeItem('admin_is_super');
  renderLogin();
}

// ========================================
// DASHBOARD OVERVIEW
// ========================================
async function render_dashboard() {
  if (!hasPerm('admin.dashboard.view')) { render_forbidden(); return; }
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Dashboard</h2><div id="dash-loading" style="color:#94A3B8">Caricamento...</div>';

  try {
    const d = await apiCall('/rbac/dashboard-stats');
    let html = '';

    // === ALLARMI CRITICI ===
    const alarms = [];
    const noOwner = (d.leagues.at_risk || []).filter(l => l.reason.includes('owner'));
    const noAdmin = (d.leagues.at_risk || []).filter(l => l.reason.includes('admin'));
    if (noOwner.length > 0) alarms.push({icon:'!', color:'#EF4444', text:`${noOwner.length} leghe private senza owner`, action:()=>"navigateWith('leagues',{risk:'no_owner'})"});
    if (noAdmin.length > 0) alarms.push({icon:'!', color:'#F59E0B', text:`${noAdmin.length} leghe custom senza admin lega`, action:()=>"navigateWith('leagues',{risk:'no_admin'})"});
    if ((d.payments.pending_count || 0) > 0) alarms.push({icon:'$', color:'#F59E0B', text:`${d.payments.pending_count} pagamenti pending`, action:()=>"navigateWith('payments',{status:'pending'})"});
    const openMd = d.matchdays.OPEN || 0;
    const liveMd = d.matchdays.LIVE || 0;
    if (openMd > 0) alarms.push({icon:'O', color:'#3B82F6', text:`${openMd} giornate OPEN`, action:()=>"navigateWith('matchdays',{status:'OPEN'})"});
    if (liveMd > 0) alarms.push({icon:'L', color:'#10B981', text:`${liveMd} giornate LIVE`, action:()=>"navigateWith('matchdays',{status:'LIVE'})"});

    html += '<div class="card" data-testid="critical-alarms" style="border-color:' + (alarms.length > 0 ? '#EF4444' : '#334155') + '">';
    html += '<h3 style="color:' + (alarms.length > 0 ? '#EF4444' : '#10B981') + ';margin-bottom:12px;font-size:15px">Allarmi Critici</h3>';
    if (alarms.length === 0) {
      html += '<p style="color:#10B981;font-size:14px" data-testid="no-alarms">Nessun problema attivo</p>';
    } else {
      alarms.forEach((a, i) => {
        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:${i>0?'1px solid #334155':'none'};cursor:pointer" onclick="${a.action()}" data-testid="alarm-${i}">
          <span style="width:28px;height:28px;border-radius:50%;background:${a.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${a.icon}</span>
          <span style="flex:1;font-size:14px">${a.text}</span>
          <span style="color:#64748B;font-size:12px">Vai &rarr;</span>
        </div>`;
      });
    }
    html += '</div>';

    // === UTENTI (U1: clickable KPIs + online indicator) ===
    const onlineCount = d.users.online || 0;
    const onlineDot = onlineCount > 0 ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:6px;animation:pulse 1.5s infinite"></span>' : '';
    html += `<div class="card" data-testid="kpi-users">
      <h3 style="color:#F5A623;margin-bottom:12px;font-size:15px">Utenti</h3>
      <div class="counter-row">
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('users',{})" data-testid="kpi-users-total"><div class="num">${d.users.total}</div><div class="label">Attivi</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('users',{filter:'__disabled__'})" data-testid="kpi-users-disabled"><div class="num" style="color:#6B7280">${d.users.disabled}</div><div class="label">Disabilitati</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('users',{filter:'__new_7d__'})" data-testid="kpi-users-new7d"><div class="num" style="color:#10B981">${d.users.new_7d}</div><div class="label">Nuovi 7gg</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('users',{filter:'__login_24h__'})" data-testid="kpi-users-login24h"><div class="num" style="color:#3B82F6">${d.users.recent_logins_24h}</div><div class="label">Login 24h</div></div>
        <div class="counter-box" style="border-color:${onlineCount > 0 ? '#10B981' : '#334155'};cursor:pointer" onclick="navigateWith('users',{filter:'__online__'})" title="Utenti con attivita negli ultimi 5 minuti" data-testid="kpi-users-online"><div class="num" style="color:#10B981">${onlineDot}${onlineCount}</div><div class="label">Online ora</div></div>
      </div>
    </div>`;

    // === LEGHE ===
    const riskCount = d.leagues.at_risk.length;
    const riskColor = riskCount > 0 ? '#EF4444' : '#10B981';
    html += `<div class="card" data-testid="kpi-leagues">
      <h3 style="color:#F5A623;margin-bottom:12px;font-size:15px">Leghe</h3>
      <div class="counter-row">
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('leagues',{})" data-testid="kpi-leagues-total"><div class="num">${d.leagues.total}</div><div class="label">Totale</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('leagues',{type:'national'})" data-testid="kpi-leagues-national"><div class="num" style="color:#10B981">${d.leagues.national_count||0}</div><div class="label">Nazionale</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('leagues',{type:'private_custom'})" data-testid="kpi-leagues-custom"><div class="num" style="color:#3B82F6">${d.leagues.private_custom_count||0}</div><div class="label">Private Custom</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('leagues',{type:'private_national'})" data-testid="kpi-leagues-privnat"><div class="num" style="color:#14B8A6">${d.leagues.private_national_count||0}</div><div class="label">Private Naz.</div></div>
        <div class="counter-box" style="cursor:pointer;border-color:${riskColor}" onclick="navigateWith('leagues',{risk:'all'})" data-testid="kpi-leagues-risk"><div class="num" style="color:${riskColor}">${riskCount}</div><div class="label">A Rischio</div></div>
      </div>`;
    if (riskCount > 0) {
      html += '<div style="margin-top:12px">';
      d.leagues.at_risk.forEach(l => {
        html += `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px">
          <span class="tag tag-disabled">${l.reason}</span>
          <span>${l.name}</span>
          ${hasPerm('admin.leagues.manage') ? `<button class="btn btn-sm btn-outline" onclick="navigateWith('leagues',{risk:'all'})" style="margin-left:auto">Gestisci</button>` : ''}
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';

    // === MATCHDAY ===
    const md = d.matchdays || {};
    html += `<div class="card" data-testid="kpi-matchdays">
      <h3 style="color:#F5A623;margin-bottom:12px;font-size:15px">Giornate</h3>
      <div class="counter-row">
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('matchdays',{status:'DRAFT'})"><div class="num" style="color:#475569">${md.DRAFT||0}</div><div class="label">Bozza</div></div>
        <div class="counter-box" style="cursor:pointer;border-color:#3B82F6" onclick="navigateWith('matchdays',{status:'OPEN'})"><div class="num" style="color:#3B82F6">${md.OPEN||0}</div><div class="label">Open</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('matchdays',{status:'LOCKED'})"><div class="num" style="color:#F59E0B">${md.LOCKED||0}</div><div class="label">Locked</div></div>
        <div class="counter-box" style="cursor:pointer;border-color:#10B981" onclick="navigateWith('matchdays',{status:'LIVE'})"><div class="num" style="color:#10B981">${md.LIVE||0}</div><div class="label">Live</div></div>
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('matchdays',{status:'COMPLETED'})"><div class="num" style="color:#6B7280">${md.COMPLETED||0}</div><div class="label">Completate</div></div>
      </div>
    </div>`;

    // === PAGAMENTI ===
    html += `<div class="card" data-testid="kpi-payments">
      <h3 style="color:#F5A623;margin-bottom:12px;font-size:15px">Pagamenti</h3>
      <div class="counter-row" style="margin-bottom:12px">
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('payments',{status:'pending'})"><div class="num" style="color:#F59E0B">${d.payments.pending_count}</div><div class="label">Pending</div></div>
      </div>`;
    if (d.payments.recent && d.payments.recent.length > 0) {
      html += '<table><tr><th>Data</th><th>Utente</th><th>Importo</th><th>Stato</th></tr>';
      d.payments.recent.forEach(p => {
        const statusCls = p.payment_status === 'paid' ? 'status-live' : p.payment_status === 'pending' ? 'status-LOCKED' : 'status-void';
        html += `<tr style="cursor:pointer" onclick="navigateWith('payments',{})">
          <td style="font-size:12px">${p.created_at ? new Date(p.created_at).toLocaleString('it') : '-'}</td>
          <td style="font-size:12px">${p.user_id ? p.user_id.substring(0,8) : '-'}...</td>
          <td>${p.amount||0} ${p.currency||'EUR'}</td>
          <td><span class="status-badge ${statusCls}">${p.payment_status||'-'}</span></td></tr>`;
      });
      html += '</table>';
    } else {
      html += '<p style="color:#64748B;font-size:13px">Nessun pagamento recente</p>';
    }
    html += '</div>';

    // === AUDIT ===
    html += `<div class="card" data-testid="kpi-audit">
      <h3 style="color:#F5A623;margin-bottom:12px;font-size:15px;cursor:pointer" onclick="navigateWith('audit',{})">Attivita Recente <span style="font-size:12px;color:#64748B">(clicca per tutti)</span></h3>`;
    if (d.audit && d.audit.length > 0) {
      html += '<table><tr><th>Data</th><th>Chi</th><th>Azione</th><th>Entita</th></tr>';
      d.audit.forEach(a => {
        html += `<tr>
          <td style="font-size:12px;white-space:nowrap">${a.created_at ? new Date(a.created_at).toLocaleString('it') : '-'}</td>
          <td>${a.admin_username||'-'}</td>
          <td><span class="status-badge status-OPEN">${a.action||'-'}</span></td>
          <td style="font-size:12px">${a.entity_type||'-'}/${(a.entity_id||'').substring(0,8)}</td></tr>`;
      });
      html += '</table>';
    } else {
      html += '<p style="color:#64748B;font-size:13px">Nessuna attivita recente</p>';
    }
    html += '</div>';

    el.innerHTML = '<h2>Dashboard</h2>' + html;
  } catch(e) { showToast(e.message, 'error'); el.innerHTML = '<h2>Dashboard</h2><p style="color:#EF4444">Errore: '+e.message+'</p>'; }
}

// ========================================
// ROLES & PERMISSIONS
// ========================================
let allPermissions = [];

async function render_roles() {
  if (!hasPerm('admin.roles.manage')) { render_forbidden(); return; }
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Ruoli & Permessi</h2><div id="roles-actions" class="card"></div><div id="roles-list"></div>';

  document.getElementById('roles-actions').innerHTML = `
    <button class="btn" onclick="showCreateRoleModal()" data-testid="create-role-btn">+ Nuovo Ruolo</button>`;

  try {
    const [roles, perms] = await Promise.all([
      apiCall('/rbac/roles'),
      apiCall('/rbac/permissions')
    ]);
    allRolesCache = roles;
    allPermissions = perms;

    let html = '<table><tr><th>Nome</th><th>Descrizione</th><th>Permessi</th><th>Tipo</th><th>Azioni</th></tr>';
    roles.forEach(r => {
      const typeTag = r.is_system ? '<span class="tag tag-system">SISTEMA</span>' : '<span class="tag tag-role">CUSTOM</span>';
      html += `<tr data-testid="role-row-${r.id}">
        <td><strong>${r.name}</strong></td>
        <td style="color:#94A3B8">${r.description||''}</td>
        <td><span class="tag tag-role">${r.permissions.length} permessi</span></td>
        <td>${typeTag}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="showEditRoleModal('${r.id}')" data-testid="edit-role-${r.id}">Modifica</button>
          ${!r.is_system ? `<button class="btn btn-sm btn-danger" onclick="showDeleteRoleModal('${r.id}','${r.name}')" data-testid="delete-role-${r.id}">Elimina</button>` : ''}
        </td></tr>`;
    });
    html += '</table>';
    document.getElementById('roles-list').innerHTML = html;
  } catch(e) { showToast(e.message, 'error'); }
}

function renderPermCheckboxes(selected=[], searchId='perm-search') {
  const perms = allPermissions;
  let html = `<input class="search-bar" id="${searchId}" placeholder="Cerca permesso..." oninput="filterPerms(this)" data-testid="perm-search-input">`;
  html += '<div class="perm-grid" id="perm-grid">';
  perms.forEach(p => {
    const checked = selected.includes(p.key) ? 'checked' : '';
    const cls = checked ? 'checked' : '';
    html += `<label class="perm-item ${cls}" data-perm="${p.key}">
      <input type="checkbox" name="perm" value="${p.key}" ${checked} onchange="this.parentElement.classList.toggle('checked')">
      <span><strong>${p.key.split('.').pop()}</strong><br><span style="color:#64748B;font-size:11px">${p.description}</span></span>
    </label>`;
  });
  html += '</div>';
  return html;
}

function filterPerms(input) {
  const q = input.value.toLowerCase();
  document.querySelectorAll('.perm-item').forEach(el => {
    el.style.display = el.dataset.perm.toLowerCase().includes(q) || el.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
  });
}

function getSelectedPerms() {
  return Array.from(document.querySelectorAll('input[name=perm]:checked')).map(c => c.value);
}

function showCreateRoleModal() {
  showModal(`
    <h3>Nuovo Ruolo</h3>
    <div class="form-row"><input id="new-role-name" placeholder="Nome ruolo" data-testid="new-role-name"></div>
    <div class="form-row"><input id="new-role-desc" placeholder="Descrizione" data-testid="new-role-desc"></div>
    <h4 style="color:#94A3B8;margin:12px 0 4px">Permessi</h4>
    ${renderPermCheckboxes()}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn" onclick="doCreateRole()" data-testid="confirm-create-role">Crea Ruolo</button>
    </div>`);
}

async function doCreateRole() {
  try {
    await apiCall('/rbac/roles', 'POST', {
      name: document.getElementById('new-role-name').value,
      description: document.getElementById('new-role-desc').value,
      permissions: getSelectedPerms()
    });
    closeModal(); showToast('Ruolo creato'); render_roles();
  } catch(e) { showToast(e.message, 'error'); }
}

function showEditRoleModal(roleId) {
  const role = allRolesCache.find(r => r.id === roleId);
  if (!role) return;
  showModal(`
    <h3>Modifica Ruolo: ${role.name}</h3>
    <div class="form-row"><input id="edit-role-name" value="${role.name}" placeholder="Nome ruolo" data-testid="edit-role-name"></div>
    <div class="form-row"><input id="edit-role-desc" value="${role.description||''}" placeholder="Descrizione" data-testid="edit-role-desc"></div>
    <h4 style="color:#94A3B8;margin:12px 0 4px">Permessi</h4>
    ${renderPermCheckboxes(role.permissions)}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn" onclick="doEditRole('${roleId}')" data-testid="confirm-edit-role">Salva</button>
    </div>`);
}

async function doEditRole(roleId) {
  try {
    await apiCall('/rbac/roles/'+roleId, 'PUT', {
      name: document.getElementById('edit-role-name').value,
      description: document.getElementById('edit-role-desc').value,
      permissions: getSelectedPerms()
    });
    closeModal(); showToast('Ruolo aggiornato'); render_roles();
  } catch(e) { showToast(e.message, 'error'); }
}

function showDeleteRoleModal(roleId, roleName) {
  showModal(`
    <h3 style="color:#EF4444">Elimina Ruolo: ${roleName}</h3>
    <p style="margin:12px 0;color:#94A3B8">Questa azione e' irreversibile. Il ruolo verra' rimosso da tutti gli utenti che lo hanno assegnato.</p>
    <p style="margin:8px 0">Digita <strong style="color:#EF4444">DELETE</strong> per confermare:</p>
    <div class="form-row"><input id="delete-confirm" placeholder="Digita DELETE" data-testid="delete-confirm-input"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn btn-danger" onclick="doDeleteRole('${roleId}')" data-testid="confirm-delete-role">Elimina Ruolo</button>
    </div>`);
}

async function doDeleteRole(roleId) {
  if (document.getElementById('delete-confirm').value !== 'DELETE') {
    showToast('Devi digitare DELETE per confermare', 'error'); return;
  }
  try {
    await apiCall('/rbac/roles/'+roleId, 'DELETE');
    closeModal(); showToast('Ruolo eliminato'); render_roles();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// USERS & ROLES
// ========================================
let allUsersCache = [];

async function render_users() {
  if (!hasPerm('admin.users.manage')) { render_forbidden(); return; }
  const pendingFilter = navFilter.filter || '';
  navFilter = {};
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Gestione Utenti</h2><div id="users-filters" class="card"></div><div id="users-counters"></div><div id="users-list"></div>';

  try {
    const [users, roles] = await Promise.all([
      apiCall('/rbac/users'),
      apiCall('/rbac/roles')
    ]);
    allUsersCache = users;
    allRolesCache = roles;

    // Counters
    const totalUsers = users.filter(u => !u.is_deleted).length;
    const superAdmins = users.filter(u => u.is_super_admin && !u.is_deleted).length;
    const disabled = users.filter(u => u.is_disabled && !u.is_deleted).length;
    const deleted = users.filter(u => u.is_deleted).length;
    const withRoles = users.filter(u => u.roles && u.roles.length > 0 && !u.is_deleted).length;

    document.getElementById('users-counters').innerHTML = `
    <div class="counter-row">
      <div class="counter-box"><div class="num">${totalUsers}</div><div class="label">Utenti Attivi</div></div>
      <div class="counter-box"><div class="num" style="color:#EF4444">${superAdmins}</div><div class="label">Super Admin</div></div>
      <div class="counter-box"><div class="num" style="color:#10B981">${withRoles}</div><div class="label">Con Ruoli</div></div>
      <div class="counter-box"><div class="num" style="color:#6B7280">${disabled}</div><div class="label">Disabilitati</div></div>
      <div class="counter-box"><div class="num" style="color:#EF4444">${deleted}</div><div class="label">Eliminati</div></div>
    </div>`;

    // Filter bar
    const roleOpts = roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    document.getElementById('users-filters').innerHTML = `
      <div class="form-row">
        <input class="search-bar" style="margin:0;flex:2" id="user-search" placeholder="Cerca per email o username..." oninput="filterUsers()" data-testid="user-search-input">
        <select id="user-role-filter" onchange="filterUsers()" style="flex:1" data-testid="user-role-filter">
          <option value="">Tutti gli utenti</option>
          <option value="__super__">Super Admin</option>
          <option value="__norole__">Senza ruolo</option>
          <option value="__disabled__">Disabilitati</option>
          <option value="__deleted__">Eliminati (soft)</option>
          <option value="__new_7d__">Nuovi ultimi 7gg</option>
          <option value="__login_24h__">Login ultime 24h</option>
          <option value="__online__">Online ora</option>
          ${roleOpts}
        </select>
        <button class="btn" onclick="showCreateUserModal()" data-testid="create-user-btn" style="white-space:nowrap">+ Nuovo Utente</button>
      </div>`;

    renderUsersTable(users.filter(u => !u.is_deleted));
    // Apply pending filter from dashboard navigation
    if (pendingFilter) {
      document.getElementById('user-role-filter').value = pendingFilter;
      filterUsers();
    }
  } catch(e) { showToast(e.message, 'error'); }
}

function filterUsers() {
  const q = (document.getElementById('user-search').value || '').toLowerCase();
  const roleFilter = document.getElementById('user-role-filter').value;
  let filtered = allUsersCache;
  if (roleFilter !== '__deleted__') filtered = filtered.filter(u => !u.is_deleted);
  if (q) filtered = filtered.filter(u => u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  if (roleFilter === '__super__') filtered = filtered.filter(u => u.is_super_admin);
  else if (roleFilter === '__norole__') filtered = filtered.filter(u => !u.roles || u.roles.length === 0);
  else if (roleFilter === '__disabled__') filtered = filtered.filter(u => u.is_disabled);
  else if (roleFilter === '__deleted__') filtered = filtered.filter(u => u.is_deleted);
  else if (roleFilter === '__new_7d__') {
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    filtered = filtered.filter(u => u.created_at && u.created_at >= sevenDaysAgo);
  }
  else if (roleFilter === '__login_24h__') {
    const oneDayAgo = new Date(Date.now() - 24*60*60*1000).toISOString();
    filtered = filtered.filter(u => u.last_login && u.last_login >= oneDayAgo);
  }
  else if (roleFilter === '__online__') {
    const fiveMinAgo = new Date(Date.now() - 5*60*1000).toISOString();
    filtered = filtered.filter(u => u.last_activity && u.last_activity >= fiveMinAgo);
  }
  else if (roleFilter) filtered = filtered.filter(u => u.role_ids && u.role_ids.includes(roleFilter));
  applySortAndRender(filtered, 'users');
}

// ========================================
// SORTING SYSTEM
// ========================================
let userSortCol = null, userSortDir = 'asc';
let leagueSortCol = null, leagueSortDir = 'asc';
let lastFilteredUsers = [];
let lastFilteredLeagues = [];

function sortArrow(table, col) {
  const sortCol = table === 'users' ? userSortCol : leagueSortCol;
  const sortDir = table === 'users' ? userSortDir : leagueSortDir;
  if (sortCol !== col) return '<span style="opacity:.3;margin-left:4px">&#8597;</span>';
  return sortDir === 'asc' ? '<span style="color:#F5A623;margin-left:4px">&#9650;</span>' : '<span style="color:#F5A623;margin-left:4px">&#9660;</span>';
}

function sortBy(table, col) {
  if (table === 'users') {
    if (userSortCol === col) userSortDir = userSortDir === 'asc' ? 'desc' : 'asc';
    else { userSortCol = col; userSortDir = 'asc'; }
    applySortAndRender(lastFilteredUsers, 'users');
  } else {
    if (leagueSortCol === col) leagueSortDir = leagueSortDir === 'asc' ? 'desc' : 'asc';
    else { leagueSortCol = col; leagueSortDir = 'asc'; }
    applySortAndRender(lastFilteredLeagues, 'leagues');
  }
}

function applySortAndRender(items, table) {
  if (table === 'users') {
    lastFilteredUsers = items;
    if (userSortCol) {
      items = [...items].sort((a, b) => {
        let va = '', vb = '';
        if (userSortCol === 'username') { va = (a.username||'').toLowerCase(); vb = (b.username||'').toLowerCase(); }
        else if (userSortCol === 'email') { va = (a.email||'').toLowerCase(); vb = (b.email||'').toLowerCase(); }
        else if (userSortCol === 'created_at') { va = a.created_at||''; vb = b.created_at||''; }
        else if (userSortCol === 'last_login') { va = a.last_login||''; vb = b.last_login||''; }
        if (va < vb) return userSortDir === 'asc' ? -1 : 1;
        if (va > vb) return userSortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    renderUsersTable(items);
  } else {
    lastFilteredLeagues = items;
    if (leagueSortCol) {
      items = [...items].sort((a, b) => {
        let va = '', vb = '';
        if (leagueSortCol === 'name') { va = (a.name||'').toLowerCase(); vb = (b.name||'').toLowerCase(); }
        else if (leagueSortCol === 'member_count') { va = a.member_count||0; vb = b.member_count||0; }
        else if (leagueSortCol === 'created_at') { va = a.created_at||''; vb = b.created_at||''; }
        if (va < vb) return leagueSortDir === 'asc' ? -1 : 1;
        if (va > vb) return leagueSortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    renderLeaguesTable(items);
  }
}

function renderUsersTable(users) {
  const sh = (col) => sortArrow('users', col);
  let html = `<table><tr>
    <th style="cursor:pointer" onclick="sortBy('users','username')">Username ${sh('username')}</th>
    <th style="cursor:pointer" onclick="sortBy('users','email')">Email ${sh('email')}</th>
    <th>Ruoli</th>
    <th>Leghe</th>
    <th style="cursor:pointer" onclick="sortBy('users','created_at')">Iscrizione ${sh('created_at')}</th>
    <th style="cursor:pointer" onclick="sortBy('users','last_login')">Ultimo Login ${sh('last_login')}</th>
    <th>Stato</th>
    <th>Azioni</th></tr>`;
  users.forEach(u => {
    let tags = '';
    if (u.is_super_admin) tags += '<span class="tag tag-super">SUPER ADMIN</span> ';
    if (u.is_deleted) tags += '<span class="tag tag-disabled">ELIMINATO</span> ';
    else if (u.is_disabled) tags += '<span class="tag tag-disabled">DISABILITATO</span> ';
    (u.roles||[]).forEach(r => { tags += `<span class="tag tag-role">${r.name}</span> `; });
    if (!u.is_super_admin && (!u.roles || u.roles.length === 0) && !u.is_deleted) tags += '<span class="tag" style="color:#475569">Nessun ruolo</span>';

    const leagueHtml = `<span style="font-size:12px;color:#94A3B8">${u.leagues_created||0}C / ${u.leagues_admin||0}A / ${u.leagues_member||0}M</span>`;
    const createdAt = u.created_at ? new Date(u.created_at).toLocaleDateString('it') : '-';
    const lastLogin = u.last_login ? new Date(u.last_login).toLocaleString('it') : '<span style="color:#475569">Mai</span>';
    const statusBadge = u.is_deleted
      ? '<span class="status-badge status-void">Eliminato</span>'
      : u.is_disabled
        ? '<span class="status-badge status-void">Disabilitato</span>'
        : '<span class="status-badge status-live">Attivo</span>';

    html += `<tr data-testid="user-row-${u.id}" style="${u.is_deleted ? 'opacity:.35' : u.is_disabled ? 'opacity:.5' : ''}">
      <td><strong>${u.username}</strong></td>
      <td style="color:#94A3B8;font-size:12px">${u.email}</td>
      <td>${tags}</td>
      <td>${leagueHtml}</td>
      <td style="font-size:12px;color:#94A3B8">${createdAt}</td>
      <td style="font-size:12px">${lastLogin}</td>
      <td>${statusBadge}</td>
      <td><button class="btn btn-sm btn-outline" onclick="showUserControlRoom('${u.id}')" data-testid="control-user-${u.id}">Control Room</button></td></tr>`;
  });
  html += '</table>';
  document.getElementById('users-list').innerHTML = html;
}

// ========================================
// USER CONTROL ROOM (unified)
// ========================================
let ucrTab = 'info';
let ucrUserId = null;
let ucrUserLeagues = null;
let ucrAuditLog = null;

async function showUserControlRoom(userId, tab) {
  ucrUserId = userId;
  ucrTab = tab || 'info';
  const u = allUsersCache.find(x => x.id === userId);
  if (!u) return;

  const statusTag = u.is_deleted
    ? '<span class="tag tag-disabled">ELIMINATO</span>'
    : u.is_disabled
      ? '<span class="tag tag-disabled">DISABILITATO</span>'
      : '<span class="tag" style="background:rgba(16,185,129,.15);color:#10B981;border:1px solid rgba(16,185,129,.3)">ATTIVO</span>';

  const tabs = [
    {id:'info', label:'Info & Profilo'},
    {id:'edit', label:'Modifica'},
    {id:'leagues', label:'Leghe & Ruoli'},
    {id:'activity', label:'Attivita'},
  ];
  const tabsHtml = tabs.map(t => `<button class="btn btn-sm ${ucrTab===t.id?'':'btn-outline'}" onclick="showUserControlRoom('${userId}','${t.id}')" data-testid="ucr-tab-${t.id}" style="${ucrTab===t.id?'':'opacity:.6'}">${t.label}</button>`).join(' ');

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:12px">
      <h3 style="margin:0">${u.username}</h3>
      ${u.is_super_admin ? '<span class="tag tag-super">SUPER ADMIN</span>' : ''}
      ${statusTag}
      ${u.auth_provider === 'google' ? '<span class="tag tag-role">GOOGLE</span>' : ''}
    </div>
    <button class="btn btn-outline btn-sm" onclick="closeModal()">X</button>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid #334155;padding-bottom:12px">${tabsHtml}</div>
  <div id="ucr-body"></div>`;
  showModal(html);

  const body = document.getElementById('ucr-body');
  if (ucrTab === 'info') body.innerHTML = renderUcrInfo(u);
  else if (ucrTab === 'edit') body.innerHTML = renderUcrEdit(u);
  else if (ucrTab === 'leagues') { body.innerHTML = '<p style="color:#94A3B8">Caricamento...</p>'; await loadUcrLeagues(u); }
  else if (ucrTab === 'activity') { body.innerHTML = '<p style="color:#94A3B8">Caricamento...</p>'; await loadUcrActivity(u); }
}

function renderUcrInfo(u) {
  const fiveMinAgo = new Date(Date.now() - 5*60*1000).toISOString();
  const isOnline = u.last_activity && u.last_activity >= fiveMinAgo;
  const onlineIndicator = isOnline ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:6px;animation:pulse 1.5s infinite"></span><span style="color:#10B981">Online</span>' : '<span style="color:#64748B">Offline</span>';
  const rolesHtml = (u.roles||[]).length > 0 ? u.roles.map(r => `<span class="tag tag-role">${r.name}</span>`).join(' ') : '<span style="color:#475569">Nessun ruolo RBAC</span>';

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
      <div><span style="color:#94A3B8">ID:</span> <code style="color:#F5A623;font-size:11px">${u.id.substring(0,20)}...</code></div>
      <div><span style="color:#94A3B8">Email:</span> <strong>${u.email}</strong></div>
      <div><span style="color:#94A3B8">Username:</span> <strong>${u.username}</strong></div>
      <div><span style="color:#94A3B8">Auth Provider:</span> <strong>${u.auth_provider || 'email'}</strong></div>
      <div><span style="color:#94A3B8">Registrato:</span> ${u.created_at ? new Date(u.created_at).toLocaleString('it') : '-'}</div>
      <div><span style="color:#94A3B8">Ultimo Login:</span> ${u.last_login ? new Date(u.last_login).toLocaleString('it') : 'Mai'}</div>
      <div><span style="color:#94A3B8">Ultima Attivita:</span> ${u.last_activity ? new Date(u.last_activity).toLocaleString('it') : 'Mai'}</div>
      <div><span style="color:#94A3B8">Stato:</span> ${onlineIndicator}</div>
    </div>
    <div style="margin-top:16px">
      <span style="color:#94A3B8;font-size:13px">Ruoli RBAC:</span> ${rolesHtml}
    </div>
    <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div class="counter-box" style="text-align:center"><div class="num" style="font-size:20px;color:#F5A623">${u.leagues_created||0}</div><div class="label">Leghe Create</div></div>
      <div class="counter-box" style="text-align:center"><div class="num" style="font-size:20px;color:#3B82F6">${u.leagues_admin||0}</div><div class="label">Admin Lega</div></div>
      <div class="counter-box" style="text-align:center"><div class="num" style="font-size:20px;color:#10B981">${u.leagues_member||0}</div><div class="label">Membro</div></div>
    </div>`;
}

function renderUcrEdit(u) {
  const isGoogle = u.auth_provider === 'google';
  return `
    <div style="margin-bottom:12px">
      <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Username</label>
      <input id="edit-user-username" value="${u.username}" style="width:100%;padding:10px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:14px" data-testid="edit-user-username">
    </div>
    <div style="margin-bottom:12px">
      <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Email</label>
      <input id="edit-user-email" value="${u.email}" style="width:100%;padding:10px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:14px" data-testid="edit-user-email">
    </div>
    <div style="text-align:right;margin-bottom:20px">
      <button class="btn" onclick="doEditUser('${u.id}')" data-testid="confirm-edit-user-btn">Salva Modifiche Profilo</button>
    </div>

    ${!isGoogle ? `
    <h4 style="color:#94A3B8;margin:16px 0 8px;font-size:14px">Reset Password</h4>
    <div id="reset-link-result"></div>
    <button class="btn btn-sm" style="background:#7C3AED;color:#fff" onclick="doGenerateResetLink('${u.id}')" data-testid="generate-reset-link-btn">Genera Link Reset Password</button>
    <p style="color:#64748B;font-size:11px;margin-top:6px">Il link viene mostrato qui per essere copiato e inviato manualmente all\\'utente.</p>
    ` : '<p style="color:#F59E0B;font-size:12px;margin:12px 0">Utente Google - il reset password non e disponibile</p>'}

    <div style="margin-top:24px;padding:16px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px">
      <h4 style="color:#EF4444;margin-bottom:12px;font-size:14px">Zona Pericolo</h4>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="btn btn-sm ${u.is_disabled ? '' : 'btn-danger'}" style="${u.is_disabled ? 'background:#10B981;color:#fff' : ''}" onclick="toggleUserStatusCR('${u.id}')" data-testid="toggle-status-${u.id}">
          ${u.is_disabled ? 'Riabilita Utente' : 'Disabilita Utente'}
        </button>
        ${isSuperAdmin ? `<button class="btn btn-sm ${u.is_super_admin ? 'btn-danger' : ''}" style="${!u.is_super_admin ? 'background:#F5A623;color:#0F172A' : ''}" onclick="toggleSuperAdminCR('${u.id}',${!u.is_super_admin})" data-testid="toggle-sa-${u.id}">
          ${u.is_super_admin ? 'Rimuovi Super Admin' : 'Promuovi Super Admin'}
        </button>` : ''}
        <button class="btn btn-sm" style="background:#7C3AED;color:#fff" onclick="showSoftDeleteInCR('${u.id}')" data-testid="soft-delete-${u.id}">Elimina Utente (Soft)</button>
      </div>
      <div id="soft-delete-zone" style="margin-top:12px"></div>
    </div>`;
}

async function loadUcrLeagues(u) {
  try {
    const [leagues] = await Promise.all([
      apiCall('/rbac/users/' + u.id + '/leagues')
    ]);
    ucrUserLeagues = leagues;
    document.getElementById('ucr-body').innerHTML = renderUcrLeagues(u, leagues);
  } catch(e) { showToast(e.message, 'error'); }
}

function renderUcrLeagues(u, leagues) {
  let leaguesHtml = '';
  if (leagues.length === 0) {
    leaguesHtml = '<p style="color:#94A3B8;margin:12px 0">Nessuna lega</p>';
  } else {
    leaguesHtml = '<table style="font-size:13px"><tr><th>Lega</th><th>Tipo</th><th>Ruolo</th><th>Owner</th><th>Iscritto</th></tr>';
    leagues.forEach(l => {
      const ownerTag = l.is_owner ? '<span class="tag tag-super">OWNER</span>' : '';
      const creatorTag = l.is_creator ? '<span class="tag tag-system">CREATOR</span>' : '';
      leaguesHtml += `<tr>
        <td><strong>${l.league_name}</strong></td>
        <td><span class="tag tag-role">${l.league_type}</span></td>
        <td>${l.membership_role}</td>
        <td>${ownerTag} ${creatorTag}</td>
        <td style="font-size:12px">${l.joined_at ? new Date(l.joined_at).toLocaleDateString('it') : '-'}</td></tr>`;
    });
    leaguesHtml += '</table>';
  }

  // RBAC Roles assignment
  const currentRoleIds = u.role_ids || [];
  let rolesHtml = '<div id="role-assign-list">';
  allRolesCache.forEach(r => {
    const checked = currentRoleIds.includes(r.id) ? 'checked' : '';
    const cls = checked ? 'checked' : '';
    rolesHtml += `<label class="perm-item ${cls}" style="margin-bottom:6px" data-perm="${r.id}">
      <input type="checkbox" name="assign-role" value="${r.id}" ${checked} onchange="this.parentElement.classList.toggle('checked')">
      <span><strong>${r.name}</strong><br><span style="color:#64748B;font-size:11px">${r.description||''} (${r.permissions.length} permessi)</span></span>
    </label>`;
  });
  rolesHtml += '</div>';

  return `
    <h4 style="color:#F5A623;margin:0 0 12px;font-size:14px">Leghe (${leagues.length})</h4>
    ${leaguesHtml}
    <h4 style="color:#F5A623;margin:20px 0 12px;font-size:14px">Ruoli RBAC</h4>
    ${rolesHtml}
    <div style="text-align:right;margin-top:12px">
      <button class="btn" onclick="doAssignRoles('${u.id}')" data-testid="confirm-assign-roles">Salva Ruoli</button>
    </div>`;
}

async function loadUcrActivity(u) {
  try {
    const logs = await apiCall('/rbac/users/' + u.id + '/audit-log?limit=30');
    ucrAuditLog = logs;
    document.getElementById('ucr-body').innerHTML = renderUcrActivity(u, logs);
  } catch(e) {
    document.getElementById('ucr-body').innerHTML = '<p style="color:#EF4444">Errore nel caricamento audit log</p>';
  }
}

function renderUcrActivity(u, logs) {
  if (logs.length === 0) return '<p style="color:#94A3B8;margin:12px 0">Nessuna attivita registrata.</p>';

  let html = '<table style="font-size:12px"><tr><th>Data</th><th>Azione</th><th>Tipo</th><th>Dettagli</th><th>Ruolo</th></tr>';
  logs.forEach(l => {
    const isActor = l.admin_id === u.id;
    const roleLabel = isActor ? '<span style="color:#3B82F6">Attore</span>' : '<span style="color:#F59E0B">Target</span>';
    const date = l.created_at ? new Date(l.created_at).toLocaleString('it') : '-';
    const details = l.details ? JSON.stringify(l.details).substring(0, 80) : '-';
    html += `<tr>
      <td style="white-space:nowrap">${date}</td>
      <td><strong>${l.action || '-'}</strong></td>
      <td>${l.entity_type || '-'}</td>
      <td style="color:#94A3B8;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${details}">${details}</td>
      <td>${roleLabel}</td></tr>`;
  });
  html += '</table>';
  return html;
}

// === User CR action helpers ===
async function toggleUserStatusCR(userId) {
  const user = allUsersCache.find(u => u.id === userId);
  const action = user && user.is_disabled ? 'riabilitare' : 'disabilitare';
  if (!confirm(`Vuoi ${action} l\\'utente ${user ? user.username : ''}?`)) return;
  try {
    await apiCall('/rbac/users/'+userId+'/status', 'PUT');
    showToast('Stato utente aggiornato');
    const users = await apiCall('/rbac/users');
    allUsersCache = users;
    showUserControlRoom(userId, 'edit');
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleSuperAdminCR(userId, value) {
  const user = allUsersCache.find(u => u.id === userId);
  const action = value ? 'promuovere a Super Admin' : 'rimuovere lo status di Super Admin da';
  if (!confirm(`Vuoi ${action} ${user ? user.username : ''}?`)) return;
  try {
    await apiCall('/rbac/users/'+userId+'/super-admin', 'PUT', {is_super_admin: value});
    showToast('Super Admin aggiornato');
    const users = await apiCall('/rbac/users');
    allUsersCache = users;
    showUserControlRoom(userId, 'edit');
  } catch(e) { showToast(e.message, 'error'); }
}

function showSoftDeleteInCR(userId) {
  const user = allUsersCache.find(u => u.id === userId);
  if (!user) return;
  const zone = document.getElementById('soft-delete-zone');
  zone.innerHTML = `
    ${user.leagues_created > 0 || user.leagues_admin > 0 ? `<p style="color:#F59E0B;font-size:12px;margin-bottom:8px">Attenzione: l\\'utente ha ${user.leagues_created} leghe create e ${user.leagues_admin} ruoli admin. Se e l\\'unico admin/owner, dovrai trasferire la ownership prima.</p>` : ''}
    <p style="font-size:12px;margin-bottom:8px">Digita <strong style="color:#7C3AED">DELETE</strong> per confermare:</p>
    <div style="display:flex;gap:8px;align-items:center">
      <input id="soft-delete-confirm" placeholder="Digita DELETE" style="padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="soft-delete-confirm-input">
      <button class="btn btn-sm" style="background:#7C3AED;color:#fff" onclick="doSoftDeleteCR('${userId}')" data-testid="confirm-soft-delete">Conferma Eliminazione</button>
    </div>`;
}

async function doSoftDeleteCR(userId) {
  if (document.getElementById('soft-delete-confirm').value !== 'DELETE') {
    showToast('Devi digitare DELETE per confermare', 'error'); return;
  }
  try {
    await apiCall('/rbac/users/' + userId + '/soft-delete', 'PUT');
    closeModal();
    showToast('Utente eliminato (soft)');
    render_users();
  } catch(e) {
    let msg = e.message;
    try {
      const parsed = JSON.parse(e.message.replace(/^[^{]*/, ''));
      if (parsed.orphan_leagues) msg = parsed.message + ' Leghe: ' + parsed.orphan_leagues.map(l => l.name).join(', ');
    } catch(ignore) {}
    showToast(msg, 'error');
  }
}

async function doAssignRoles(userId) {
  const roleIds = Array.from(document.querySelectorAll('input[name=assign-role]:checked')).map(c => c.value);
  try {
    await apiCall('/rbac/users/'+userId+'/roles', 'PUT', {role_ids: roleIds});
    showToast('Ruoli aggiornati');
    const users = await apiCall('/rbac/users');
    allUsersCache = users;
    showUserControlRoom(userId, 'leagues');
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// CREATE NEW USER (Admin)
// ========================================
function showCreateUserModal() {
  const html = `<h3>Nuovo Utente</h3>
    <p style="color:#94A3B8;font-size:13px;margin-bottom:16px">L\\'utente verra creato con email verificata e consensi accettati.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Nome *</label>
        <input id="nu-fname" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-fname">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Cognome *</label>
        <input id="nu-lname" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-lname">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Email *</label>
        <input id="nu-email" type="email" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-email">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Username (opzionale)</label>
        <input id="nu-username" placeholder="Auto-generato se vuoto" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-username">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Data di Nascita * (YYYY-MM-DD)</label>
        <input id="nu-dob" type="date" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-dob">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Password * (min 8 caratteri)</label>
        <input id="nu-pass" type="password" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-password">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Indirizzo</label>
        <input id="nu-addr" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-address">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Citta</label>
        <input id="nu-city" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-city">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Paese</label>
        <input id="nu-country" value="Italia" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-country">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">CAP</label>
        <input id="nu-cap" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-user-cap">
      </div>
    </div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn" onclick="doCreateUser()" data-testid="confirm-create-user-btn">Crea Utente</button>
    </div>`;
  showModal(html);
}

async function doCreateUser() {
  const body = {
    first_name: document.getElementById('nu-fname').value.trim(),
    last_name: document.getElementById('nu-lname').value.trim(),
    email: document.getElementById('nu-email').value.trim(),
    username: document.getElementById('nu-username').value.trim() || undefined,
    date_of_birth: document.getElementById('nu-dob').value,
    password: document.getElementById('nu-pass').value,
    address: document.getElementById('nu-addr').value.trim(),
    city: document.getElementById('nu-city').value.trim(),
    country: document.getElementById('nu-country').value.trim(),
    postal_code: document.getElementById('nu-cap').value.trim(),
  };

  if (!body.first_name || !body.last_name || !body.email || !body.date_of_birth || !body.password) {
    showToast('Compila tutti i campi obbligatori (*)', 'error'); return;
  }

  try {
    const res = await apiCall('/rbac/users/create', 'POST', body);
    closeModal();
    showToast('Utente creato: ' + res.username);
    render_users();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// CREATE NEW LEAGUE (Admin)
// ========================================
async function showCreateLeagueModal() {
  // Fetch seasons for the dropdown
  let seasons = [];
  try {
    seasons = await apiCall('/leagues/seasons');
  } catch(e) {
    try { seasons = await apiCall('/admin/seasons'); } catch(e2) {}
  }

  const seasonOpts = seasons.map(s => `<option value="${s.id}">${s.name} (${s.year})</option>`).join('');

  const marketFields = [
    {key:'1x2', label:'1X2', defEnabled:true, defPts:1},
    {key:'over_under', label:'Over/Under', defEnabled:true, defPts:0.5},
    {key:'goal_no_goal', label:'Goal/No Goal', defEnabled:true, defPts:0.5},
    {key:'exact_score', label:'Risultato Esatto', defEnabled:true, defPts:4},
  ];
  let marketsInputs = '';
  marketFields.forEach(m => {
    marketsInputs += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <label style="flex:1;color:#94A3B8;font-size:13px">${m.label}</label>
      <label style="font-size:12px;color:#94A3B8"><input type="checkbox" id="nl-${m.key}-on" ${m.defEnabled?'checked':''} style="margin-right:4px">Attivo</label>
      <input id="nl-${m.key}-pts" type="number" step="0.5" min="0" value="${m.defPts}" style="width:70px;padding:6px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px">
      <span style="color:#64748B;font-size:11px">pt</span>
    </div>`;
  });

  const html = `<h3>Nuova Lega</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Nome Lega * (3-40 caratteri)</label>
        <input id="nl-name" maxlength="40" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-league-name">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Stagione *</label>
        <select id="nl-season" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-league-season">
          ${seasonOpts}
        </select>
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Tipo Sorgente Match</label>
        <select id="nl-source" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-league-source">
          <option value="national">Nazionale (eredita match dalla Lega Nazionale)</option>
          <option value="custom">Personalizzata (match custom)</option>
        </select>
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Minuti prima del fischio d\\'inizio</label>
        <input id="nl-deadline" type="number" min="0" max="60" value="5" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-league-deadline">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Giornata Inizio</label>
        <input id="nl-start" type="number" min="1" max="38" value="1" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-league-start">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Giornata Fine</label>
        <input id="nl-end" type="number" min="1" max="38" value="38" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-league-end">
      </div>
      <div style="grid-column:span 2">
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Pronostici Campionato</label>
        <select id="nl-champ" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="new-league-champ">
          <option value="false">No</option>
          <option value="true">Si</option>
        </select>
      </div>
    </div>

    <h4 style="color:#F5A623;margin:16px 0 8px;font-size:14px">Mercati e Punteggi</h4>
    ${marketsInputs}

    <p style="color:#94A3B8;font-size:12px;margin-top:12px">L\\'admin corrente sara impostato come owner della nuova lega.</p>

    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn" onclick="doCreateLeague()" data-testid="confirm-create-league-btn">Crea Lega</button>
    </div>`;
  showModal(html);
}

async function doCreateLeague() {
  const scoring_config = {};
  ['1x2','over_under','goal_no_goal','exact_score'].forEach(k => {
    scoring_config[k] = {
      enabled: document.getElementById('nl-'+k+'-on').checked,
      points: parseFloat(document.getElementById('nl-'+k+'-pts').value) || 0
    };
  });

  const body = {
    name: document.getElementById('nl-name').value.trim(),
    season_id: document.getElementById('nl-season').value,
    match_source_type: document.getElementById('nl-source').value,
    bet_deadline_minutes: parseInt(document.getElementById('nl-deadline').value) || 5,
    start_matchday: parseInt(document.getElementById('nl-start').value) || 1,
    end_matchday: parseInt(document.getElementById('nl-end').value) || 38,
    include_championship_predictions: document.getElementById('nl-champ').value === 'true',
    scoring_config: scoring_config,
  };

  if (!body.name || body.name.length < 3) {
    showToast('Il nome deve avere almeno 3 caratteri', 'error'); return;
  }

  try {
    const res = await apiCall('/rbac/leagues/create', 'POST', body);
    closeModal();
    showToast('Lega creata: ' + res.name + ' (codice: ' + res.invite_code + ')');
    render_leagues();
  } catch(e) { showToast(e.message, 'error'); }
}

async function doEditUser(userId) {
  const newUsername = document.getElementById('edit-user-username').value.trim();
  const newEmail = document.getElementById('edit-user-email').value.trim();
  const user = allUsersCache.find(u => u.id === userId);
  if (!user) return;

  const body = {};
  if (newUsername && newUsername !== user.username) body.username = newUsername;
  if (newEmail && newEmail !== user.email) body.email = newEmail;

  if (Object.keys(body).length === 0) {
    showToast('Nessuna modifica rilevata', 'error');
    return;
  }

  try {
    await apiCall('/rbac/users/' + userId, 'PUT', body);
    showToast('Utente aggiornato');
    const users = await apiCall('/rbac/users');
    allUsersCache = users;
    showUserControlRoom(userId, 'edit');
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// U3: GENERATE PASSWORD RESET LINK
// ========================================
async function doGenerateResetLink(userId) {
  try {
    const res = await apiCall('/rbac/users/' + userId + '/reset-password-link', 'POST');
    const resultDiv = document.getElementById('reset-link-result');
    resultDiv.innerHTML = `
      <div class="card" style="border-color:#7C3AED;margin-bottom:12px">
        <p style="color:#10B981;font-size:13px;margin-bottom:8px">Link generato con successo! Scade: ${new Date(res.expires_at).toLocaleString('it')}</p>
        <p style="color:#94A3B8;font-size:12px;margin-bottom:8px">Copia e invia manualmente questo link all\\'utente (${res.user_email}):</p>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="reset-link-url" value="${res.reset_url}" readonly style="flex:1;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F5A623;font-size:12px" data-testid="reset-link-url">
          <button class="btn btn-sm" onclick="copyResetLink()" data-testid="copy-reset-link-btn">Copia</button>
        </div>
      </div>`;
    showToast('Link reset password generato');
  } catch(e) { showToast(e.message, 'error'); }
}

function copyResetLink() {
  const input = document.getElementById('reset-link-url');
  if (input) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Link copiato negli appunti');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Link copiato');
    });
  }
}

// ========================================
// SEASONS (existing)
// ========================================
async function render_seasons() {
  if (!hasPerm('admin.seasons.manage')) { render_forbidden(); return; }
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Stagioni</h2><div id="season-form" class="card"></div><div id="season-list"></div>';
  document.getElementById('season-form').innerHTML = `
    <div class="form-row">
      <input id="s-name" placeholder="Nome stagione">
      <input id="s-year" placeholder="Anno (es. 2024-2025)">
      <input id="s-start" type="date" placeholder="Inizio">
      <input id="s-end" type="date" placeholder="Fine">
      <button class="btn" onclick="createSeason()">Crea</button>
    </div>`;
  const seasons = await apiCall('/admin/seasons');
  let html = '<table><tr><th>Nome</th><th>Anno</th><th>Attiva</th><th>Azioni</th></tr>';
  seasons.forEach(s => {
    html += `<tr><td>${s.name}</td><td>${s.year}</td><td>${s.is_active?'Si':'No'}</td>
    <td><button class="btn btn-sm" onclick="toggleSeason('${s.id}',${!s.is_active})">${s.is_active?'Disattiva':'Attiva'}</button></td></tr>`;
  });
  html += '</table>';
  document.getElementById('season-list').innerHTML = html;
}

async function createSeason() {
  try {
    await apiCall('/admin/seasons', 'POST', {
      name: document.getElementById('s-name').value,
      year: document.getElementById('s-year').value,
      start_date: document.getElementById('s-start').value,
      end_date: document.getElementById('s-end').value,
      is_active: true
    });
    showToast('Stagione creata'); render_seasons();
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleSeason(id, active) {
  await apiCall('/admin/seasons/'+id, 'PUT', {is_active: active});
  showToast('Stagione aggiornata'); render_seasons();
}

// ========================================
// MATCHDAYS (existing)
// ========================================
async function render_matchdays() {
  if (!hasPerm('admin.matchdays.manage')) { render_forbidden(); return; }
  const statusFilter = navFilter.status || '';
  navFilter = {};
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Giornate</h2><div id="md-controls" class="card"></div><div id="md-filter" class="card"></div><div id="md-list"></div>';

  // Load leagues + seasons + tournaments
  const [leagues, seasons, tournaments] = await Promise.all([
    apiCall('/rbac/leagues'),
    apiCall('/admin/seasons'),
    hasPerm('admin.tournaments.manage') ? apiCall('/admin/tournaments').catch(() => []) : Promise.resolve([])
  ]);
  allLeaguesCache = leagues;
  const seasonOpts = seasons.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  // League selector: default to "all" if status filter from dashboard, else national
  const defaultAll = !!statusFilter;
  let leagueOpts = `<option value="all" ${defaultAll ? 'selected' : ''}>Tutte le leghe</option>`;
  leagueOpts += leagues.map(l => {
    const sel = !defaultAll && l.league_type === 'national' ? 'selected' : '';
    const src = l.match_source_type === 'national' ? ' (eredita naz.)' : l.match_source_type === 'custom' ? ' (custom)' : '';
    return `<option value="${l.id}" ${sel}>${l.name}${src}</option>`;
  }).join('');

  // Add tournaments to dropdown
  const activeTournaments = tournaments.filter(t => ['groups','knockout'].includes(t.status));
  if (activeTournaments.length > 0) {
    leagueOpts += '<option disabled style="color:#F5A623">── TORNEI ──</option>';
    leagueOpts += activeTournaments.map(t => `<option value="tourn_${t.id}">⚡ ${t.name} (Torneo)</option>`).join('');
  }
  window._tournamentsCache = tournaments;

  document.getElementById('md-controls').innerHTML = `
    <div class="form-row" style="align-items:flex-end">
      <div style="flex:2">
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Seleziona Lega</label>
        <select id="md-league" onchange="onMdLeagueChange()" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9" data-testid="md-league-selector">${leagueOpts}</select>
      </div>
      <div id="md-create-zone" style="flex:3"></div>
    </div>`;

  document.getElementById('md-filter').innerHTML = `
    <div class="form-row">
      <select id="md-status-filter" onchange="filterMatchdays()" data-testid="md-status-filter">
        <option value="">Tutti gli stati</option>
        <option value="DRAFT" ${statusFilter==='DRAFT'?'selected':''}>BOZZA</option>
        <option value="OPEN" ${statusFilter==='OPEN'?'selected':''}>OPEN</option>
        <option value="LOCKED" ${statusFilter==='LOCKED'?'selected':''}>LOCKED</option>
        <option value="LIVE" ${statusFilter==='LIVE'?'selected':''}>LIVE</option>
        <option value="COMPLETED" ${statusFilter==='COMPLETED'?'selected':''}>COMPLETATE</option>
      </select>
    </div>`;

  window._mdSeasons = seasons;
  onMdLeagueChange();
}

let mdSortCol = 'number', mdSortDir = 'asc';

function onMdLeagueChange() {
  const leagueId = document.getElementById('md-league').value;
  const isAll = leagueId === 'all';
  const isTournament = leagueId.startsWith('tourn_');
  const tournId = isTournament ? leagueId.replace('tourn_', '') : null;
  const league = (!isAll && !isTournament) ? allLeaguesCache.find(l => l.id === leagueId) : null;
  const isNational = league && league.league_type === 'national';
  const isCustom = league && league.match_source_type !== 'national';
  const canManage = !isAll && !isTournament && (isNational || isCustom);

  // Show create form only for manageable leagues
  const createZone = document.getElementById('md-create-zone');
  const manageableLeagues = allLeaguesCache.filter(l => l.league_type === 'national' || l.match_source_type !== 'national');

  if (isTournament) {
    // Tournament mode: show create round button
    createZone.innerHTML = `
      <div class="form-row" style="margin:0">
        <input id="md-label" placeholder="Etichetta (es. Giornata 2)" style="flex:1">
        <button class="btn" onclick="createTournamentMatchday('${tournId}')" data-testid="create-tourn-md-btn">+ Crea Giornata Torneo</button>
      </div>`;
    loadTournamentMatchdays(tournId);
    return;
  }

  if (canManage || isAll) {
    const sOpts = (window._mdSeasons||[]).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const leaguePicker = isAll
      ? `<select id="md-create-league" style="flex:1" onchange="updateAvailableNumbers()">${manageableLeagues.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select>`
      : '';
    createZone.innerHTML = `
      <div class="form-row" style="margin:0">
        ${leaguePicker}
        <select id="md-season" style="flex:1">${sOpts}</select>
        <select id="md-num" style="width:120px" data-testid="md-num-select" onchange="document.getElementById('md-label').value='Giornata '+this.value"><option value="">Giornata...</option></select>
        <input id="md-label" placeholder="Etichetta" style="flex:1">
        <select id="md-half" style="width:90px"><option value="1">Andata</option><option value="2">Ritorno</option></select>
        <input id="md-kickoff" type="datetime-local" style="flex:1">
        <button class="btn" onclick="createMatchday()" data-testid="create-md-btn">+ Crea</button>
      </div>`;
    // Populate available numbers after rendering
    setTimeout(() => updateAvailableNumbers(), 100);
  } else {
    createZone.innerHTML = isAll
      ? '<p style="color:#94A3B8;font-size:12px;margin:8px 0">Vista globale: seleziona una lega specifica per creare giornate.</p>'
      : '<p style="color:#94A3B8;font-size:12px;margin:8px 0">Lega con sorgente nazionale: le giornate sono ereditate. Puoi solo visualizzare.</p>';
  }
  loadMatchdays();
}

async function loadMatchdays() {
  const leagueId = document.getElementById('md-league').value;
  if (leagueId.startsWith('tourn_')) return; // handled by loadTournamentMatchdays
  try {
    const mds = await apiCall('/admin/matchdays?league_id=' + leagueId);
    window._allMatchdays = mds;
    filterMatchdays();
  } catch(e) {
    // Fallback: national league default
    const mds = await apiCall('/admin/matchdays');
    window._allMatchdays = mds;
    filterMatchdays();
  }
}

async function loadTournamentMatchdays(tournId) {
  try {
    const rounds = await apiCall('/admin/tournament-rounds/' + tournId);
    window._allMatchdays = rounds.map(r => ({
      id: r.id,
      number: r.round_number,
      label: r.label || ('Giornata ' + r.round_number),
      status: r.status,
      half: 1,
      first_kickoff: r.created_at,
      match_count: r.match_count || 0,
      _is_tournament: true,
      _tournament_id: tournId,
    }));
    filterMatchdays();
  } catch(e) { showToast(e.message, 'error'); }
}

async function createTournamentMatchday(tournId) {
  const label = document.getElementById('md-label').value.trim();
  try {
    const res = await apiCall('/tournaments/' + tournId + '/rounds', 'POST', {
      round_type: 'group',
      label: label || undefined
    });
    showToast('Giornata ' + res.round_number + ' creata');
    loadTournamentMatchdays(tournId);
  } catch(e) { showToast(e.message, 'error'); }
}

function filterMatchdays() {
  const sf = document.getElementById('md-status-filter').value;
  let mds = window._allMatchdays || [];
  if (sf) mds = mds.filter(m => m.status === sf);

  // Sort
  mds = [...mds].sort((a, b) => {
    let va, vb;
    if (mdSortCol === 'number') { va = a.number||0; vb = b.number||0; }
    else if (mdSortCol === 'first_kickoff') { va = a.first_kickoff||''; vb = b.first_kickoff||''; }
    else if (mdSortCol === 'status') { va = a.status||''; vb = b.status||''; }
    if (va < vb) return mdSortDir === 'asc' ? -1 : 1;
    if (va > vb) return mdSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const league = allLeaguesCache.find(l => l.id === document.getElementById('md-league').value);
  const canManage = league && (league.league_type === 'national' || league.match_source_type !== 'national');

  function msh(col) {
    if (mdSortCol !== col) return '<span style="opacity:.3;margin-left:4px">&#8597;</span>';
    return mdSortDir === 'asc' ? '<span style="color:#F5A623;margin-left:4px">&#9650;</span>' : '<span style="color:#F5A623;margin-left:4px">&#9660;</span>';
  }

  let html = `<table><tr>
    <th style="cursor:pointer" onclick="mdSort('number')"># ${msh('number')}</th>
    <th>Etichetta</th>
    <th>Meta</th>
    <th style="cursor:pointer" onclick="mdSort('first_kickoff')">Kickoff ${msh('first_kickoff')}</th>
    <th style="cursor:pointer" onclick="mdSort('status')">Stato ${msh('status')}</th>
    <th>Azioni</th></tr>`;

  mds.forEach(m => {
    const kickoff = m.first_kickoff ? new Date(m.first_kickoff).toLocaleString('it') : '-';
    const isTournRound = m._is_tournament;
    const crAction = isTournRound
      ? `showMdControlRoom('${m.id}','${m._tournament_id}')`
      : `showMdControlRoom('${m.id}')`;
    html += `<tr data-testid="md-row-${m.id}">
      <td><strong>${isTournRound ? 'R' : 'G'}${m.number}</strong></td>
      <td>${m.label||''}</td>
      <td>${isTournRound ? (m.match_count||0)+' partite' : (m.half==1?'Andata':'Ritorno')}</td>
      <td style="font-size:12px">${kickoff}</td>
      <td><span class="status-badge status-${m.status}">${m.status}</span></td>
      <td><button class="btn btn-sm btn-outline" onclick="${crAction}" data-testid="control-md-${m.id}">Control Room</button></td></tr>`;
  });
  html += '</table>';
  document.getElementById('md-list').innerHTML = html;
}

function mdSort(col) {
  if (mdSortCol === col) mdSortDir = mdSortDir === 'asc' ? 'desc' : 'asc';
  else { mdSortCol = col; mdSortDir = 'asc'; }
  filterMatchdays();
}

async function updateAvailableNumbers() {
  const sel = document.getElementById('md-num');
  if (!sel) return;
  // Determine target league
  const mainLeague = document.getElementById('md-league').value;
  const createLeague = document.getElementById('md-create-league');
  const targetLeagueId = mainLeague === 'all' ? (createLeague ? createLeague.value : '') : mainLeague;
  if (!targetLeagueId) return;
  // Fetch matchdays for this league to know used numbers
  try {
    const mds = await apiCall('/admin/matchdays?league_id=' + targetLeagueId);
    const usedNumbers = new Set(mds.map(m => m.number));
    sel.innerHTML = '<option value="">Giornata...</option>';
    for (let i = 1; i <= 38; i++) {
      if (!usedNumbers.has(i)) {
        sel.innerHTML += `<option value="${i}">G${i}</option>`;
      }
    }
  } catch(e) {
    sel.innerHTML = '<option value="">Giornata...</option>';
    for (let i = 1; i <= 38; i++) sel.innerHTML += `<option value="${i}">G${i}</option>`;
  }
}

async function populateMdcrEditNumber() {
  const sel = document.getElementById('mdcr-edit-number');
  if (!sel) return;
  const lid = sel.dataset.league;
  const current = parseInt(sel.dataset.current) || 0;
  const mdId = sel.dataset.mdid;
  try {
    const mds = await apiCall('/admin/matchdays?league_id=' + lid);
    const used = new Set(mds.filter(m => m.id !== mdId).map(m => m.number));
    sel.innerHTML = '';
    for (let i = 1; i <= 38; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      if (i === current) { opt.selected = true; opt.text = 'G' + i + ' (attuale)'; }
      else if (used.has(i)) { opt.disabled = true; opt.text = 'G' + i + ' (usato)'; opt.style.color = '#64748B'; }
      else { opt.text = 'G' + i; }
      sel.appendChild(opt);
    }
  } catch(e) {
    sel.innerHTML = '';
    for (let i = 1; i <= 38; i++) {
      const o = document.createElement('option');
      o.value = i; o.text = 'G' + i;
      if (i === current) o.selected = true;
      sel.appendChild(o);
    }
  }
}

async function saveMdEdit(mdId) {
  try {
    const num = parseInt(document.getElementById('mdcr-edit-number').value);
    const label = document.getElementById('mdcr-edit-label').value;
    if (!num || num < 1) { showToast('Numero non valido', 'error'); return; }
    await apiCall('/admin/matchdays/' + mdId, 'PUT', { number: num, label });
    showToast('Giornata aggiornata');
    // Update local cache and refresh
    const md = (window._allMatchdays||[]).find(m => m.id === mdId);
    if (md) { md.number = num; md.label = label; }
    loadMatchdays();
    showMdControlRoom(mdId, 'info');
  } catch(e) { showToast(e.message, 'error'); }
}

async function createMatchday() {
  try {
    const mainLeagueId = document.getElementById('md-league').value;
    const leagueId = mainLeagueId === 'all'
      ? document.getElementById('md-create-league').value
      : mainLeagueId;
    if (!leagueId || leagueId === 'all') { showToast('Seleziona una lega', 'error'); return; }
    const kickoff = document.getElementById('md-kickoff').value;
    await apiCall('/admin/matchdays', 'POST', {
      season_id: document.getElementById('md-season').value,
      number: parseInt(document.getElementById('md-num').value),
      label: document.getElementById('md-label').value,
      half: parseInt(document.getElementById('md-half').value),
      first_kickoff: new Date(kickoff).toISOString(),
      status: 'DRAFT',
      league_id: leagueId
    });
    showToast('Giornata creata'); loadMatchdays();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// MATCHDAY CONTROL ROOM
// ========================================
let mdcrTab = 'info';
let mdcrId = null;
let mdcrTournId = null;
let mdcrMatches = null;

async function showMdControlRoom(mdId, tabOrTournId, maybeTab) {
  // Support: showMdControlRoom(mdId) or showMdControlRoom(mdId, tab) or showMdControlRoom(mdId, tournId, tab) 
  let tournamentOverrideId = null;
  let tab = 'info';
  if (maybeTab) {
    // 3 args: mdId, tournId, tab
    tournamentOverrideId = tabOrTournId;
    tab = maybeTab;
  } else if (tabOrTournId && ['info','matches','import'].includes(tabOrTournId)) {
    tab = tabOrTournId;
  } else if (tabOrTournId) {
    tournamentOverrideId = tabOrTournId;
  }

  mdcrId = mdId;
  mdcrTab = tab;
  mdcrTournId = tournamentOverrideId || (md && md._tournament_id) || null;
  const md = (window._allMatchdays||[]).find(m => m.id === mdId);
  if (!md) return;

  const isTournament = md._is_tournament || !!tournamentOverrideId;
  const tournId = tournamentOverrideId || md._tournament_id;

  // Use matchday's own league when viewing all leagues
  const selectedLeagueId = document.getElementById('md-league').value;
  const league = isTournament ? null : (selectedLeagueId === 'all'
    ? allLeaguesCache.find(l => l.id === md.league_id)
    : allLeaguesCache.find(l => l.id === selectedLeagueId));
  const canManage = isTournament || (league && (league.league_type === 'national' || league.match_source_type !== 'national'));

  const tabs = [
    {id:'info', label:'Info & Stato'},
    {id:'matches', label:'Partite'},
  ];
  if (canManage) tabs.push({id:'import', label:'Importa da API'});

  const crCallBase = isTournament ? `showMdControlRoom('${mdId}','${tournId}'` : `showMdControlRoom('${mdId}'`;
  const tabsHtml = tabs.map(t => `<button class="btn btn-sm ${mdcrTab===t.id?'':'btn-outline'}" onclick="${crCallBase},'${t.id}')" data-testid="mdcr-tab-${t.id}" style="${mdcrTab===t.id?'':'opacity:.6'}">${t.label}</button>`).join(' ');

  const prefix = isTournament ? 'R' : 'G';
  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:12px">
      <h3 style="margin:0">${prefix}${md.number} ${md.label ? '- '+md.label : ''}</h3>
      <span class="status-badge status-${md.status}">${md.status}</span>
    </div>
    <button class="btn btn-outline btn-sm" onclick="closeModal()">X</button>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid #334155;padding-bottom:12px">${tabsHtml}</div>
  <div id="mdcr-body"></div>`;
  showModal(html);

  const body = document.getElementById('mdcr-body');
  if (mdcrTab === 'info') { body.innerHTML = await renderMdcrInfo(md, canManage); await populateMdcrEditNumber(); }
  else if (mdcrTab === 'matches') { body.innerHTML = '<p style="color:#94A3B8">Caricamento...</p>'; await loadMdcrMatches(md, canManage); }
  else if (mdcrTab === 'import') body.innerHTML = renderMdcrImport(md);
}

async function renderMdcrInfo(md, canManage) {
  // Count matches, predictions, results
  let matchCount = 0, resultCount = 0, predCount = 0;
  try {
    const matches = await apiCall('/admin/matches?matchday_id=' + md.id);
    mdcrMatches = matches;
    matchCount = matches.length;
    resultCount = matches.filter(m => m.home_score !== null && m.home_score !== undefined).length;
  } catch(e) {}
  // Predictions count (approximate from score_summaries)
  try {
    const scores = await apiCall('/admin/score-summaries/' + md.id);
    predCount = scores.length || 0;
  } catch(e) {}

  const kickoff = md.first_kickoff ? new Date(md.first_kickoff).toLocaleString('it') : '-';
  const hasPredictions = predCount > 0;
  const hasResults = resultCount > 0;
  const isDraft = md.status === 'DRAFT';

  // State transitions - ALL states available (Super Admin can go backward)
  const allStates = ['DRAFT','OPEN','LOCKED','LIVE','COMPLETED'];
  const colors = {'DRAFT':'#64748B','OPEN':'#3B82F6','LOCKED':'#F59E0B','LIVE':'#10B981','COMPLETED':'#6B7280'};

  let stateButtons = '';
  if (canManage) {
    allStates.filter(s => s !== md.status).forEach(s => {
      stateButtons += `<button class="btn btn-sm" style="background:${colors[s]};color:#fff" onclick="doMdTransition('${md.id}','${s}')" data-testid="md-to-${s}">${s}</button> `;
    });
    if (md.status === 'LIVE' || md.status === 'COMPLETED') {
      stateButtons += `<button class="btn btn-sm" style="background:#F5A623;color:#0F172A" onclick="doMdConfirm('${md.id}')" data-testid="md-confirm-btn">CONFERMA PUNTEGGI</button> `;
    }
  }

  let dangerZone = '';
  if (canManage && isSuperAdmin) {
    if (isDraft && !hasPredictions && !hasResults) {
      dangerZone = `<div style="margin-top:20px;padding:12px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px">
        <h4 style="color:#EF4444;margin-bottom:8px;font-size:14px">Zona Pericolo</h4>
        <button class="btn btn-sm btn-danger" onclick="doMdDelete('${md.id}',false)" data-testid="md-delete-btn">Elimina Giornata</button>
        <p style="color:#64748B;font-size:11px;margin-top:6px">Possibile solo se DRAFT e senza pronostici/risultati.</p>
      </div>`;
    } else if (hasPredictions || hasResults || !isDraft) {
      dangerZone = `<div style="margin-top:20px;padding:12px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px">
        <h4 style="color:#EF4444;margin-bottom:8px;font-size:14px">Zona Pericolo</h4>
        <p style="color:#F87171;font-size:12px;margin-bottom:8px">Questa giornata ha ${predCount} pronostici e ${resultCount} risultati. La cancellazione distrugge TUTTI i dati associati.</p>
        <div id="md-override-zone">
          <p style="font-size:12px;margin-bottom:8px">Digita <strong style="color:#EF4444">DELETE</strong> per procedere con l\\'override:</p>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="md-delete-confirm" placeholder="Digita DELETE" style="padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="md-delete-confirm">
            <button class="btn btn-sm btn-danger" onclick="doMdDelete('${md.id}',true)" data-testid="md-override-delete-btn">Override Eliminazione</button>
          </div>
        </div>
      </div>`;
    }
  }

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="counter-box" style="text-align:center"><div class="num" style="font-size:20px;color:#3B82F6">${matchCount}</div><div class="label">Partite</div></div>
      <div class="counter-box" style="text-align:center"><div class="num" style="font-size:20px;color:#10B981">${resultCount}</div><div class="label">Risultati</div></div>
      <div class="counter-box" style="text-align:center"><div class="num" style="font-size:20px;color:#F5A623">${predCount}</div><div class="label">Pronostici</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px">
      <div><span style="color:#94A3B8">ID:</span> <code style="color:#F5A623;font-size:11px">${md.id.substring(0,16)}...</code></div>
      <div><span style="color:#94A3B8">Stagione:</span> ${md.season_id||'-'}</div>
      <div><span style="color:#94A3B8">Kickoff:</span> <strong>${kickoff}</strong></div>
      <div><span style="color:#94A3B8">Meta:</span> ${md.half==1?'Andata':'Ritorno'}</div>
    </div>
    ${canManage ? `
    <h4 style="color:#F5A623;margin:16px 0 8px;font-size:14px">Modifica</h4>
    <div class="form-row" style="margin:0;align-items:center">
      <label style="color:#94A3B8;font-size:12px;min-width:60px">Numero</label>
      <select id="mdcr-edit-number" style="width:100px" data-testid="mdcr-edit-number" data-league="${md.league_id||''}" data-current="${md.number||0}" data-mdid="${md.id}"></select>
      <label style="color:#94A3B8;font-size:12px;min-width:60px;margin-left:12px">Etichetta</label>
      <input id="mdcr-edit-label" value="${md.label||''}" style="flex:1" data-testid="mdcr-edit-label">
      <button class="btn btn-sm" onclick="saveMdEdit('${md.id}')" data-testid="mdcr-save-btn">Salva</button>
    </div>
    ` : ''}
    ${canManage ? `
    <h4 style="color:#F5A623;margin:16px 0 8px;font-size:14px">Gestione Stato</h4>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${stateButtons}</div>
    ` : ''}
    ${dangerZone}`;
}

async function loadMdcrMatches(md, canManage) {
  try {
    const matches = await apiCall('/admin/matches?matchday_id=' + md.id);
    mdcrMatches = matches;
    document.getElementById('mdcr-body').innerHTML = renderMdcrMatches(md, matches, canManage);
  } catch(e) { showToast(e.message, 'error'); }
}

function renderMdcrMatches(md, matches, canManage) {
  let addForm = '';
  if (canManage) {
    const markets = ['1X2','GOAL_NOGOL','OVER_UNDER_25','EXACT_SCORE'];
    addForm = `<div style="margin-bottom:16px;padding:12px;background:#0F172A;border-radius:8px">
      <h4 style="color:#94A3B8;margin-bottom:8px;font-size:13px">Aggiungi Partita</h4>
      <div class="form-row" style="margin:0">
        <input id="nm-home" placeholder="Squadra casa" style="flex:1">
        <input id="nm-away" placeholder="Squadra ospite" style="flex:1">
        <input id="nm-comp" placeholder="Competizione" style="flex:1">
        <select id="nm-market">${markets.map(m=>`<option value="${m}">${m}</option>`).join('')}</select>
        <input id="nm-time" type="datetime-local" style="flex:1">
        <button class="btn btn-sm" onclick="doAddMatch('${md.id}')" data-testid="add-match-btn">Aggiungi</button>
      </div>
    </div>`;
  }

  let html = '<table style="font-size:13px"><tr><th>Casa</th><th>Ospite</th><th>Comp</th><th>Mercato</th><th>X3</th><th>Orario</th><th>Score</th><th>Stato</th>';
  if (canManage) html += '<th>Azioni</th>';
  html += '</tr>';
  matches.forEach(m => {
    const score = m.home_score !== null && m.home_score !== undefined ? `<strong>${m.home_score}-${m.away_score}</strong>` : '-';
    const time = m.start_time ? new Date(m.start_time).toLocaleString('it') : '-';
    const isSpecial = m.is_special || false;
    const rowStyle = isSpecial ? 'background:rgba(245,166,35,0.08);border-left:3px solid #F5A623' : '';
    html += `<tr style="${rowStyle}">
      <td>${m.home_team}</td><td>${m.away_team}</td><td style="color:#94A3B8">${m.competition||'-'}</td>
      <td><span class="tag tag-role">${m.market_type||'-'}</span></td>
      <td>${isSpecial ? '<span style="color:#F5A623;font-weight:800;font-size:14px">X3</span>' : '<span style="color:#475569">-</span>'}</td>
      <td style="font-size:12px">${time}</td>
      <td>${score}</td>`;
    if (canManage) {
      const matchStatuses = ['scheduled','live','finished','suspended','postponed','cancelled','void'];
      html += `<td><select onchange="doQuickMatchStatus('${md.id}','${m.id}',this.value)" style="padding:3px;background:#0F172A;border:1px solid #334155;border-radius:4px;color:#F1F5F9;font-size:11px" data-testid="match-status-${m.id}">
        ${matchStatuses.map(s => `<option value="${s}" ${(m.status||'scheduled')===s?'selected':''}>${s}</option>`).join('')}
      </select></td>`;
      html += `<td style="white-space:nowrap">
        <button class="btn btn-sm ${isSpecial ? '' : 'btn-outline'}" style="${isSpecial ? 'background:#F5A623;color:#0F172A' : ''}" onclick="doToggleSpecial('${md.id}','${m.id}')" data-testid="toggle-x3-${m.id}" title="${isSpecial ? 'Rimuovi X3' : 'Imposta X3'}">X3</button>
        <button class="btn btn-sm btn-outline" onclick="showMatchUpdate('${m.id}','${(m.home_team||'').replace(/'/g,"\\'")}','${(m.away_team||'').replace(/'/g,"\\'")}',${m.home_score||0},${m.away_score||0})">Score</button>
        <button class="btn btn-sm btn-danger" onclick="doDeleteMatch('${md.id}','${m.id}')">X</button>
      </td>`;
    } else {
      html += `<td><span class="status-badge status-${(m.status||'scheduled').toUpperCase()}">${m.status||'scheduled'}</span></td>`;
    }
    html += '</tr>';
  });
  html += '</table>';
  html += '<div id="match-update-panel"></div>';

  return addForm + html;
}

function showMatchUpdate(matchId, home, away, hs, as) {
  document.getElementById('match-update-panel').innerHTML = `
  <div class="card" style="border-color:#F5A623;margin-top:12px"><h4 style="color:#F5A623;margin-bottom:8px">${home} vs ${away}</h4>
    <div class="form-row" style="margin:0">
      <input id="lu-hs" type="number" value="${hs}" min="0" placeholder="Gol casa" style="width:80px">
      <input id="lu-as" type="number" value="${as}" min="0" placeholder="Gol ospite" style="width:80px">
      <select id="lu-status"><option value="live">Live</option><option value="finished">Finished</option>
        <option value="postponed">Postponed</option><option value="void">Void</option></select>
      <button class="btn btn-sm" onclick="doMatchUpdate('${matchId}')" data-testid="save-match-update">Salva</button>
    </div>
  </div>`;
}

async function doMatchUpdate(matchId) {
  try {
    await apiCall('/admin/matches/'+matchId+'/live-update', 'POST', {
      match_id: matchId,
      home_score: parseInt(document.getElementById('lu-hs').value),
      away_score: parseInt(document.getElementById('lu-as').value),
      status: document.getElementById('lu-status').value
    });
    showToast('Match aggiornato');
    if (mdcrTournId) showMdControlRoom(mdcrId, mdcrTournId, 'matches');
    else showMdControlRoom(mdcrId, 'matches');
  } catch(e) { showToast(e.message, 'error'); }
}

async function doAddMatch(mdId) {
  try {
    // Determine correct league_id: check if this is a tournament round
    const md = (window._allMatchdays||[]).find(m => m.id === mdId);
    let leagueId;
    if (md && md._is_tournament && md._tournament_id) {
      leagueId = md._tournament_id;
    } else if (mdcrTournId) {
      leagueId = mdcrTournId;
    } else {
      leagueId = document.getElementById('md-league').value;
      if (leagueId.startsWith('tourn_')) leagueId = leagueId.replace('tourn_', '');
    }
    await apiCall('/admin/matches', 'POST', {
      matchday_id: mdId,
      league_id: leagueId,
      home_team: document.getElementById('nm-home').value,
      away_team: document.getElementById('nm-away').value,
      competition: document.getElementById('nm-comp').value,
      market_type: document.getElementById('nm-market').value,
      start_time: new Date(document.getElementById('nm-time').value).toISOString(),
      status: 'scheduled'
    });
    showToast('Partita aggiunta');
    showMdControlRoom(mdId, mdcrTournId || mdcrTab, mdcrTournId ? 'matches' : undefined);
  } catch(e) { showToast(e.message, 'error'); }
}

async function doDeleteMatch(mdId, matchId) {
  if (!confirm('Rimuovere questa partita?')) return;
  try {
    await apiCall('/admin/matches/' + matchId, 'DELETE');
    showToast('Partita rimossa');
    if (mdcrTournId) showMdControlRoom(mdcrId, mdcrTournId, 'matches');
    else showMdControlRoom(mdId, 'matches');
  } catch(e) { showToast(e.message, 'error'); }
}

async function doToggleSpecial(mdId, matchId) {
  try {
    const res = await apiCall('/admin/matches/' + matchId + '/special', 'POST', {});
    showToast(res.is_special ? 'Partita impostata come X3!' : 'X3 rimosso');
    if (mdcrTournId) showMdControlRoom(mdcrId, mdcrTournId, 'matches');
    else showMdControlRoom(mdId, 'matches');
  } catch(e) { showToast(e.message, 'error'); }
}

async function doQuickMatchStatus(mdId, matchId, newStatus) {
  try {
    await apiCall('/admin/matches/' + matchId + '/live-update', 'POST', {
      match_id: matchId,
      status: newStatus
    });
    showToast('Stato partita: ' + newStatus);
    if (mdcrTournId) showMdControlRoom(mdcrId, mdcrTournId, 'matches');
    else showMdControlRoom(mdId, 'matches');
  } catch(e) { showToast(e.message, 'error'); }
}

async function doMdTransition(mdId, newStatus) {
  const order = ['DRAFT','OPEN','LOCKED','LIVE','COMPLETED'];
  const md = (window._allMatchdays||[]).find(m => m.id === mdId);
  const currentIdx = order.indexOf(md ? md.status : '');
  const targetIdx = order.indexOf(newStatus);
  const isBackward = targetIdx < currentIdx;
  const isTournament = md && md._is_tournament;
  const msg = isBackward
    ? 'ATTENZIONE: stai tornando indietro a ' + newStatus + '. Confermare?'
    : 'Cambiare stato a ' + newStatus + '?';
  if (!confirm(msg)) return;
  try {
    if (isTournament) {
      // Tournament round: use dedicated endpoint
      await apiCall('/admin/tournament-rounds/' + mdId + '/status', 'PUT', {status: newStatus});
    } else if (isBackward) {
      const leagueId = md ? md.league_id : document.getElementById('md-league').value;
      await apiCall('/admin/matchday/' + mdId + '/override', 'POST', {league_id: leagueId, target_status: newStatus});
    } else {
      await apiCall('/admin/matchdays/' + mdId, 'PUT', {status: newStatus});
    }
    showToast('Stato aggiornato: ' + newStatus);
    if (isTournament) {
      await loadTournamentMatchdays(md._tournament_id);
      showMdControlRoom(mdId, md._tournament_id, 'info');
    } else {
      await loadMatchdays();
      showMdControlRoom(mdId, 'info');
    }
  } catch(e) { showToast(e.message, 'error'); }
}

async function doMdConfirm(mdId) {
  if (!confirm('Confermare giornata? Verranno calcolati i punteggi per tutti gli utenti.')) return;
  try {
    const r = await apiCall('/admin/matchdays/' + mdId + '/confirm', 'POST');
    showToast('Giornata confermata: ' + (r.users_scored||0) + ' utenti calcolati');
    await loadMatchdays();
    showMdControlRoom(mdId, 'info');
  } catch(e) { showToast(e.message, 'error'); }
}

async function doMdDelete(mdId, isOverride) {
  if (isOverride) {
    const confirmInput = document.getElementById('md-delete-confirm');
    if (!confirmInput || confirmInput.value !== 'DELETE') {
      showToast('Devi digitare DELETE per confermare', 'error'); return;
    }
  }
  if (!confirm('ATTENZIONE: Eliminare questa giornata e TUTTI i dati associati (partite, pronostici, punteggi)? Questa azione e IRREVERSIBILE.')) return;
  try {
    const r = await apiCall('/admin/matchdays/' + mdId, 'DELETE');
    closeModal();
    showToast('Giornata eliminata (' + (r.deleted_matches||0) + ' partite, ' + (r.deleted_predictions||0) + ' pronostici)');
    loadMatchdays();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// IMPORT FIXTURES FROM API
// ========================================
function renderMdcrImport(md) {
  // Pre-populate dates: today → +7 days
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const fmtDate = d => d.toISOString().split('T')[0];
  const fromDate = fmtDate(today);
  const toDate = fmtDate(nextWeek);
  return `
    <h4 style="color:#F5A623;margin-bottom:12px;font-size:14px">Importa Partite Reali</h4>
    <p style="color:#94A3B8;font-size:12px;margin-bottom:12px">Cerca partite reali da API-Football e importale nella giornata.</p>
    <div class="form-row" style="margin-bottom:12px">
      <div style="flex:1">
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Competizione (API ID)</label>
        <select id="imp-league" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="import-league-select">
          <option value="135">Serie A (135)</option>
          <option value="2">Champions League (2)</option>
          <option value="3">Europa League (3)</option>
          <option value="848">Conference League (848)</option>
          <option value="39">Premier League (39)</option>
          <option value="140">La Liga (140)</option>
          <option value="78">Bundesliga (78)</option>
          <option value="61">Ligue 1 (61)</option>
        </select>
      </div>
      <div style="flex:1">
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Da</label>
        <input id="imp-from" type="date" value="${fromDate}" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="import-from">
      </div>
      <div style="flex:1">
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">A</label>
        <input id="imp-to" type="date" value="${toDate}" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="import-to">
      </div>
      <div style="flex:0">
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">&nbsp;</label>
        <button class="btn" onclick="doSearchFixtures('${md.id}')" data-testid="search-fixtures-btn">Cerca</button>
      </div>
    </div>
    <div id="fixtures-results"></div>`;
}

async function doSearchFixtures(mdId) {
  const league = document.getElementById('imp-league').value;
  const from = document.getElementById('imp-from').value;
  const to = document.getElementById('imp-to').value;
  const resultsDiv = document.getElementById('fixtures-results');
  resultsDiv.innerHTML = '<p style="color:#94A3B8">Ricerca in corso...</p>';

  try {
    // Auto-detect season: if month >= 7, season = current year; else season = year - 1
    const now = new Date();
    const autoSeason = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    let url = '/admin/real-fixtures/search?league=' + league + '&season=' + autoSeason;
    if (from) url += '&from=' + from;
    if (to) url += '&to=' + to;
    const fixtures = await apiCall(url);

    if (!fixtures || fixtures.length === 0) {
      resultsDiv.innerHTML = '<p style="color:#F59E0B">Nessuna partita trovata per i filtri selezionati.</p>';
      return;
    }

    let html = '<table style="font-size:12px"><tr><th><input type="checkbox" id="fix-all" onchange="toggleAllFixtures()"></th><th>Casa</th><th>Ospite</th><th>Data</th><th>Stato</th></tr>';
    fixtures.forEach(f => {
      const date = f.date ? new Date(f.date).toLocaleString('it') : '-';
      html += `<tr>
        <td><input type="checkbox" name="fix-sel" value="${f.fixture_id}" class="fix-check"></td>
        <td>${f.home_team}</td><td>${f.away_team}</td>
        <td>${date}</td>
        <td>${f.status||'NS'}</td></tr>`;
    });
    html += '</table>';
    html += `<div style="margin-top:12px;text-align:right">
      <button class="btn" onclick="doImportFixtures('${mdId}')" data-testid="import-fixtures-btn">Importa Selezionate</button>
    </div>`;
    resultsDiv.innerHTML = html;
  } catch(e) {
    resultsDiv.innerHTML = '<p style="color:#EF4444">Errore: ' + e.message + '</p>';
  }
}

function toggleAllFixtures() {
  const all = document.getElementById('fix-all').checked;
  document.querySelectorAll('.fix-check').forEach(c => c.checked = all);
}

async function doImportFixtures(mdId) {
  const selected = Array.from(document.querySelectorAll('.fix-check:checked')).map(c => parseInt(c.value));
  if (selected.length === 0) { showToast('Seleziona almeno una partita', 'error'); return; }

  const leagueId = document.getElementById('md-league').value;
  try {
    const r = await apiCall('/admin/real-fixtures/import', 'POST', {
      league_id: leagueId,
      matchday_id: mdId,
      fixture_ids: selected
    });
    showToast('Importate ' + (r.imported||selected.length) + ' partite');
    showMdControlRoom(mdId, 'matches');
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// LEAGUES (enhanced with admin management)
// ========================================
let allLeaguesCache = [];

async function render_leagues() {
  if (!hasPerm('admin.leagues.manage')) { render_forbidden(); return; }
  const riskFilter = navFilter.risk || '';
  const typeFilter = navFilter.type || '';
  navFilter = {};
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Gestione Leghe</h2><div id="leagues-filter" class="card"></div><div id="leagues-list"></div>';

  try {
    const leagues = await apiCall('/rbac/leagues');
    allLeaguesCache = leagues;

    // Filter bar
    document.getElementById('leagues-filter').innerHTML = `
      <div class="form-row">
        <input class="search-bar" style="margin:0;flex:2" id="league-search" placeholder="Cerca lega..." oninput="filterLeagues()" data-testid="league-search-input">
        <select id="league-type-filter" onchange="filterLeagues()" style="flex:1" data-testid="league-type-filter">
          <option value="">Tutti i tipi</option>
          <option value="national" ${typeFilter==='national'?'selected':''}>Nazionale</option>
          <option value="private_custom" ${typeFilter==='private_custom'?'selected':''}>Privata - Personalizzata</option>
          <option value="private_national" ${typeFilter==='private_national'?'selected':''}>Privata - Lega Nazionale</option>
        </select>
        <select id="league-risk-filter" onchange="filterLeagues()" style="flex:1" data-testid="league-risk-filter">
          <option value="">Tutte le leghe</option>
          <option value="all" ${riskFilter?'selected':''}>A Rischio (tutte)</option>
          <option value="no_owner" ${riskFilter==='no_owner'?'selected':''}>Senza Owner</option>
          <option value="no_admin" ${riskFilter==='no_admin'?'selected':''}>Senza Admin Lega</option>
        </select>
        <button class="btn" onclick="showCreateLeagueModal()" data-testid="create-league-btn" style="white-space:nowrap">+ Nuova Lega</button>
      </div>`;

    filterLeagues();
  } catch(e) { showToast(e.message, 'error'); }
}

function getLeagueTypeKey(l) {
  if (l.league_type === 'national') return 'national';
  if (l.match_source_type === 'national') return 'private_national';
  return 'private_custom';
}

function getLeagueTypeBadge(l) {
  const t = getLeagueTypeKey(l);
  if (t === 'national') return '<span class="status-badge status-LIVE">NAZIONALE</span>';
  if (t === 'private_national') return '<span class="status-badge" style="background:rgba(20,184,166,.15);color:#14B8A6;border:1px solid rgba(20,184,166,.3)">PRIVATA NAZ.</span>';
  return '<span class="status-badge status-OPEN">PRIVATA CUSTOM</span>';
}

function getRulesSummary(l) {
  const sc = l.scoring_config || {};
  const markets = Object.entries(sc).filter(([k,v]) => v && v.enabled).map(([k,v]) => {
    const names = {'1x2':'1X2','over_under':'O/U','goal_no_goal':'GG/NG','exact_score':'Esatto'};
    return (names[k]||k) + ':' + v.points;
  });
  const parts = [];
  if (markets.length > 0) parts.push(markets.join(' '));
  if (l.start_matchday && l.end_matchday) parts.push('G' + l.start_matchday + '-' + l.end_matchday);
  if (l.bet_deadline_minutes) parts.push(l.bet_deadline_minutes + 'min');
  return parts.join(' | ') || '-';
}

function filterLeagues() {
  const q = (document.getElementById('league-search').value || '').toLowerCase();
  const tf = document.getElementById('league-type-filter').value;
  const rf = document.getElementById('league-risk-filter').value;
  let filtered = allLeaguesCache;
  if (q) filtered = filtered.filter(l => l.name.toLowerCase().includes(q));
  if (tf) filtered = filtered.filter(l => getLeagueTypeKey(l) === tf);
  if (rf === 'all') filtered = filtered.filter(l => !l.owner || (l.admins && l.admins.length === 0));
  else if (rf === 'no_owner') filtered = filtered.filter(l => !l.owner);
  else if (rf === 'no_admin') filtered = filtered.filter(l => !l.admins || l.admins.length === 0);
  applySortAndRender(filtered, 'leagues');
}

function renderLeaguesTable(leagues) {
  const sh = (col) => sortArrow('leagues', col);
  let html = `<table><tr>
    <th style="cursor:pointer" onclick="sortBy('leagues','name')">Nome ${sh('name')}</th>
    <th>Tipo</th>
    <th>Codice</th>
    <th>Owner</th>
    <th>Admin Lega</th>
    <th style="cursor:pointer" onclick="sortBy('leagues','member_count')">Membri ${sh('member_count')}</th>
    <th style="cursor:pointer" onclick="sortBy('leagues','created_at')">Creata ${sh('created_at')}</th>
    <th>Regole</th>
    <th>Azioni</th></tr>`;
  leagues.forEach(l => {
    const ownerName = l.owner ? `<strong>${l.owner.username}</strong>` : (l.league_type === 'national' ? '<span style="color:#94A3B8">Sistema</span>' : '<span style="color:#EF4444">Nessuno</span>');
    const adminCount = l.admins ? l.admins.length : 0;
    const typeBadge = getLeagueTypeBadge(l);
    const rulesSummary = getRulesSummary(l);
    const lockedIcon = l.rules_locked ? '<span title="Regole bloccate" style="color:#F59E0B;cursor:help">&#128274;</span>' : '';
    const createdAt = l.created_at ? new Date(l.created_at).toLocaleDateString('it') : '-';

    html += `<tr data-testid="league-row-${l.id}">
      <td><strong>${l.name}</strong></td>
      <td>${typeBadge}</td>
      <td style="font-size:12px;color:#94A3B8">${l.invite_code||'-'}</td>
      <td>${ownerName}</td>
      <td><span style="cursor:pointer;color:#F5A623" onclick="showLeagueAdmins('${l.id}')">${adminCount} admin</span></td>
      <td>${l.member_count}</td>
      <td style="font-size:12px;color:#94A3B8">${createdAt}</td>
      <td style="font-size:11px;color:#94A3B8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${rulesSummary}">${lockedIcon} ${rulesSummary}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="showLeagueControlRoom('${l.id}')" data-testid="control-league-${l.id}">Control Room</button>
      </td></tr>`;
  });
  html += '</table>';
  document.getElementById('leagues-list').innerHTML = html;
}

// ========================================
// L2: LEAGUE CONTROL ROOM (unified)
// ========================================
let crTab = 'info';
let crLeagueId = null;
let crMembers = null;

async function showLeagueControlRoom(leagueId, tab) {
  crLeagueId = leagueId;
  crTab = tab || 'info';
  const l = allLeaguesCache.find(x => x.id === leagueId);
  if (!l) return;

  // Fetch members for team tab
  if (!crMembers || crTab === 'team') {
    try { crMembers = await apiCall('/rbac/leagues/' + leagueId + '/members'); } catch(e) { crMembers = []; }
  }

  const typeBadge = getLeagueTypeBadge(l);
  const tabs = [
    {id:'info', label:'Info & Regole'},
    {id:'edit', label:'Modifica'},
    {id:'team', label:'Team & Admin'},
    {id:'danger', label:'Zona Pericolo'},
  ];
  const tabsHtml = tabs.map(t => `<button class="btn btn-sm ${crTab===t.id?'':'btn-outline'}" onclick="showLeagueControlRoom('${leagueId}','${t.id}')" data-testid="cr-tab-${t.id}" style="${crTab===t.id?'':'opacity:.6'}">${t.label}</button>`).join(' ');

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:12px">
      <h3 style="margin:0">${l.name}</h3> ${typeBadge}
      ${l.rules_locked ? '<span class="tag tag-disabled">BLOCCATA</span>' : '<span class="tag" style="background:rgba(16,185,129,.15);color:#10B981;border:1px solid rgba(16,185,129,.3)">APERTA</span>'}
    </div>
    <button class="btn btn-outline btn-sm" onclick="closeModal()">X</button>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid #334155;padding-bottom:12px">${tabsHtml}</div>
  <div id="cr-body"></div>`;
  showModal(html);

  // Render tab content
  const body = document.getElementById('cr-body');
  if (crTab === 'info') body.innerHTML = renderCrInfo(l);
  else if (crTab === 'edit') body.innerHTML = renderCrEdit(l);
  else if (crTab === 'team') body.innerHTML = renderCrTeam(l);
  else if (crTab === 'danger') body.innerHTML = renderCrDanger(l);
}

function renderCrInfo(l) {
  const sc = l.scoring_config || {};
  const marketNames = {'1x2':'1X2 (Esito finale)','over_under':'Over/Under 2.5','goal_no_goal':'Goal/No Goal','exact_score':'Risultato Esatto'};
  let marketsHtml = '';
  Object.entries(marketNames).forEach(([key, label]) => {
    const cfg = sc[key] || {};
    const enabled = cfg.enabled ? '<span style="color:#10B981">Attivo</span>' : '<span style="color:#6B7280">Disattivo</span>';
    marketsHtml += `<tr><td>${label}</td><td>${enabled}</td><td style="color:#F5A623;font-weight:bold">${cfg.points||0} pt</td></tr>`;
  });

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px">
      <div><span style="color:#94A3B8">ID:</span> <code style="color:#F5A623;font-size:11px">${l.id.substring(0,16)}...</code></div>
      <div><span style="color:#94A3B8">Stagione:</span> ${l.season_id || '-'}</div>
      <div><span style="color:#94A3B8">Giornate:</span> <strong>${l.start_matchday || '?'} - ${l.end_matchday || '?'}</strong></div>
      <div><span style="color:#94A3B8">Scadenza pronostici:</span> <strong>${l.bet_deadline_minutes || '?'} min</strong> prima del calcio d'inizio</div>
      <div><span style="color:#94A3B8">Sorgente match:</span> <strong>${l.match_source_type || '-'}</strong></div>
      <div><span style="color:#94A3B8">Pronostici campionato:</span> ${l.include_championship_predictions ? '<strong style="color:#10B981">Si</strong>' : 'No'}</div>
      <div><span style="color:#94A3B8">Membri:</span> <strong>${l.member_count}</strong></div>
      <div><span style="color:#94A3B8">Owner:</span> <strong>${l.owner ? l.owner.username : (l.league_type === 'national' ? 'Sistema' : 'Nessuno')}</strong></div>
      <div><span style="color:#94A3B8">Codice invito:</span> <code style="color:#14B8A6">${l.invite_code || '-'}</code></div>
      <div><span style="color:#94A3B8">Creata:</span> ${l.created_at ? new Date(l.created_at).toLocaleString('it') : '-'}</div>
    </div>
    <h4 style="color:#F5A623;margin:16px 0 8px">Mercati e Punteggi</h4>
    <table style="font-size:13px"><tr><th>Mercato</th><th>Stato</th><th>Punti</th></tr>${marketsHtml}</table>`;
}

function renderCrEdit(l) {
  const sc = l.scoring_config || {};
  const marketFields = [
    {key:'1x2', label:'1X2'},
    {key:'over_under', label:'Over/Under'},
    {key:'goal_no_goal', label:'Goal/No Goal'},
    {key:'exact_score', label:'Risultato Esatto'}
  ];
  let marketsInputs = '';
  marketFields.forEach(m => {
    const cfg = sc[m.key] || {};
    marketsInputs += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <label style="flex:1;color:#94A3B8;font-size:13px">${m.label}</label>
      <label style="font-size:12px;color:#94A3B8"><input type="checkbox" id="rule-${m.key}-on" ${cfg.enabled?'checked':''} style="margin-right:4px">Attivo</label>
      <input id="rule-${m.key}-pts" type="number" step="0.5" min="0" value="${cfg.points||0}" style="width:70px;padding:6px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px">
      <span style="color:#64748B;font-size:11px">pt</span>
    </div>`;
  });

  return `
    ${!isSuperAdmin ? '<p style="color:#F59E0B;font-size:13px;margin-bottom:12px">Solo i Super Admin possono modificare le impostazioni della lega.</p>' : `
    <div style="padding:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;margin-bottom:16px">
      <p style="color:#EF4444;font-size:13px;font-weight:bold">ATTENZIONE</p>
      <p style="color:#F87171;font-size:12px">Le modifiche impattano il calcolo punteggi e la configurazione. Se una giornata e gia in corso, le modifiche si applicheranno dalla prossima giornata.</p>
    </div>

    <div style="margin-bottom:12px">
      <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Nome Lega</label>
      <input id="rule-name" value="${l.name}" style="width:100%;padding:10px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:14px" data-testid="edit-league-name">
    </div>

    <h4 style="color:#F5A623;margin:16px 0 8px;font-size:14px">Mercati e Punteggi</h4>
    ${marketsInputs}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Giornata Inizio</label>
        <input id="rule-start-md" type="number" min="1" value="${l.start_matchday||1}" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="edit-start-matchday">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Giornata Fine</label>
        <input id="rule-end-md" type="number" min="1" value="${l.end_matchday||38}" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="edit-end-matchday">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Minuti prima del fischio d\\'inizio</label>
        <input id="rule-deadline" type="number" min="0" value="${l.bet_deadline_minutes||5}" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="edit-deadline">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Pronostici Campionato</label>
        <select id="rule-champ" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="edit-championship">
          <option value="false" ${!l.include_championship_predictions?'selected':''}>No</option>
          <option value="true" ${l.include_championship_predictions?'selected':''}>Si</option>
        </select>
      </div>
    </div>

    <div style="text-align:right;margin-top:16px">
      <button class="btn btn-danger" onclick="doEditRules('${l.id}')" data-testid="confirm-edit-rules-btn">Salva Tutte le Modifiche</button>
    </div>
    `}`;
}

function renderCrTeam(l) {
  const members = crMembers || [];
  let ownerHtml = '';
  if (l.owner) {
    ownerHtml = `<div style="margin:12px 0"><span class="tag tag-super">OWNER</span> <strong>${l.owner.username}</strong> <span style="color:#64748B">(${l.owner.email})</span></div>`;
  } else if (l.league_type === 'national') {
    ownerHtml = '<div style="margin:12px 0"><span class="tag tag-super">OWNER</span> <span style="color:#94A3B8">Sistema</span></div>';
  } else {
    ownerHtml = '<div style="margin:12px 0"><span style="color:#EF4444">Nessun owner</span></div>';
  }

  let transferHtml = '';
  if (l.league_type !== 'national' && isSuperAdmin) {
    transferHtml = `<div style="margin:12px 0;display:flex;gap:8px;align-items:center">
      <strong style="color:#94A3B8;font-size:13px">Trasferisci Ownership:</strong>
      <select id="new-owner-select" style="padding:6px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:12px;flex:1">
        <option value="">-- Seleziona --</option>
        ${members.filter(m => !m.is_owner).map(m => `<option value="${m.user_id}">${m.username} (${m.email}) [${m.role}]</option>`).join('')}
      </select>
      <button class="btn btn-sm" onclick="doTransferOwner('${l.id}')" data-testid="transfer-owner-btn">Trasferisci</button>
    </div>`;
  }

  let membersHtml = '<table style="font-size:13px"><tr><th>Username</th><th>Email</th><th>Ruolo</th><th>Azioni</th></tr>';
  members.forEach(m => {
    const isOwner = m.is_owner;
    const isAdmin = m.role === 'admin' || m.role === 'owner';
    let actionBtn = '';
    if (isOwner) {
      actionBtn = '<span class="tag tag-super">OWNER</span>';
    } else if (isAdmin) {
      actionBtn = `<button class="btn btn-sm btn-danger" onclick="toggleLeagueAdmin('${l.id}','${m.user_id}','remove')">Rimuovi Admin</button>`;
    } else {
      actionBtn = `<button class="btn btn-sm btn-outline" onclick="toggleLeagueAdmin('${l.id}','${m.user_id}','add')">Promuovi Admin</button>`;
    }
    membersHtml += `<tr>
      <td><strong>${m.username}</strong></td>
      <td style="color:#94A3B8;font-size:12px">${m.email}</td>
      <td><span class="tag tag-role">${m.role}</span></td>
      <td>${actionBtn}</td></tr>`;
  });
  membersHtml += '</table>';

  return `${ownerHtml}${transferHtml}
    <h4 style="color:#94A3B8;margin:16px 0 8px">Membri (${members.length})</h4>
    ${membersHtml}`;
}

async function doEditRules(leagueId) {
  if (!confirm('CONFERMA: Sei sicuro di voler modificare le impostazioni di questa lega? Le modifiche vengono registrate nell\\'audit log.')) return;

  const scoring_config = {};
  ['1x2','over_under','goal_no_goal','exact_score'].forEach(k => {
    scoring_config[k] = {
      enabled: document.getElementById('rule-'+k+'-on').checked,
      points: parseFloat(document.getElementById('rule-'+k+'-pts').value) || 0
    };
  });

  const body = {
    confirm: true,
    name: document.getElementById('rule-name').value.trim(),
    scoring_config: scoring_config,
    start_matchday: parseInt(document.getElementById('rule-start-md').value) || 1,
    end_matchday: parseInt(document.getElementById('rule-end-md').value) || 38,
    bet_deadline_minutes: parseInt(document.getElementById('rule-deadline').value) || 5,
    include_championship_predictions: document.getElementById('rule-champ').value === 'true'
  };

  try {
    await apiCall('/rbac/leagues/' + leagueId + '/rules', 'PUT', body);
    showToast('Impostazioni lega aggiornate');
    // Refresh leagues cache and reopen control room
    const leagues = await apiCall('/rbac/leagues');
    allLeaguesCache = leagues;
    showLeagueControlRoom(leagueId, 'info');
  } catch(e) { showToast(e.message, 'error'); }
}

function showLeagueAdmins(leagueId) {
  showLeagueControlRoom(leagueId, 'team');
}

async function showLeagueManage(leagueId) {
  showLeagueControlRoom(leagueId, 'team');
}

async function doTransferOwner(leagueId) {
  const newOwnerId = document.getElementById('new-owner-select').value;
  if (!newOwnerId) { showToast('Seleziona un nuovo owner', 'error'); return; }
  if (!confirm('Confermi il trasferimento della ownership?')) return;
  try {
    await apiCall('/rbac/leagues/' + leagueId + '/transfer-owner', 'PUT', {new_owner_id: newOwnerId});
    showToast('Ownership trasferita');
    const leagues = await apiCall('/rbac/leagues');
    allLeaguesCache = leagues;
    crMembers = null;
    showLeagueControlRoom(leagueId, 'team');
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleLeagueAdmin(leagueId, userId, action) {
  const verb = action === 'add' ? 'promuovere ad admin' : 'rimuovere da admin';
  if (!confirm(`Vuoi ${verb} questo utente?`)) return;
  try {
    await apiCall('/rbac/leagues/' + leagueId + '/admins', 'PUT', {user_id: userId, action: action});
    showToast('Ruolo aggiornato');
    crMembers = null;
    showLeagueControlRoom(leagueId, 'team');
  } catch(e) { showToast(e.message, 'error'); }
}

function renderCrDanger(l) {
  if (!isSuperAdmin) {
    return '<p style="color:#94A3B8;font-size:13px">Solo i Super Admin possono accedere a questa sezione.</p>';
  }
  const isNational = l.league_type === 'national';
  if (isNational) {
    return `<div style="padding:16px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px">
      <h4 style="color:#EF4444;margin-bottom:8px;font-size:14px">Zona Pericolo</h4>
      <p style="color:#94A3B8;font-size:13px">La Lega Nazionale non puo essere eliminata. E la lega di sistema principale.</p>
    </div>`;
  }
  const members = l.member_count || 0;
  const hasData = members > 0;
  if (!hasData) {
    return `<div style="padding:16px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px">
      <h4 style="color:#EF4444;margin-bottom:8px;font-size:14px">Zona Pericolo</h4>
      <p style="color:#94A3B8;font-size:12px;margin-bottom:12px">Questa lega non ha membri. Puoi eliminarla in sicurezza.</p>
      <button class="btn btn-sm btn-danger" onclick="doLeagueDelete('${l.id}',false)" data-testid="league-delete-btn">Elimina Lega</button>
    </div>`;
  }
  return `<div style="padding:16px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px">
    <h4 style="color:#EF4444;margin-bottom:8px;font-size:14px">Zona Pericolo</h4>
    <p style="color:#F87171;font-size:12px;margin-bottom:8px">Questa lega ha <strong>${members}</strong> membri. La cancellazione distrugge TUTTI i dati associati: giornate, partite, pronostici, punteggi, classifiche e iscrizioni.</p>
    <div>
      <p style="font-size:12px;margin-bottom:8px">Digita <strong style="color:#EF4444">DELETE</strong> per procedere con l\\'override:</p>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="league-delete-confirm" placeholder="Digita DELETE" style="padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="league-delete-confirm">
        <button class="btn btn-sm btn-danger" onclick="doLeagueDelete('${l.id}',true)" data-testid="league-override-delete-btn">Override Eliminazione</button>
      </div>
    </div>
  </div>`;
}

async function doLeagueDelete(leagueId, isOverride) {
  if (isOverride) {
    const confirmInput = document.getElementById('league-delete-confirm');
    if (!confirmInput || confirmInput.value !== 'DELETE') {
      showToast('Devi digitare DELETE per confermare', 'error'); return;
    }
  }
  const l = allLeaguesCache.find(x => x.id === leagueId);
  const name = l ? l.name : leagueId;
  if (!confirm('ATTENZIONE: Eliminare la lega "' + name + '" e TUTTI i dati associati (giornate, partite, pronostici, punteggi, iscrizioni)? Questa azione e IRREVERSIBILE.')) return;
  try {
    const r = await apiCall('/admin/leagues/' + leagueId, 'DELETE');
    closeModal();
    showToast('Lega eliminata (' + (r.deleted_matchdays||0) + ' giornate, ' + (r.deleted_matches||0) + ' partite, ' + (r.deleted_predictions||0) + ' pronostici, ' + (r.deleted_memberships||0) + ' iscrizioni)');
    render_leagues();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// PAYMENTS (existing)
// ========================================
async function render_payments() {
  if (!hasPerm('admin.payments.view')) { render_forbidden(); return; }
  const statusFilter = navFilter.status || '';
  navFilter = {};
  const payments = await apiCall('/admin/payments');
  let filtered = payments;
  if (statusFilter === 'pending') filtered = payments.filter(p => p.payment_status !== 'paid');

  let filterHtml = `<div class="card"><div class="form-row">
    <select id="pay-filter" onchange="filterPayments()" data-testid="pay-status-filter">
      <option value="">Tutti</option>
      <option value="pending" ${statusFilter==='pending'?'selected':''}>Pending</option>
      <option value="paid">Pagati</option>
    </select>
  </div></div>`;

  let html = '<h2>Pagamenti Stripe</h2>' + filterHtml + '<div id="payments-table"></div>';
  document.getElementById('content').innerHTML = html;
  window._allPayments = payments;
  renderPaymentsTable(filtered);
}

function filterPayments() {
  const sf = document.getElementById('pay-filter').value;
  let filtered = window._allPayments || [];
  if (sf === 'pending') filtered = filtered.filter(p => p.payment_status !== 'paid');
  else if (sf === 'paid') filtered = filtered.filter(p => p.payment_status === 'paid');
  renderPaymentsTable(filtered);
}

function renderPaymentsTable(payments) {
  let html = '<table><tr><th>Data</th><th>Utente</th><th>Importo</th><th>Stato</th><th>Session</th></tr>';
  payments.forEach(p => {
    html += `<tr><td>${new Date(p.created_at).toLocaleString('it')}</td><td>${p.user_id}</td>
    <td>${p.amount} ${p.currency}</td><td><span class="status-badge status-${p.payment_status=='paid'?'finished':'scheduled'}">${p.payment_status}</span></td>
    <td style="font-size:11px">${p.session_id||''}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('payments-table').innerHTML = html;
}

// ========================================
// PUSH NOTIFICATIONS
// ========================================
let _pushUsers = [];
let _pushUsersFiltered = [];

async function render_push() {
  if (!hasPerm('admin.dashboard.view')) { render_forbidden(); return; }

  let leagues = [];
  try { leagues = await apiCall('/rbac/leagues'); } catch(e) {}
  try { _pushUsers = await apiCall('/rbac/users'); } catch(e) { _pushUsers = []; }
  _pushUsersFiltered = [..._pushUsers];

  let leagueOptions = '<option value="all">Tutti gli utenti</option>';
  leagues.forEach(l => {
    leagueOptions += `<option value="${l.id}">${l.name} (${l.member_count} membri)</option>`;
  });

  // Load reminders status
  let reminders = {};
  try { reminders = await apiCall('/admin/push/reminders-status'); } catch(e) {}

  // Load history
  let history = [];
  try { history = await apiCall('/admin/push/history?limit=50'); } catch(e) {}

  let html = `<h2>Push Notifiche</h2>

  <!-- AUTO REMINDERS STATUS -->
  <div class="card" style="max-width:700px;margin-bottom:24px">
    <h3 style="margin-top:0;margin-bottom:16px;color:#8B5CF6">Notifiche Automatiche Pre-Partita</h3>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${reminders.push_enabled ? '#10B981' : '#EF4444'}"></span>
      <span style="font-weight:600;color:${reminders.push_enabled ? '#10B981' : '#EF4444'}">${reminders.push_enabled ? 'ATTIVE' : 'DISATTIVATE'}</span>
      <span style="color:#94A3B8;font-size:13px">(Controllo ogni ${Math.round((reminders.check_interval_seconds||300)/60)} min)</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#F8FAFC"><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #E2E8F0">Tipo</th><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #E2E8F0">Quando</th><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #E2E8F0">Descrizione</th></tr>`;
  (reminders.reminder_types || []).forEach(rt => {
    html += `<tr><td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;font-weight:600">${rt.label}</td><td style="padding:8px 12px;border-bottom:1px solid #F1F5F9"><code>${rt.type}</code></td><td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#64748B;font-size:13px">${rt.description}</td></tr>`;
  });
  html += `</table>`;
  if ((reminders.recent_reminders || []).length > 0) {
    html += `<p style="margin-top:12px;font-size:13px;color:#64748B">Ultimi reminder inviati:</p><ul style="font-size:13px;color:#475569;margin:4px 0 0 0;padding-left:16px">`;
    reminders.recent_reminders.forEach(r => {
      html += `<li><strong>${r.type}</strong>: ${r.title} <span style="color:#94A3B8">(${new Date(r.created_at).toLocaleString('it-IT')})</span></li>`;
    });
    html += `</ul>`;
  }
  html += `</div>

  <!-- BROADCAST -->
  <div class="card" style="max-width:700px;margin-bottom:24px">
    <h3 style="margin-top:0;margin-bottom:16px;color:#F59E0B">Invia notifica broadcast</h3>
    <div class="form-row">
      <label>Destinatario</label>
      <select id="push-target">${leagueOptions}</select>
    </div>
    <div class="form-row">
      <label>Titolo *</label>
      <input type="text" id="push-title" placeholder="es. Nuova giornata disponibile!" />
    </div>
    <div class="form-row">
      <label>Messaggio *</label>
      <textarea id="push-body" rows="3" placeholder="Scrivi il messaggio..." style="width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical"></textarea>
    </div>
    <div class="form-row">
      <label>URL Immagine (opzionale)</label>
      <input type="text" id="push-image" placeholder="https://esempio.com/immagine.png" />
    </div>
    <div style="display:flex;gap:12px;align-items:center;margin-top:16px">
      <button onclick="sendBroadcastPush()" style="background:#F59E0B;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px">Invia Notifica</button>
      <span id="push-result" style="font-size:13px"></span>
    </div>
  </div>

  <!-- SINGLE USER -->
  <div class="card" style="max-width:700px;margin-bottom:24px">
    <h3 style="margin-top:0;margin-bottom:16px;color:#3B82F6">Invia a singolo utente</h3>
    <div class="form-row">
      <label>Utente *</label>
      <div style="position:relative">
        <input type="text" id="push-user-search" placeholder="Cerca per username o email..." oninput="filterPushUsers()" onfocus="document.getElementById('push-user-dropdown').style.display='block'" autocomplete="off" />
        <div id="push-user-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:#fff;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:100"></div>
        <input type="hidden" id="push-user-id" />
      </div>
    </div>
    <div class="form-row">
      <label>Titolo *</label>
      <input type="text" id="push-user-title" placeholder="Titolo notifica" />
    </div>
    <div class="form-row">
      <label>Messaggio *</label>
      <textarea id="push-user-body" rows="3" placeholder="Messaggio..." style="width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical"></textarea>
    </div>
    <div class="form-row">
      <label>URL Immagine (opzionale)</label>
      <input type="text" id="push-user-image" placeholder="https://esempio.com/immagine.png" />
    </div>
    <div style="display:flex;gap:12px;align-items:center;margin-top:16px">
      <button onclick="sendUserPush()" style="background:#3B82F6;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px">Invia a Utente</button>
      <span id="push-user-result" style="font-size:13px"></span>
    </div>
  </div>

  <!-- HISTORY -->
  <div class="card" style="max-width:900px">
    <h3 style="margin-top:0;margin-bottom:16px;color:#64748B">Storico Notifiche Admin</h3>`;
  if (history.length === 0) {
    html += `<p style="color:#94A3B8;font-size:14px">Nessuna notifica admin inviata.</p>`;
  } else {
    html += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F8FAFC"><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E2E8F0">Data</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E2E8F0">Tipo</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E2E8F0">Titolo</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E2E8F0">Messaggio</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E2E8F0">Destinatario</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E2E8F0">Img</th></tr>`;
    history.forEach(h => {
      const date = new Date(h.created_at).toLocaleString('it-IT', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      const typeBadge = h.type === 'admin_broadcast' ? '<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">BROADCAST</span>' : '<span style="background:#DBEAFE;color:#1E40AF;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">DIRETTO</span>';
      const imgIcon = h.image ? '<span title="'+h.image+'">&#128247;</span>' : '-';
      html += `<tr style="border-bottom:1px solid #F1F5F9"><td style="padding:8px 10px;white-space:nowrap">${date}</td><td style="padding:8px 10px">${typeBadge}</td><td style="padding:8px 10px;font-weight:600">${h.title}</td><td style="padding:8px 10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.message}</td><td style="padding:8px 10px">${h.username}</td><td style="padding:8px 10px;text-align:center">${imgIcon}</td></tr>`;
    });
    html += `</table></div>`;
  }
  html += `</div>`;

  document.getElementById('content').innerHTML = html;

  // Close dropdown on click outside
  document.addEventListener('click', function(e) {
    const dd = document.getElementById('push-user-dropdown');
    const input = document.getElementById('push-user-search');
    if (dd && input && !dd.contains(e.target) && e.target !== input) {
      dd.style.display = 'none';
    }
  });
}

function filterPushUsers() {
  const query = (document.getElementById('push-user-search').value || '').toLowerCase();
  const dd = document.getElementById('push-user-dropdown');
  _pushUsersFiltered = _pushUsers.filter(u => 
    (u.username||'').toLowerCase().includes(query) || (u.email||'').toLowerCase().includes(query)
  ).slice(0, 20);
  let items = '';
  _pushUsersFiltered.forEach(u => {
    items += `<div onclick="selectPushUser('${u.id}','${u.username}','${u.email}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #F1F5F9;display:flex;justify-content:space-between;align-items:center" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='#fff'"><span style="font-weight:600">${u.username}</span><span style="color:#94A3B8;font-size:12px">${u.email}</span></div>`;
  });
  if (_pushUsersFiltered.length === 0) items = '<div style="padding:10px 14px;color:#94A3B8">Nessun utente trovato</div>';
  dd.innerHTML = items;
  dd.style.display = 'block';
}

function selectPushUser(id, username, email) {
  document.getElementById('push-user-id').value = id;
  document.getElementById('push-user-search').value = username + ' (' + email + ')';
  document.getElementById('push-user-dropdown').style.display = 'none';
}

async function sendBroadcastPush() {
  const target = document.getElementById('push-target').value;
  const title = document.getElementById('push-title').value.trim();
  const body = document.getElementById('push-body').value.trim();
  const image_url = (document.getElementById('push-image').value || '').trim();
  const resultEl = document.getElementById('push-result');
  if (!title || !body) { resultEl.innerHTML = '<span style="color:#EF4444">Compila titolo e messaggio</span>'; return; }
  resultEl.innerHTML = '<span style="color:#94A3B8">Invio in corso...</span>';
  try {
    const payload = {title, body, target};
    if (image_url) payload.image_url = image_url;
    const res = await apiCall('/admin/push/broadcast', 'POST', payload);
    resultEl.innerHTML = `<span style="color:#10B981">Inviata a ${res.sent_count} utenti</span>`;
    document.getElementById('push-title').value = '';
    document.getElementById('push-body').value = '';
    document.getElementById('push-image').value = '';
  } catch(e) {
    resultEl.innerHTML = `<span style="color:#EF4444">${e.message}</span>`;
  }
}

async function sendUserPush() {
  const userId = document.getElementById('push-user-id').value;
  const title = document.getElementById('push-user-title').value.trim();
  const body = document.getElementById('push-user-body').value.trim();
  const image_url = (document.getElementById('push-user-image').value || '').trim();
  const resultEl = document.getElementById('push-user-result');
  if (!userId) { resultEl.innerHTML = '<span style="color:#EF4444">Seleziona un utente dal menu</span>'; return; }
  if (!title || !body) { resultEl.innerHTML = '<span style="color:#EF4444">Compila titolo e messaggio</span>'; return; }
  resultEl.innerHTML = '<span style="color:#94A3B8">Invio in corso...</span>';
  try {
    const payload = {title, body};
    if (image_url) payload.image_url = image_url;
    const res = await apiCall('/admin/push/user/'+userId, 'POST', payload);
    resultEl.innerHTML = `<span style="color:#10B981">Notifica inviata!</span>`;
    document.getElementById('push-user-title').value = '';
    document.getElementById('push-user-body').value = '';
    document.getElementById('push-user-image').value = '';
    document.getElementById('push-user-search').value = '';
    document.getElementById('push-user-id').value = '';
  } catch(e) {
    resultEl.innerHTML = `<span style="color:#EF4444">${e.message}</span>`;
  }
}

// ========================================
// TOURNAMENTS MANAGEMENT
// ========================================
let allTournamentsCache = [];

async function render_tournaments() {
  if (!hasPerm('admin.tournaments.manage')) { render_forbidden(); return; }
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Gestione Tornei</h2><div id="tourn-actions" class="card"></div><div id="tourn-counters"></div><div id="tourn-list"></div>';

  document.getElementById('tourn-actions').innerHTML = `
    <div class="form-row" style="justify-content:space-between">
      <button class="btn" onclick="showCreateTournamentModal()" data-testid="create-tournament-btn">+ Nuovo Torneo</button>
      <input class="search-bar" style="margin:0;max-width:300px" id="tourn-search" placeholder="Cerca torneo..." oninput="filterTournaments()" data-testid="tourn-search-input">
    </div>`;

  try {
    const tournaments = await apiCall('/admin/tournaments');
    allTournamentsCache = tournaments;

    const draft = tournaments.filter(t => t.status === 'draft').length;
    const reg = tournaments.filter(t => t.status === 'registration').length;
    const active = tournaments.filter(t => ['groups','knockout','semifinal','final'].includes(t.status)).length;
    const completed = tournaments.filter(t => t.status === 'completed').length;

    document.getElementById('tourn-counters').innerHTML = `
    <div class="counter-row">
      <div class="counter-box"><div class="num">${tournaments.length}</div><div class="label">Totale</div></div>
      <div class="counter-box"><div class="num" style="color:#475569">${draft}</div><div class="label">Bozza</div></div>
      <div class="counter-box"><div class="num" style="color:#3B82F6">${reg}</div><div class="label">Iscrizioni</div></div>
      <div class="counter-box"><div class="num" style="color:#10B981">${active}</div><div class="label">In Corso</div></div>
      <div class="counter-box"><div class="num" style="color:#6B7280">${completed}</div><div class="label">Completati</div></div>
    </div>`;

    renderTournamentsTable(tournaments);
  } catch(e) { showToast(e.message, 'error'); }
}

function filterTournaments() {
  const q = (document.getElementById('tourn-search').value || '').toLowerCase();
  let filtered = allTournamentsCache;
  if (q) filtered = filtered.filter(t => (t.name||'').toLowerCase().includes(q));
  renderTournamentsTable(filtered);
}

function renderTournamentsTable(tournaments) {
  if (tournaments.length === 0) {
    document.getElementById('tourn-list').innerHTML = '<p style="color:#94A3B8;padding:16px">Nessun torneo trovato.</p>';
    return;
  }
  let html = '<table><tr><th>Nome</th><th>Stato</th><th>Tipo</th><th>Formato</th><th>Partecipanti</th><th>Prezzo</th><th>Gironi</th><th>Giornate</th><th>Passano</th><th>Creato</th><th>Azioni</th></tr>';
  tournaments.forEach(t => {
    const statusMap = {draft:'DRAFT',registration:'ISCRIZIONI',groups:'GIRONI',knockout:'ELIMINAZIONE',semifinal:'SEMIFINALE',final:'FINALE',completed:'COMPLETATO'};
    const statusLabel = statusMap[t.status] || t.status;
    const statusCls = t.status === 'draft' ? 'status-DRAFT' : t.status === 'registration' ? 'status-OPEN' : t.status === 'completed' ? 'status-COMPLETED' : 'status-LIVE';
    const typeLabel = (t.tournament_type === 'knockout_only') ? 'Solo Elim.' : 'Gironi + Elim.';
    const rrLabel = t.round_robin_type === 'double' ? 'A/R' : 'Andata';
    const fee = t.entry_fee > 0 ? t.entry_fee.toFixed(2) + ' EUR' : '<span style="color:#10B981">Gratis</span>';
    const created = t.created_at ? new Date(t.created_at).toLocaleDateString('it') : '-';

    let actions = '';
    if (t.status === 'draft') {
      actions += `<button class="btn btn-sm btn-success" onclick="adminOpenTournamentReg('${t.id}')" data-testid="open-reg-${t.id}">Apri Iscrizioni</button> `;
    }
    if (t.status === 'registration') {
      actions += `<button class="btn btn-sm" onclick="adminForceStartTournament('${t.id}','${t.name}')" data-testid="force-start-${t.id}">Avvia</button> `;
    }
    actions += `<button class="btn btn-sm btn-outline" onclick="showTournamentManager('${t.id}')" data-testid="manage-tourn-${t.id}">Gestisci</button> `;
    actions += `<button class="btn btn-sm btn-danger" onclick="showDeleteTournamentModal('${t.id}','${t.name}')" data-testid="delete-tourn-${t.id}">Elimina</button>`;

    html += `<tr data-testid="tourn-row-${t.id}">
      <td><strong>${t.name}</strong></td>
      <td><span class="status-badge ${statusCls}">${statusLabel}</span></td>
      <td style="font-size:12px">${typeLabel}</td>
      <td style="font-size:12px">${rrLabel}</td>
      <td>${t.registered_count || 0} / ${t.max_participants}</td>
      <td>${fee}</td>
      <td>${t.groups_count || '-'} (${t.players_per_group || '-'}/g)</td>
      <td>${t.duration_rounds || '-'}</td>
      <td>${t.advance_count || '-'}</td>
      <td style="font-size:12px;color:#94A3B8">${created}</td>
      <td>${actions}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('tourn-list').innerHTML = html;
}

function showCreateTournamentModal() {
  showModal(`
    <h3>Nuovo Torneo</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:span 2">
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Nome Torneo *</label>
        <input id="nt-name" placeholder="es. Torneo Primavera 2026" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-name">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Tipologia Torneo</label>
        <select id="nt-type" onchange="onTournTypeChange()" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-type">
          <option value="groups_knockout">Gironi + Eliminazione Diretta</option>
          <option value="knockout_only">Solo Eliminazione Diretta</option>
        </select>
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Prezzo Iscrizione (EUR)</label>
        <input id="nt-fee" type="number" step="0.01" min="0" value="0" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-fee">
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Max Partecipanti</label>
        <select id="nt-max" onchange="recalcTournament()" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-max">
          <option value="8">8</option>
          <option value="16" selected>16</option>
          <option value="32">32</option>
          <option value="64">64</option>
        </select>
      </div>
      <div>
        <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Formato Gironi</label>
        <select id="nt-rr-type" onchange="recalcTournament()" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-rr-type">
          <option value="single">Solo Andata</option>
          <option value="double">Andata e Ritorno</option>
        </select>
      </div>
    </div>

    <div id="nt-groups-section" style="margin-top:16px">
      <h4 style="color:#F5A623;margin-bottom:8px;font-size:14px">Configurazione Gironi</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div>
          <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Numero Gironi</label>
          <input id="nt-groups" type="number" min="1" max="16" value="4" onchange="recalcTournament()" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-groups">
        </div>
        <div>
          <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Giocatori per Girone</label>
          <input id="nt-ppg" type="number" min="2" max="16" value="4" onchange="recalcTournament()" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-ppg">
        </div>
        <div>
          <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Passano alla Eliminazione</label>
          <input id="nt-advance" type="number" min="1" max="8" value="2" onchange="recalcTournament()" style="width:100%;padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px" data-testid="nt-advance">
        </div>
      </div>
      <div id="nt-calc" style="margin-top:12px"></div>
    </div>

    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn" onclick="doCreateTournament()" data-testid="confirm-create-tournament">Crea Torneo</button>
    </div>`);
  recalcTournament();
}

function onTournTypeChange() {
  const type = document.getElementById('nt-type').value;
  document.getElementById('nt-groups-section').style.display = type === 'knockout_only' ? 'none' : 'block';
  recalcTournament();
}

function recalcTournament() {
  const max = parseInt(document.getElementById('nt-max').value) || 16;
  const groups = parseInt(document.getElementById('nt-groups').value) || 4;
  const ppg = parseInt(document.getElementById('nt-ppg').value) || 4;
  const advance = parseInt(document.getElementById('nt-advance').value) || 2;
  const rrType = document.getElementById('nt-rr-type').value;
  const calcEl = document.getElementById('nt-calc');
  if (!calcEl) return;

  let html = '';
  const expected = groups * ppg;

  if (expected !== max) {
    html += '<div style="color:#EF4444;font-size:12px;margin-bottom:6px">&#9888; ' + groups + ' gironi x ' + ppg + ' giocatori = ' + expected + ' (diverso da ' + max + ' max)</div>';
  } else {
    html += '<div style="color:#10B981;font-size:12px;margin-bottom:6px">&#10003; ' + groups + ' gironi x ' + ppg + ' giocatori = ' + expected + ' partecipanti</div>';
  }

  const matchdays = rrType === 'double' ? 2 * (ppg - 1) : (ppg - 1);
  const matchesPerGroup = rrType === 'double' ? ppg * (ppg - 1) : ppg * (ppg - 1) / 2;
  const rrLabel = rrType === 'double' ? 'Andata e Ritorno' : 'Solo Andata';
  html += '<div style="color:#3B82F6;font-size:12px;margin-bottom:6px">&#9917; Fase a gironi (' + rrLabel + '): <strong>' + matchdays + ' giornate</strong>, ' + matchesPerGroup + ' partite per girone</div>';

  const totalQualifiers = groups * advance;
  const isPowerOf2 = totalQualifiers > 0 && (totalQualifiers & (totalQualifiers - 1)) === 0;

  if (advance >= ppg) {
    html += '<div style="color:#EF4444;font-size:12px;margin-bottom:6px">&#9888; Chi passa (' + advance + ') deve essere minore dei giocatori per girone (' + ppg + ')</div>';
  } else if (!isPowerOf2) {
    html += '<div style="color:#EF4444;font-size:12px;margin-bottom:6px">&#9888; Totale qualificati (' + totalQualifiers + ') non e una potenza di 2. Serve 2, 4, 8, 16, 32 o 64.</div>';
  } else {
    const knockoutNames = {2:'Finale',4:'Semifinali',8:'Quarti di finale',16:'Ottavi di finale',32:'Sedicesimi',64:'Trentaduesimi'};
    const startRound = knockoutNames[totalQualifiers] || ('Turno da ' + totalQualifiers);
    const knockoutRounds = Math.log2(totalQualifiers);
    html += '<div style="color:#F5A623;font-size:12px;margin-bottom:6px">&#127942; Eliminazione diretta: <strong>' + totalQualifiers + ' qualificati</strong> &rarr; si parte dai <strong>' + startRound + '</strong> (' + knockoutRounds + ' turni)</div>';

    html += '<div style="color:#94A3B8;font-size:11px;margin-top:4px;padding:8px;background:#0F172A;border-radius:6px;border:1px solid #334155">';
    html += '<strong style="color:#F5A623">Tabellone Champions League:</strong><br>';
    if (groups >= 2) {
      const letters = [];
      for (let i = 0; i < groups; i++) letters.push(String.fromCharCode(65 + i));
      for (let i = 0; i < groups; i += 2) {
        if (i + 1 < groups) {
          const gA = letters[i], gB = letters[i+1];
          const matches = [];
          for (let r = 1; r <= advance; r++) {
            const opponent = advance - r + 1;
            matches.push(r + 'o ' + gA + ' vs ' + opponent + 'o ' + gB);
          }
          html += '<span style="color:#F5A623">' + gA + '-' + gB + ':</span> ' + matches.join(' &nbsp;|&nbsp; ');
          if (i + 2 < groups) html += '<br>';
        }
      }
    }
    html += '</div>';
  }

  calcEl.innerHTML = html;
}

async function doCreateTournament() {
  const type = document.getElementById('nt-type').value;
  const ppg = parseInt(document.getElementById('nt-ppg').value);
  const advance = parseInt(document.getElementById('nt-advance').value);
  const groups = parseInt(document.getElementById('nt-groups').value);
  const totalQ = groups * advance;
  const isPowerOf2 = totalQ > 0 && (totalQ & (totalQ - 1)) === 0;

  if (!isPowerOf2 && type === 'groups_knockout') {
    showToast('Il totale qualificati (' + totalQ + ') deve essere una potenza di 2', 'error');
    return;
  }

  const body = {
    name: document.getElementById('nt-name').value.trim(),
    max_participants: parseInt(document.getElementById('nt-max').value),
    groups_count: groups,
    players_per_group: ppg,
    advance_count: advance,
    entry_fee: parseFloat(document.getElementById('nt-fee').value) || 0,
    tournament_type: type,
    round_robin_type: document.getElementById('nt-rr-type').value,
  };

  if (!body.name || body.name.length < 3) {
    showToast('Il nome deve avere almeno 3 caratteri', 'error'); return;
  }

  try {
    const res = await apiCall('/admin/tournaments', 'POST', body);
    closeModal();
    showToast('Torneo creato: ' + res.name + ' (' + res.duration_rounds + ' giornate gironi)');
    render_tournaments();
  } catch(e) { showToast(e.message, 'error'); }
}


// ========================================
// TOURNAMENT MANAGEMENT (rounds & matches)
// ========================================
async function showTournamentManager(tournId) {
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Gestione Torneo</h2><div id="tm-loading" style="color:#94A3B8">Caricamento...</div>';

  try {
    const [tourn, rounds] = await Promise.all([
      apiCall('/tournaments/' + tournId + '?include_drafts=true').catch(() => null),
      apiCall('/admin/tournament-rounds/' + tournId).catch(() => [])
    ]);

    if (!tourn) {
      el.innerHTML = '<h2>Gestione Torneo</h2><p style="color:#EF4444">Torneo non trovato</p>';
      return;
    }

    let html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">';
    html += '<button class="btn btn-sm btn-outline" onclick="render_tournaments()">&larr; Torna ai Tornei</button>';
    html += '<h2 style="margin:0;flex:1">' + tourn.name + '</h2>';
    const statusMap = {draft:'DRAFT',registration:'ISCRIZIONI',groups:'GIRONI',knockout:'ELIMINAZIONE',completed:'COMPLETATO'};
    const statusLabel = statusMap[tourn.status] || tourn.status;
    const statusCls = tourn.status === 'draft' ? 'status-DRAFT' : tourn.status === 'registration' ? 'status-OPEN' : tourn.status === 'completed' ? 'status-COMPLETED' : 'status-LIVE';
    html += '<span class="status-badge ' + statusCls + '">' + statusLabel + '</span>';
    html += '</div>';

    // Tournament info card
    html += '<div class="card"><div class="counter-row">';
    html += '<div class="counter-box"><div class="num">' + (tourn.registered_count || 0) + '/' + tourn.max_participants + '</div><div class="label">Iscritti</div></div>';
    html += '<div class="counter-box"><div class="num" style="color:#3B82F6">' + (tourn.groups_count || 0) + '</div><div class="label">Gironi</div></div>';
    html += '<div class="counter-box"><div class="num" style="color:#F5A623">' + (tourn.duration_rounds || 0) + '</div><div class="label">Giornate Gironi</div></div>';
    html += '<div class="counter-box"><div class="num" style="color:#10B981">' + (rounds.length || 0) + '</div><div class="label">Round Creati</div></div>';
    html += '</div>';

    // Actions based on status
    if (tourn.status === 'draft') {
      html += '<button class="btn btn-success" onclick="adminOpenTournamentReg(&quot;' + tournId + '&quot;);setTimeout(function(){showTournamentManager(&quot;' + tournId + '&quot;)},1000)">Apri Iscrizioni</button> ';
    }
    if (tourn.status === 'registration') {
      html += '<button class="btn" onclick="adminForceStartTournament(&quot;' + tournId + '&quot;,&quot;' + tourn.name + '&quot;);setTimeout(function(){showTournamentManager(&quot;' + tournId + '&quot;)},1500)">Avvia Torneo (anche senza pieni)</button> ';
    }
    html += '</div>';

    // Rounds section
    html += '<div class="card" style="margin-top:16px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<h3 style="color:#F5A623;margin:0">Giornate del Torneo</h3>';
    if (['groups','knockout'].includes(tourn.status)) {
      html += '<button class="btn btn-sm" onclick="createTournamentRound(&quot;' + tournId + '&quot;)" data-testid="create-round-btn">+ Nuova Giornata</button>';
    } else {
      html += '<span style="color:#94A3B8;font-size:12px">Avvia il torneo per creare giornate</span>';
    }
    html += '</div>';

    if (rounds.length === 0) {
      html += '<p style="color:#94A3B8">Nessuna giornata creata.</p>';
    } else {
      html += '<table><tr><th>#</th><th>Etichetta</th><th>Tipo</th><th>Stato</th><th>Partite</th><th>Azioni</th></tr>';
      rounds.forEach(r => {
        const rStatusCls = r.status === 'OPEN' ? 'status-OPEN' : r.status === 'COMPLETED' ? 'status-COMPLETED' : 'status-DRAFT';
        let rActions = '';
        if (r.status === 'PENDING') {
          rActions += '<button class="btn btn-sm" onclick="showAddMatchesModal(&quot;' + tournId + '&quot;,&quot;' + r.id + '&quot;,&quot;' + r.label + '&quot;)">+ Partite</button> ';
          rActions += '<button class="btn btn-sm btn-success" onclick="openTournamentRound(&quot;' + tournId + '&quot;,&quot;' + r.id + '&quot;)">Apri</button> ';
        }
        if (r.status === 'OPEN') {
          rActions += '<button class="btn btn-sm" onclick="showAddMatchesModal(&quot;' + tournId + '&quot;,&quot;' + r.id + '&quot;,&quot;' + r.label + '&quot;)">+ Partite</button> ';
          rActions += '<button class="btn btn-sm btn-danger" onclick="completeTournamentRound(&quot;' + tournId + '&quot;,&quot;' + r.id + '&quot;)">Completa</button> ';
        }
        if (r.status === 'COMPLETED') {
          rActions += '<span style="color:#10B981;font-size:12px">Completato</span>';
        }
        html += '<tr><td>' + r.round_number + '</td><td><strong>' + r.label + '</strong></td><td>' + r.round_type + '</td>';
        html += '<td><span class="status-badge ' + rStatusCls + '">' + r.status + '</span></td>';
        html += '<td>' + (r.match_count || 0) + '</td>';
        html += '<td>' + rActions + '</td></tr>';
      });
      html += '</table>';
    }
    html += '</div>';

    el.innerHTML = html;
  } catch(e) { showToast(e.message, 'error'); el.innerHTML = '<h2>Gestione Torneo</h2><p style="color:#EF4444">Errore: ' + e.message + '</p>'; }
}

async function createTournamentRound(tournId) {
  try {
    const res = await apiCall('/tournaments/' + tournId + '/rounds', 'POST', {round_type: 'group'});
    showToast('Giornata ' + res.round_number + ' creata');
    showTournamentManager(tournId);
  } catch(e) { showToast(e.message, 'error'); }
}

async function openTournamentRound(tournId, roundId) {
  if (!confirm('Aprire questa giornata per i pronostici?')) return;
  try {
    await apiCall('/tournaments/' + tournId + '/rounds/' + roundId + '/open', 'POST');
    showToast('Giornata aperta per i pronostici');
    showTournamentManager(tournId);
  } catch(e) { showToast(e.message, 'error'); }
}

async function completeTournamentRound(tournId, roundId) {
  if (!confirm('Completare questa giornata? Verranno calcolati i punteggi.')) return;
  try {
    await apiCall('/tournaments/' + tournId + '/rounds/' + roundId + '/complete', 'POST');
    showToast('Giornata completata, punteggi calcolati');
    showTournamentManager(tournId);
  } catch(e) { showToast(e.message, 'error'); }
}

function showAddMatchesModal(tournId, roundId, roundLabel) {
  showModal(`
    <h3>Aggiungi Partite a: ${roundLabel}</h3>
    <p style="color:#94A3B8;font-size:13px;margin-bottom:12px">Inserisci gli ID delle fixture API-Football separati da virgola, oppure aggiungi partite manualmente.</p>
    
    <div style="margin-bottom:16px">
      <h4 style="color:#F5A623;font-size:14px;margin-bottom:8px">Importa da API-Football</h4>
      <div class="form-row">
        <input id="am-fixtures" placeholder="Es: 1234567, 1234568, 1234569" style="flex:2">
        <button class="btn" onclick="doImportFixtures('${tournId}','${roundId}')">Importa</button>
      </div>
    </div>

    <div>
      <h4 style="color:#F5A623;font-size:14px;margin-bottom:8px">Aggiungi Partita Manuale</h4>
      <div class="form-row">
        <input id="am-home" placeholder="Squadra Casa" style="flex:1">
        <span style="color:#94A3B8;padding:0 8px">vs</span>
        <input id="am-away" placeholder="Squadra Ospite" style="flex:1">
        <input id="am-comp" placeholder="Competizione" style="flex:1" value="Torneo">
        <input id="am-time" type="datetime-local" style="flex:1">
        <button class="btn" onclick="doAddManualMatch('${tournId}','${roundId}')">Aggiungi</button>
      </div>
    </div>

    <div id="am-result" style="margin-top:12px"></div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn btn-outline" onclick="closeModal();showTournamentManager('${tournId}')">Chiudi</button>
    </div>`);
}

async function doImportFixtures(tournId, roundId) {
  const ids = document.getElementById('am-fixtures').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  if (ids.length === 0) { showToast('Inserisci almeno un ID fixture', 'error'); return; }
  try {
    const res = await apiCall('/tournaments/' + tournId + '/rounds/' + roundId + '/import-matches', 'POST', {fixture_ids: ids});
    document.getElementById('am-result').innerHTML = '<span style="color:#10B981">Importate ' + res.imported + ' partite</span>';
    document.getElementById('am-fixtures').value = '';
  } catch(e) { showToast(e.message, 'error'); }
}

async function doAddManualMatch(tournId, roundId) {
  const home = document.getElementById('am-home').value.trim();
  const away = document.getElementById('am-away').value.trim();
  const comp = document.getElementById('am-comp').value.trim();
  const time = document.getElementById('am-time').value;
  if (!home || !away) { showToast('Inserisci entrambe le squadre', 'error'); return; }
  try {
    await apiCall('/admin/tournament-matches', 'POST', {
      tournament_id: tournId,
      round_id: roundId,
      home_team: home,
      away_team: away,
      competition: comp || 'Torneo',
      start_time: time || new Date().toISOString()
    });
    document.getElementById('am-result').innerHTML = '<span style="color:#10B981">Partita aggiunta: ' + home + ' vs ' + away + '</span>';
    document.getElementById('am-home').value = '';
    document.getElementById('am-away').value = '';
  } catch(e) { showToast(e.message, 'error'); }
}

async function adminOpenTournamentReg(tournId) {
  if (!confirm('Vuoi aprire le iscrizioni per questo torneo?')) return;
  try {
    await apiCall('/admin/tournaments/' + tournId + '/open-registration', 'POST');
    showToast('Iscrizioni aperte');
    render_tournaments();
  } catch(e) { showToast(e.message, 'error'); }
}

async function adminForceStartTournament(tournId, tournName) {
  if (!confirm('Vuoi avviare "' + tournName + '" anche senza il numero completo di partecipanti? I gironi verranno ricalcolati automaticamente.')) return;
  try {
    const res = await apiCall('/admin/tournaments/' + tournId + '/force-start', 'POST');
    showToast('Torneo avviato! ' + res.actual_participants + ' partecipanti, ' + res.groups + ' gironi, ' + res.matchups_created + ' sfide create');
    render_tournaments();
  } catch(e) { showToast(e.message, 'error'); }
}

function showDeleteTournamentModal(tournId, tournName) {
  showModal(`
    <h3 style="color:#EF4444">Elimina Torneo: ${tournName}</h3>
    <p style="margin:12px 0;color:#94A3B8">Questa azione eliminera il torneo e tutti i dati correlati (iscrizioni, gironi, sfide).</p>
    <p style="margin:8px 0">Digita <strong style="color:#EF4444">DELETE</strong> per confermare:</p>
    <div class="form-row"><input id="delete-tourn-confirm" placeholder="Digita DELETE" data-testid="delete-tourn-confirm-input"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn btn-danger" onclick="doDeleteTournament('${tournId}')" data-testid="confirm-delete-tournament">Elimina Torneo</button>
    </div>`);
}

async function doDeleteTournament(tournId) {
  if (document.getElementById('delete-tourn-confirm').value !== 'DELETE') {
    showToast('Devi digitare DELETE per confermare', 'error'); return;
  }
  try {
    await apiCall('/admin/tournaments/' + tournId, 'DELETE');
    closeModal(); showToast('Torneo eliminato');
    render_tournaments();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// AUDIT (existing, enhanced)
// ========================================
async function render_audit() {
  if (!hasPerm('admin.audit.view')) { render_forbidden(); return; }
  const logs = await apiCall('/admin/audit-logs?limit=200');
  let html = '<h2>Audit Log</h2><table><tr><th>Data</th><th>Admin</th><th>Azione</th><th>Entita</th><th>IP</th><th>Dettagli</th></tr>';
  logs.forEach(l => {
    const ip = l.ip ? l.ip.split(',')[0] : '-';
    html += `<tr><td style="white-space:nowrap">${new Date(l.created_at).toLocaleString('it')}</td><td>${l.admin_username}</td>
    <td><span class="status-badge status-OPEN">${l.action}</span></td><td>${l.entity_type}/${(l.entity_id||'').substring(0,8)}</td>
    <td style="font-size:11px">${ip}</td>
    <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${JSON.stringify(l.details||{}).substring(0,100)}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('content').innerHTML = html;
}

// Init
if(token) {
  // Verify token is still valid
  apiCall('/rbac/my-permissions').then(data => {
    userPerms = data.permissions || [];
    isSuperAdmin = data.is_super_admin || false;
    localStorage.setItem('admin_perms', JSON.stringify(userPerms));
    localStorage.setItem('admin_is_super', isSuperAdmin.toString());
    if (!hasPerm('admin.dashboard.view')) { doLogout(); return; }
    renderDashboard();
  }).catch(() => { doLogout(); });
} else { renderLogin(); }
</script>
</body>
</html>"""
