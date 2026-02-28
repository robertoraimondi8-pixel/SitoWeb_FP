"""Admin UI HTML for FantaPronostic - RBAC-enabled web dashboard."""


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
.modal{background:#1E293B;border-radius:16px;padding:24px;width:90%;max-width:600px;max-height:85vh;overflow-y:auto;border:1px solid #334155;box-shadow:0 8px 32px rgba(0,0,0,.4)}
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
  {id:'matches', label:'Partite', perm:'admin.matches.manage'},
  {id:'leagues', label:'Leghe', perm:'admin.leagues.manage'},
  {section: 'AMMINISTRAZIONE'},
  {id:'roles', label:'Ruoli & Permessi', perm:'admin.roles.manage'},
  {id:'users', label:'Utenti', perm:'admin.users.manage'},
  {section: 'MONITORAGGIO'},
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
    if (noOwner.length > 0) alarms.push({icon:'!', color:'#EF4444', text:`${noOwner.length} leghe senza owner`, action:()=>"navigateWith('leagues',{risk:'no_owner'})"});
    if (noAdmin.length > 0) alarms.push({icon:'!', color:'#F59E0B', text:`${noAdmin.length} leghe senza admin`, action:()=>"navigateWith('leagues',{risk:'no_admin'})"});
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
        <div class="counter-box" style="border-color:${onlineCount > 0 ? '#10B981' : '#334155'}" title="Utenti con attivita negli ultimi 5 minuti" data-testid="kpi-users-online"><div class="num" style="color:#10B981">${onlineDot}${onlineCount}</div><div class="label">Online ora</div></div>
      </div>
    </div>`;

    // === LEGHE ===
    const riskCount = d.leagues.at_risk.length;
    const riskColor = riskCount > 0 ? '#EF4444' : '#10B981';
    html += `<div class="card" data-testid="kpi-leagues">
      <h3 style="color:#F5A623;margin-bottom:12px;font-size:15px">Leghe</h3>
      <div class="counter-row">
        <div class="counter-box" style="cursor:pointer" onclick="navigateWith('leagues',{})"><div class="num">${d.leagues.total}</div><div class="label">Totale</div></div>
        <div class="counter-box" style="cursor:pointer;border-color:${riskColor}" onclick="navigateWith('leagues',{risk:'all'})"><div class="num" style="color:${riskColor}">${riskCount}</div><div class="label">A Rischio</div></div>
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
          ${roleOpts}
        </select>
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
  else if (roleFilter) filtered = filtered.filter(u => u.role_ids && u.role_ids.includes(roleFilter));
  renderUsersTable(filtered);
}

