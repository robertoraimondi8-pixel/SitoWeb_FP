// Tracciamento interno dei click sui pulsanti store (App Store / Google Play).
// Invia l'evento al backend PRIMA del redirect, senza bloccare la navigazione
// (usa navigator.sendBeacon, con fallback a fetch keepalive).

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL || "https://api.fantapronostic.com";

export type DownloadEvent = "click_appstore" | "click_googleplay";

function detectDevice(ua: string): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) ? "mobile" : "desktop";
}

function detectOs(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "other";
}

// Legge il creator da ?creator=... e lo memorizza per la sessione, così resta
// attribuito anche navigando tra le pagine della SPA.
function getCreator(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("creator");
    if (fromUrl) {
      const v = fromUrl.trim().toLowerCase();
      sessionStorage.setItem("fp_creator", v);
      return v;
    }
    return sessionStorage.getItem("fp_creator");
  } catch {
    return null;
  }
}

// Invia al backend un evento generico (usa sendBeacon, fire-and-forget).
function sendEvent(payload: Record<string, unknown>) {
  try {
    const url = `${BACKEND_URL}/api/analytics/track`;
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Il tracciamento non deve mai rompere la navigazione.
  }
}

// Registra una visita di pagina. Da chiamare ad ogni cambio route.
export function trackPageview() {
  try {
    const ua = navigator.userAgent || "";
    sendEvent({
      event: "pageview",
      creator: getCreator(),
      referrer: document.referrer || null,
      page: window.location.pathname + window.location.search,
      device: detectDevice(ua),
      os: detectOs(ua),
      user_agent: ua,
    });
  } catch {
    /* no-op */
  }
}

export function trackDownload(event: DownloadEvent) {
  try {
    const ua = navigator.userAgent || "";
    const payload = {
      event,
      creator: getCreator(),
      referrer: document.referrer || null,
      page: window.location.pathname + window.location.search,
      device: detectDevice(ua),
      os: detectOs(ua),
      user_agent: ua,
    };
    const url = `${BACKEND_URL}/api/analytics/track`;
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Il tracciamento non deve mai bloccare il redirect allo store.
  }
}
