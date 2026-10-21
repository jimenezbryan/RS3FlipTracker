// The move-to-Lovable announcement. Driven by the MOVE_AT setting (env var) so scheduling
// or cancelling the banner is a settings change, not a code change.
export const NEW_APP_URL = "https://rs3-flip-tracker.lovable.app";

export type MoveNotice = { moveAt: string; newUrl: string };

// MOVE_AT must carry its zone (e.g. 2026-10-28T20:00:00-04:00); without one the server's
// UTC clock would pick the hour. Unset, blank or unreadable → no banner.
export function moveNotice(raw: string | undefined): MoveNotice | null {
  const value = raw?.trim();
  if (!value || !/(Z|[+-]\d\d:?\d\d)$/i.test(value)) return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return { moveAt: at.toISOString(), newUrl: NEW_APP_URL };
}
