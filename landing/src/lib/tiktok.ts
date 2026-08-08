// TikTok Pixel — wrapper unico per gli eventi browser-side.
//
// Il base code (ttq.load) sta in index.html ed e' caricato una sola volta per
// sessione del browser. Qui ci sono solo le chiamate: cosi' il pixel non viene
// mai reinizializzato ai cambi di rotta della SPA.
//
// PageView non e' nel base code: lo emette RouteTracker a ogni cambio rotta,
// prima pagina inclusa. Se lo lasciassimo anche in index.html il primo
// caricamento ne conterebbe due.

/** ID preso dal base code di TikTok Ads Manager. */
export const TIKTOK_PIXEL_ID = "D9RLTG3C77U97D5QFCC0";

type Ttq = {
  page: (...a: unknown[]) => void;
  track: (event: string, props?: Record<string, unknown>, opts?: Record<string, unknown>) => void;
};

function ttq(): Ttq | null {
  const w = window as unknown as { ttq?: Ttq };
  return w.ttq ?? null;   // assente se lo script e' bloccato da un ad blocker
}

/**
 * Identificativo dell'evento, per la deduplicazione quando lo stesso fatto
 * arriva a TikTok sia dal browser sia dalla Events API: se i due invii
 * condividono l'event_id, TikTok li conta una volta sola.
 */
export function newEventId(): string {
  try {
    if (window.crypto && "randomUUID" in window.crypto) return window.crypto.randomUUID();
  } catch {
    /* browser vecchi: si ripiega sotto */
  }
  return `tt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** PageView. Da chiamare a ogni cambio rotta, non solo al primo caricamento. */
export function tiktokPageView(): void {
  ttq()?.page();
}

/**
 * Evento standard TikTok. Ritorna l'event_id usato, cosi' chi chiama puo'
 * conservarlo e passarlo poi alla Events API per la deduplicazione.
 */
export function tiktokTrack(
  event: string,
  properties: Record<string, unknown> = {},
  eventId: string = newEventId(),
): string {
  ttq()?.track(event, properties, { event_id: eventId });
  return eventId;
}
