// Compatibility layer over the canonical tracker in `tracking.ts`.
//
// The pages already call trackDownload()/trackPageview(); rather than editing
// every call site (and risking a regression on a live funnel) these keep working
// and simply forward to the new taxonomy. New code should import from
// "@/lib/tracking" directly and pass a cta_placement.

import { trackPageview as trackPageviewCanonical, trackStoreClick } from "@/lib/tracking";

export type DownloadEvent = "click_appstore" | "click_googleplay";

export { getAnonymousId, getCreator, trackEvent } from "@/lib/tracking";

/** Records a store button click. Kept for existing call sites. */
export function trackDownload(event: DownloadEvent, placement?: string) {
  trackStoreClick(event === "click_appstore" ? "apple" : "google", placement);
}

/** Records a page view. Kept for existing call sites. */
export function trackPageview() {
  trackPageviewCanonical();
}
