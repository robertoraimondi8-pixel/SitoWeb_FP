import type { Router } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Central routing logic for "Predictions Hub".
 * Used by both the Home CTA button and the Predictions tab.
 *
 * Rules:
 *   OPEN    → predictions form (edit)
 *   LOCKED  → predictions read-only
 *   LIVE    → live screen
 *   COMPLETED → results (live) screen
 *   no matchday → stays on predictions (empty state shown there)
 */
export function goToPredictionsHub(
  router: Router,
  status: string | undefined | null,
  matchdayId: string | undefined | null,
  leagueId: string | undefined | null,
) {
  if (!matchdayId) return; // empty-state handled by predictions screen

  const s = status?.toUpperCase();

  if (s === 'LIVE' || s === 'COMPLETED') {
    const qs = leagueId ? `?league_id=${leagueId}` : '';
    router.push(`/live/${matchdayId}${qs}` as Href);
  } else {
    // OPEN / LOCKED / default → predictions tab
    const qs = leagueId
      ? `?league_id=${leagueId}&matchday_id=${matchdayId}`
      : `?matchday_id=${matchdayId}`;
    router.push(`/(tabs)/predictions${qs}` as Href);
  }
}
