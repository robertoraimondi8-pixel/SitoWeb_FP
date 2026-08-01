// Site-side event collection.
//
// Sends events to the internal analytics API with sendBeacon so nothing ever
// blocks navigation (critical: store clicks fire immediately before a redirect).
//
// Identity model
//   anonymous_id  persistent per browser  -> counts unique PEOPLE
//   session_id    per tab/session         -> counts sessions
//   first-touch   first campaign ever seen -> never overwritten by later visits
//   last-touch    most recent campaign
// No personal data is collected: the ids are random and meaningless on their own.

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL || "https://api.fantapronostic.com";

const TRACK_URL = `${BACKEND_URL}/api/analytics/track`;

// Canonical taxonomy — must match backend analytics_core.WEB_EVENTS.
export type WebEvent =
  | "landing_view"
  | "store_cta_click"
  | "deeplink_click"
  | "preregistration_started"
  | "preregistration_completed"
  | "checkout_started"
  | "checkout_redirected"
  | "newsletter_signup"
  | "faq_opened"
  | "rules_opened";

const KEY_ANON = "fp_vid";            // reuses the existing key: no identity reset
const KEY_SESSION = "fp_session_id";
const KEY_FIRST = "fp_first_touch";
const KEY_LAST = "fp_last_touch";
const KEY_CREATOR = "fp_creator";

type Touch = {
  creator?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  at?: string;
};

function uuid(): string {
  try {
    if (window.crypto && "randomUUID" in window.crypto) return window.crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(store: Storage | undefined, key: string, value: string) {
  try {
    store?.setItem(key, value);
  } catch {
    /* private mode: tracking degrades, the site keeps working */
  }
}

export function getAnonymousId(): string | null {
  let id = safeGet(localStorage, KEY_ANON);
  if (!id) {
    id = uuid();
    safeSet(localStorage, KEY_ANON, id);
  }
  return id;
}

function getSessionId(): string | null {
  let id = safeGet(sessionStorage, KEY_SESSION);
  if (!id) {
    id = uuid();
    safeSet(sessionStorage, KEY_SESSION, id);
  }
  return id;
}

/** Read campaign parameters from the current URL. */
function urlTouch(): Touch {
  const p = new URLSearchParams(window.location.search);
  const clean = (v: string | null) => (v ? v.trim().slice(0, 120) : null);
  return {
    creator: clean(p.get("creator"))?.toLowerCase() ?? null,
    utm_source: clean(p.get("utm_source")),
    utm_medium: clean(p.get("utm_medium")),
    utm_campaign: clean(p.get("utm_campaign")),
    utm_content: clean(p.get("utm_content")),
    utm_term: clean(p.get("utm_term")),
  };
}

function hasSignal(t: Touch): boolean {
  return Boolean(t.creator || t.utm_source || t.utm_campaign);
}

/**
 * Persist attribution. First-touch is written once and never overwritten, so a
 * later direct visit cannot steal a creator's credit.
 */
export function captureAttribution(): { first: Touch; last: Touch } {
  const current = urlTouch();
  if (hasSignal(current)) {
    const stamped = { ...current, at: new Date().toISOString() };
    if (!safeGet(localStorage, KEY_FIRST)) {
      safeSet(localStorage, KEY_FIRST, JSON.stringify(stamped));
    }
    safeSet(localStorage, KEY_LAST, JSON.stringify(stamped));
    if (current.creator) safeSet(sessionStorage, KEY_CREATOR, current.creator);
  }
  const parse = (raw: string | null): Touch => {
    try {
      return raw ? (JSON.parse(raw) as Touch) : {};
    } catch {
      return {};
    }
  };
  return { first: parse(safeGet(localStorage, KEY_FIRST)), last: parse(safeGet(localStorage, KEY_LAST)) };
}

/** Creator attributed to this visitor (URL, then session, then first touch). */
export function getCreator(): string | null {
  const { first, last } = captureAttribution();
  return last.creator || safeGet(sessionStorage, KEY_CREATOR) || first.creator || null;
}

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

/** Which product the current page belongs to, for cross-league segmentation. */
function detectProject(path = window.location.pathname): string | null {
  if (/^\/community/i.test(path)) return "community";
  if (/^\/(lega|super-league)/i.test(path)) return "superleague";
  return null;
}

export type TrackOptions = {
  store?: "apple" | "google";
  cta_placement?: string;
  project_type?: string;
  league_id?: string;
  /**
   * Captain the user picked inside the league. This is NOT the creator who sent
   * the visit — that one comes from the URL and is sent as `creator`. Keeping
   * the two apart avoids crediting an acquisition that never happened.
   */
  selected_creator?: string;
  meta?: Record<string, unknown>;
};

export function trackEvent(event: WebEvent, options: TrackOptions = {}) {
  try {
    const ua = navigator.userAgent || "";
    const { first, last } = captureAttribution();
    const payload = {
      event,
      event_id: uuid(),                       // makes retried beacons idempotent
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      project_type: options.project_type ?? detectProject(),
      league_id: options.league_id ?? null,
      creator: last.creator || first.creator || null,   // acquisition creator
      selected_creator: options.selected_creator ?? null,
      utm_source: last.utm_source ?? null,
      utm_medium: last.utm_medium ?? null,
      utm_campaign: last.utm_campaign ?? null,
      utm_content: last.utm_content ?? null,
      utm_term: last.utm_term ?? null,
      referrer: document.referrer || null,
      page: window.location.pathname + window.location.search,
      device: detectDevice(ua),
      os: detectOs(ua),
      store: options.store ?? null,
      cta_placement: options.cta_placement ?? null,
      language: (navigator.language || "").slice(0, 12) || null,
      user_agent: ua,
      meta: options.meta ?? null,
    };

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_URL, new Blob([body], { type: "application/json" }));
    } else {
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics must never break navigation or a store redirect.
  }
}

/** Page view. Internal admin pages are never counted as audience. */
export function trackPageview() {
  if (/^\/(admin|login)/i.test(window.location.pathname)) return;
  trackEvent("landing_view");
}

/** Store CTA click. Fires before the redirect; `placement` tells CTAs apart. */
export function trackStoreClick(store: "apple" | "google", placement?: string) {
  trackEvent("store_cta_click", { store, cta_placement: placement });
}