function renderUsersTable(users) {
  let html = '<table><tr><th>Username</th><th>Email</th><th>Ruoli</th><th>Leghe</th><th>Ultimo Login</th><th>Stato</th><th>Azioni</th></tr>';
  users.forEach(u => {
    let tags = '';
    if (u.is_super_admin) tags += '<span class="tag tag-super">SUPER ADMIN</span> ';
    if (u.is_deleted) tags += '<span class="tag tag-disabled">ELIMINATO</span> ';
    else if (u.is_disabled) tags += '<span class="tag tag-disabled">DISABILITATO</span> ';
    (u.roles||[]).forEach(r => { tags += `<span class="tag tag-role">${r.name}</span> `; });
    if (!u.is_super_admin && (!u.roles || u.roles.length === 0) && !u.is_deleted) tags += '<span class="tag" style="color:#475569">Nessun ruolo</span>';

    // League counts with clickable numbers
    const leagueHtml = `
      <span style="cursor:pointer;color:#F5A623" onclick="showUserLeagues('${u.id}')" title="Clicca per dettagli">
        <span title="Create">${u.leagues_created||0}C</span> /
        <span title="Admin">${u.leagues_admin||0}A</span> /
        <span title="Membro">${u.leagues_member||0}M</span>
      </span>`;

    const lastLogin = u.last_login ? new Date(u.last_login).toLocaleString('it') : '<span style="color:#475569">Mai</span>';

    const statusBadge = u.is_deleted
      ? '<span class="status-badge status-void">Eliminato</span>'
      : u.is_disabled
        ? '<span class="status-badge status-void">Disabilitato</span>'
        : '<span class="status-badge status-live">Attivo</span>';

    let actions = '';
    if (!u.is_deleted) {
      actions += `<button class="btn btn-sm btn-outline" onclick="showEditUserModal('${u.id}')" data-testid="edit-user-${u.id}">Dettagli</button> `;
      actions += `<button class="btn btn-sm btn-outline" onclick="showAssignRolesModal('${u.id}')" data-testid="assign-roles-${u.id}">Ruoli</button> `;
      actions += `<button class="btn btn-sm ${u.is_disabled ? 'btn-success' : 'btn-danger'}" onclick="toggleUserStatus('${u.id}')" data-testid="toggle-status-${u.id}">${u.is_disabled ? 'Abilita' : 'Disabilita'}</button> `;
      actions += `<button class="btn btn-sm btn-danger" onclick="showSoftDeleteModal('${u.id}')" data-testid="soft-delete-${u.id}" style="background:#7C3AED">Elimina</button> `;
      if (hasPerm('admin.roles.manage') && isSuperAdmin) {
        actions += `<button class="btn btn-sm ${u.is_super_admin ? 'btn-danger' : 'btn-outline'}" onclick="toggleSuperAdmin('${u.id}',${!u.is_super_admin})" data-testid="toggle-sa-${u.id}">${u.is_super_admin ? 'Rimuovi SA' : 'Promuovi SA'}</button>`;
      }
    }

    html += `<tr data-testid="user-row-${u.id}" style="${u.is_deleted ? 'opacity:.35' : u.is_disabled ? 'opacity:.5' : ''}">
      <td><strong>${u.username}</strong></td>
      <td style="color:#94A3B8;font-size:12px">${u.email}</td>
      <td>${tags}</td>
      <td style="font-size:12px">${leagueHtml}</td>
      <td style="font-size:12px">${lastLogin}</td>
      <td>${statusBadge}</td>
      <td style="white-space:nowrap">${actions}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('users-list').innerHTML = html;
}

async function showUserLeagues(userId) {
  const user = allUsersCache.find(u => u.id === userId);
  if (!user) return;
  try {
    const leagues = await apiCall('/rbac/users/' + userId + '/leagues');
    let html = `<h3>Leghe di ${user.username}</h3>`;
    if (leagues.length === 0) {
      html += '<p style="color:#94A3B8;margin:12px 0">Nessuna lega</p>';
    } else {
      html += '<table><tr><th>Lega</th><th>Tipo</th><th>Ruolo</th><th>Owner</th><th>Iscritto</th></tr>';
      leagues.forEach(l => {
        const ownerTag = l.is_owner ? '<span class="tag tag-super">OWNER</span>' : '';
        const creatorTag = l.is_creator ? '<span class="tag tag-system">CREATOR</span>' : '';
        html += `<tr>
          <td><strong>${l.league_name}</strong></td>
          <td><span class="tag tag-role">${l.league_type}</span></td>
          <td>${l.membership_role}</td>
          <td>${ownerTag} ${creatorTag}</td>
          <td style="font-size:12px">${l.joined_at ? new Date(l.joined_at).toLocaleDateString('it') : '-'}</td></tr>`;
      });
      html += '</table>';
    }
    html += '<div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Chiudi</button></div>';
    showModal(html);
  } catch(e) { showToast(e.message, 'error'); }
}

function showSoftDeleteModal(userId) {
  const user = allUsersCache.find(u => u.id === userId);
  if (!user) return;
  showModal(`
    <h3 style="color:#7C3AED">Elimina Utente: ${user.username}</h3>
    <p style="margin:12px 0;color:#94A3B8">Soft-delete: l'utente verra' disabilitato e segnato come eliminato. I dati rimangono nel database.</p>
    ${user.leagues_created > 0 || user.leagues_admin > 0 ? `<p style="margin:8px 0;color:#F59E0B">Attenzione: l'utente ha ${user.leagues_created} leghe create e ${user.leagues_admin} ruoli admin. Se e' l'unico admin/owner, dovrai trasferire la ownership prima.</p>` : ''}
    <p style="margin:8px 0">Digita <strong style="color:#7C3AED">DELETE</strong> per confermare:</p>
    <div class="form-row"><input id="soft-delete-confirm" placeholder="Digita DELETE" data-testid="soft-delete-confirm-input"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
      <button class="btn" style="background:#7C3AED;color:#fff" onclick="doSoftDelete('${userId}')" data-testid="confirm-soft-delete">Elimina Utente</button>
    </div>`);
}

async function doSoftDelete(userId) {
  if (document.getElementById('soft-delete-confirm').value !== 'DELETE') {
    showToast('Devi digitare DELETE per confermare', 'error'); return;
  }
  try {
    await apiCall('/rbac/users/' + userId + '/soft-delete', 'PUT');
    closeModal(); showToast('Utente eliminato (soft)'); render_users();
  } catch(e) {
    // Handle orphan leagues error
    let msg = e.message;
    try {
      const parsed = JSON.parse(e.message.replace(/^[^{]*/, ''));
      if (parsed.orphan_leagues) {
        msg = parsed.message + ' Leghe: ' + parsed.orphan_leagues.map(l => l.name).join(', ');
      }
    } catch(ignore) {}
    showToast(msg, 'error');
  }
}

function showAssignRolesModal(userId) {
  const user = allUsersCache.find(u => u.id === userId);
  if (!user) return;
  const currentRoleIds = user.role_ids || [];

  let html = `<h3>Assegna Ruoli a: ${user.username}</h3><p style="color:#94A3B8;margin-bottom:12px">${user.email}</p>`;
  html += '<div id="role-assign-list">';
  allRolesCache.forEach(r => {
    const checked = currentRoleIds.includes(r.id) ? 'checked' : '';
    const cls = checked ? 'checked' : '';
    html += `<label class="perm-item ${cls}" style="margin-bottom:6px" data-perm="${r.id}">
      <input type="checkbox" name="assign-role" value="${r.id}" ${checked} onchange="this.parentElement.classList.toggle('checked')">
      <span><strong>${r.name}</strong><br><span style="color:#64748B;font-size:11px">${r.description||''} (${r.permissions.length} permessi)</span></span>
    </label>`;
  });
  html += '</div>';
  html += `<div class="modal-actions">
    <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
    <button class="btn" onclick="doAssignRoles('${userId}')" data-testid="confirm-assign-roles">Salva Ruoli</button>
  </div>`;
  showModal(html);
}

async function doAssignRoles(userId) {
  const roleIds = Array.from(document.querySelectorAll('input[name=assign-role]:checked')).map(c => c.value);
  try {
    await apiCall('/rbac/users/'+userId+'/roles', 'PUT', {role_ids: roleIds});
    closeModal(); showToast('Ruoli aggiornati'); render_users();
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleUserStatus(userId) {
  const user = allUsersCache.find(u => u.id === userId);
  const action = user && user.is_disabled ? 'riabilitare' : 'disabilitare';
  if (!confirm(`Vuoi ${action} l'utente ${user ? user.username : ''}?`)) return;
  try {
    await apiCall('/rbac/users/'+userId+'/status', 'PUT');
    showToast('Stato utente aggiornato'); render_users();
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleSuperAdmin(userId, value) {
  const user = allUsersCache.find(u => u.id === userId);
  const action = value ? 'promuovere a Super Admin' : 'rimuovere lo status di Super Admin da';
  if (!confirm(`Vuoi ${action} ${user ? user.username : ''}?`)) return;
  try {
    await apiCall('/rbac/users/'+userId+'/super-admin', 'PUT', {is_super_admin: value});
    showToast('Super Admin aggiornato'); render_users();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// U2: EDIT USER DETAILS MODAL
// ========================================
function showEditUserModal(userId) {
  const user = allUsersCache.find(u => u.id === userId);
  if (!user) return;
  const isGoogle = user.auth_provider === 'google';
  const googleNote = isGoogle ? '<p style="color:#F59E0B;font-size:12px;margin-bottom:12px">Utente Google - il reset password non e\\'  disponibile</p>' : '';

  let html = `<h3>Dettagli Utente</h3>
    <div style="margin-bottom:16px">
      <span class="tag tag-role">ID: ${user.id.substring(0,12)}...</span>
      ${user.is_super_admin ? '<span class="tag tag-super">SUPER ADMIN</span>' : ''}
      ${user.is_disabled ? '<span class="tag tag-disabled">DISABILITATO</span>' : '<span class="tag" style="background:rgba(16,185,129,.15);color:#10B981;border:1px solid rgba(16,185,129,.3)">ATTIVO</span>'}
    </div>
    ${googleNote}
    <div style="margin-bottom:12px">
      <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Username</label>
      <input id="edit-user-username" value="${user.username}" style="width:100%;padding:10px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:14px" data-testid="edit-user-username">
    </div>
    <div style="margin-bottom:12px">
      <label style="color:#94A3B8;font-size:12px;display:block;margin-bottom:4px">Email</label>
      <input id="edit-user-email" value="${user.email}" style="width:100%;padding:10px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:14px" data-testid="edit-user-email">
    </div>
    <div style="margin-bottom:12px;display:flex;gap:12px;font-size:13px;color:#94A3B8">
      <div><strong>Registrato:</strong> ${user.created_at ? new Date(user.created_at).toLocaleString('it') : '-'}</div>
      <div><strong>Ultimo login:</strong> ${user.last_login ? new Date(user.last_login).toLocaleString('it') : 'Mai'}</div>
    </div>
    <div id="reset-link-result"></div>
    <div class="modal-actions" style="justify-content:space-between">
      <div>
        ${!isGoogle ? `<button class="btn btn-sm" style="background:#7C3AED;color:#fff" onclick="doGenerateResetLink('${userId}')" data-testid="generate-reset-link-btn">Genera Link Reset Password</button>` : ''}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="closeModal()">Annulla</button>
        <button class="btn" onclick="doEditUser('${userId}')" data-testid="confirm-edit-user-btn">Salva Modifiche</button>
      </div>
    </div>`;
  showModal(html);
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
    closeModal();
    showToast('Utente aggiornato');
    render_users();
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
  el.innerHTML = '<h2>Giornate</h2><div id="md-form" class="card"></div><div id="md-filter" class="card"></div><div id="md-list"></div>';
  const seasons = await apiCall('/admin/seasons');
  const opts = seasons.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('md-form').innerHTML = `
    <div class="form-row">
      <select id="md-season">${opts}</select>
      <input id="md-num" type="number" placeholder="Numero" min="1">
      <input id="md-label" placeholder="Etichetta">
      <select id="md-half"><option value="1">Andata</option><option value="2">Ritorno</option></select>
      <input id="md-kickoff" type="datetime-local">
      <button class="btn" onclick="createMatchday()">Crea</button>
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
  const mds = await apiCall('/admin/matchdays' + (seasons[0] ? '?season_id='+seasons[0].id : ''));
  window._allMatchdays = mds;
  filterMatchdays();
}

function filterMatchdays() {
  const sf = document.getElementById('md-status-filter').value;
  let mds = window._allMatchdays || [];
  if (sf) mds = mds.filter(m => m.status === sf);
  let html = '<table><tr><th>#</th><th>Etichetta</th><th>Meta</th><th>Kickoff</th><th>Stato</th><th>Azioni</th></tr>';
  mds.forEach(m => {
    html += `<tr><td>${m.number}</td><td>${m.label||''}</td><td>${m.half==1?'Andata':'Ritorno'}</td>
    <td>${new Date(m.first_kickoff).toLocaleString('it')}</td>
    <td><span class="status-badge status-${m.status}">${m.status}</span></td>
    <td>
      <button class="btn btn-sm" onclick="setMdStatus('${m.id}','OPEN')">OPEN</button>
      <button class="btn btn-sm" onclick="setMdStatus('${m.id}','LOCKED')">LOCK</button>
      <button class="btn btn-sm" onclick="setMdStatus('${m.id}','LIVE')">LIVE</button>
      <button class="btn btn-sm" onclick="confirmMatchday('${m.id}')">CONFIRM</button>
    </td></tr>`;
  });
  html += '</table>';
  document.getElementById('md-list').innerHTML = html;
}

async function createMatchday() {
  try {
    const kickoff = document.getElementById('md-kickoff').value;
    await apiCall('/admin/matchdays', 'POST', {
      season_id: document.getElementById('md-season').value,
      number: parseInt(document.getElementById('md-num').value),
      label: document.getElementById('md-label').value,
      half: parseInt(document.getElementById('md-half').value),
      first_kickoff: new Date(kickoff).toISOString(),
      status: 'OPEN'
    });
    showToast('Giornata creata'); render_matchdays();
  } catch(e) { showToast(e.message, 'error'); }
}

async function setMdStatus(id, status) {
  await apiCall('/admin/matchdays/'+id, 'PUT', {status});
  showToast('Stato aggiornato: '+status); render_matchdays();
}

async function confirmMatchday(id) {
  if(!confirm('Confermare giornata? Verranno calcolati i punteggi.')) return;
  try {
    const r = await apiCall('/admin/matchdays/'+id+'/confirm', 'POST');
    showToast('Giornata confermata: '+r.users_scored+' utenti'); render_matchdays();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// MATCHES (existing)
// ========================================
let selectedMatchday = null;
async function render_matches() {
  if (!hasPerm('admin.matches.manage')) { render_forbidden(); return; }
  const el = document.getElementById('content');
  const mds = await apiCall('/admin/matchdays');
  const opts = mds.map(m => `<option value="${m.id}">G${m.number} - ${m.label||''} (${m.status})</option>`).join('');
  el.innerHTML = `<h2>Partite</h2>
    <div class="card"><div class="form-row">
      <select id="match-md" onchange="loadMatches()">${opts}</select>
    </div></div>
    <div id="match-form" class="card" style="display:none"></div>
    <div id="match-list"></div>`;
  if(mds.length) { selectedMatchday = mds[0].id; loadMatches(); }
}

async function loadMatches() {
  selectedMatchday = document.getElementById('match-md').value;
  const markets = ['1X2','GOAL_NOGOL','OVER_UNDER_25','EXACT_SCORE'];
  document.getElementById('match-form').style.display = 'block';
  document.getElementById('match-form').innerHTML = `
    <div class="form-row">
      <input id="m-home" placeholder="Squadra casa">
      <input id="m-away" placeholder="Squadra ospite">
      <input id="m-comp" placeholder="Competizione">
      <select id="m-market">${markets.map(m=>`<option value="${m}">${m}</option>`).join('')}</select>
      <input id="m-time" type="datetime-local">
      <button class="btn" onclick="createMatch()">Aggiungi</button>
    </div>`;
  const matches = await apiCall('/admin/matches?matchday_id='+selectedMatchday);
  let html = '<table><tr><th>Casa</th><th>Ospite</th><th>Comp</th><th>Mercato</th><th>Orario</th><th>Score</th><th>Stato</th><th>Azioni</th></tr>';
  matches.forEach(m => {
    const score = m.home_score !== null ? `${m.home_score}-${m.away_score}` : '-';
    html += `<tr>
      <td>${m.home_team}</td><td>${m.away_team}</td><td>${m.competition}</td><td>${m.market_type}</td>
      <td>${new Date(m.start_time).toLocaleString('it')}</td>
      <td><strong>${score}</strong></td>
      <td><span class="status-badge status-${m.status}">${m.status}</span></td>
      <td>
        <button class="btn btn-sm" onclick="showLiveUpdate('${m.id}','${m.home_team}','${m.away_team}',${m.home_score||0},${m.away_score||0})">Update</button>
      </td></tr>`;
  });
  html += '</table>';
  html += '<div id="live-update-panel"></div>';
  document.getElementById('match-list').innerHTML = html;
}

async function createMatch() {
  try {
    await apiCall('/admin/matches', 'POST', {
      matchday_id: selectedMatchday,
      home_team: document.getElementById('m-home').value,
      away_team: document.getElementById('m-away').value,
      competition: document.getElementById('m-comp').value,
      market_type: document.getElementById('m-market').value,
      start_time: new Date(document.getElementById('m-time').value).toISOString(),
      status: 'scheduled'
    });
    showToast('Partita aggiunta'); loadMatches();
  } catch(e) { showToast(e.message, 'error'); }
}

function showLiveUpdate(id, home, away, hs, as) {
  document.getElementById('live-update-panel').innerHTML = `
  <div class="card"><h3 style="color:#F5A623;margin-bottom:12px">${home} vs ${away}</h3>
    <div class="form-row">
      <input id="lu-hs" type="number" value="${hs}" min="0" placeholder="Gol casa" style="width:80px">
      <input id="lu-as" type="number" value="${as}" min="0" placeholder="Gol ospite" style="width:80px">
      <select id="lu-status"><option value="live">Live</option><option value="finished">Finished</option>
        <option value="postponed">Postponed</option><option value="void">Void</option></select>
      <button class="btn" onclick="doLiveUpdate('${id}')">Salva</button>
    </div>
  </div>`;
}

async function doLiveUpdate(id) {
  try {
    await apiCall('/admin/matches/'+id+'/live-update', 'POST', {
      match_id: id,
      home_score: parseInt(document.getElementById('lu-hs').value),
      away_score: parseInt(document.getElementById('lu-as').value),
      status: document.getElementById('lu-status').value
    });
    showToast('Match aggiornato'); loadMatches();
  } catch(e) { showToast(e.message, 'error'); }
}

// ========================================
// LEAGUES (enhanced with admin management)
// ========================================
let allLeaguesCache = [];

async function render_leagues() {
  if (!hasPerm('admin.leagues.manage')) { render_forbidden(); return; }
  const riskFilter = navFilter.risk || '';
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
        <select id="league-risk-filter" onchange="filterLeagues()" style="flex:1" data-testid="league-risk-filter">
          <option value="">Tutte le leghe</option>
          <option value="all" ${riskFilter?'selected':''}>A Rischio (tutte)</option>
          <option value="no_owner" ${riskFilter==='no_owner'?'selected':''}>Senza Owner</option>
          <option value="no_admin" ${riskFilter==='no_admin'?'selected':''}>Senza Admin</option>
        </select>
      </div>`;

    filterLeagues();
  } catch(e) { showToast(e.message, 'error'); }
}

function filterLeagues() {
  const q = (document.getElementById('league-search').value || '').toLowerCase();
  const rf = document.getElementById('league-risk-filter').value;
  let filtered = allLeaguesCache;
  if (q) filtered = filtered.filter(l => l.name.toLowerCase().includes(q));
  if (rf === 'all') filtered = filtered.filter(l => !l.owner || (l.admins && l.admins.length === 0));
  else if (rf === 'no_owner') filtered = filtered.filter(l => !l.owner);
  else if (rf === 'no_admin') filtered = filtered.filter(l => !l.admins || l.admins.length === 0);
  renderLeaguesTable(filtered);
}

function renderLeaguesTable(leagues) {
  let html = '<table><tr><th>Nome</th><th>Tipo</th><th>Codice</th><th>Owner</th><th>Admin</th><th>Membri</th><th>Azioni</th></tr>';
  leagues.forEach(l => {
    const ownerName = l.owner ? `<strong>${l.owner.username}</strong>` : '<span style="color:#EF4444">Nessuno</span>';
    const adminCount = l.admins ? l.admins.length : 0;
    const typeBadge = l.league_type === 'national'
      ? '<span class="status-badge status-LIVE">NAZIONALE</span>'
      : '<span class="status-badge status-OPEN">PRIVATA</span>';

    html += `<tr data-testid="league-row-${l.id}">
      <td><strong>${l.name}</strong></td>
      <td>${typeBadge}</td>
      <td style="font-size:12px;color:#94A3B8">${l.invite_code||'-'}</td>
      <td>${ownerName}</td>
      <td><span style="cursor:pointer;color:#F5A623" onclick="showLeagueAdmins('${l.id}')">${adminCount} admin</span></td>
      <td>${l.member_count}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="showLeagueManage('${l.id}')" data-testid="manage-league-${l.id}">Gestisci</button>
      </td></tr>`;
  });
  html += '</table>';
  document.getElementById('leagues-list').innerHTML = html;
}

function showLeagueAdmins(leagueId) {
  const league = allLeaguesCache.find(l => l.id === leagueId);
  if (!league) return;
  let html = `<h3>Admin di: ${league.name}</h3>`;
  if (league.owner) {
    html += `<div style="margin:12px 0"><span class="tag tag-super">OWNER</span> <strong>${league.owner.username}</strong> <span style="color:#64748B">(${league.owner.email})</span></div>`;
  }
  if (league.admins && league.admins.length > 0) {
    html += '<table><tr><th>Username</th><th>Email</th><th>Ruolo</th></tr>';
    league.admins.forEach(a => {
      html += `<tr><td><strong>${a.username}</strong></td><td style="color:#94A3B8">${a.email}</td><td><span class="tag tag-role">${a.role}</span></td></tr>`;
    });
    html += '</table>';
  } else {
    html += '<p style="color:#94A3B8">Nessun admin</p>';
  }
  html += '<div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Chiudi</button></div>';
  showModal(html);
}

async function showLeagueManage(leagueId) {
  const league = allLeaguesCache.find(l => l.id === leagueId);
  if (!league) return;

  try {
    const members = await apiCall('/rbac/leagues/' + leagueId + '/members');
    let html = `<h3>Gestisci: ${league.name}</h3>`;

    // Owner section
    html += '<div style="margin:12px 0"><strong style="color:#F5A623">Owner:</strong> ';
    if (league.owner) {
      html += `${league.owner.username} (${league.owner.email})`;
    } else {
      html += '<span style="color:#EF4444">Nessun owner</span>';
    }
    html += '</div>';

    // Transfer ownership
    html += '<div style="margin:12px 0"><strong style="color:#94A3B8">Trasferisci Ownership:</strong>';
    html += `<select id="new-owner-select" style="margin-left:8px;padding:6px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9">`;
    html += '<option value="">-- Seleziona nuovo owner --</option>';
    members.filter(m => !m.is_owner).forEach(m => {
      html += `<option value="${m.user_id}">${m.username} (${m.email}) [${m.role}]</option>`;
    });
    html += '</select>';
    html += ` <button class="btn btn-sm" onclick="doTransferOwner('${leagueId}')" data-testid="transfer-owner-btn">Trasferisci</button></div>`;

    // Members table with admin toggle
    html += '<h4 style="color:#94A3B8;margin:16px 0 8px">Membri (' + members.length + ')</h4>';
    html += '<table><tr><th>Username</th><th>Email</th><th>Ruolo</th><th>Azioni</th></tr>';
    members.forEach(m => {
      const isOwner = m.is_owner;
      const isAdmin = m.role === 'admin' || m.role === 'owner';
      let actionBtn = '';
      if (isOwner) {
        actionBtn = '<span class="tag tag-super">OWNER</span>';
      } else if (isAdmin) {
        actionBtn = `<button class="btn btn-sm btn-danger" onclick="toggleLeagueAdmin('${leagueId}','${m.user_id}','remove')">Rimuovi Admin</button>`;
      } else {
        actionBtn = `<button class="btn btn-sm btn-outline" onclick="toggleLeagueAdmin('${leagueId}','${m.user_id}','add')">Promuovi Admin</button>`;
      }
      html += `<tr>
        <td><strong>${m.username}</strong></td>
        <td style="color:#94A3B8;font-size:12px">${m.email}</td>
        <td><span class="tag tag-role">${m.role}</span></td>
        <td>${actionBtn}</td></tr>`;
    });
    html += '</table>';
    html += '<div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Chiudi</button></div>';
    showModal(html);
  } catch(e) { showToast(e.message, 'error'); }
}

async function doTransferOwner(leagueId) {
  const newOwnerId = document.getElementById('new-owner-select').value;
  if (!newOwnerId) { showToast('Seleziona un nuovo owner', 'error'); return; }
  if (!confirm('Confermi il trasferimento della ownership?')) return;
  try {
    await apiCall('/rbac/leagues/' + leagueId + '/transfer-owner', 'PUT', {new_owner_id: newOwnerId});
    closeModal(); showToast('Ownership trasferita'); render_leagues();
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleLeagueAdmin(leagueId, userId, action) {
  const verb = action === 'add' ? 'promuovere ad admin' : 'rimuovere da admin';
  if (!confirm(`Vuoi ${verb} questo utente?`)) return;
  try {
    await apiCall('/rbac/leagues/' + leagueId + '/admins', 'PUT', {user_id: userId, action: action});
    showToast('Ruolo aggiornato');
    showLeagueManage(leagueId);
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
