/**
 * Out-of-range price detection. Pure: numbers in, a verdict out, so
 * scripts/check-out-of-range.ts can exercise it offline. See CONTEXT.md for the terms
 * (Spike, Dump, Normal range).
 *
 * Buy side = what buyers paid (avgHighPrice, "insta buy"); sell side = what sellers got
 * (avgLowPrice, "insta sell"). A Spike is a buy-side price you could sell into; a Dump is a
 * sell-side price you could buy at.
 */

export const SPIKE_MULT = 1.25;
export const DUMP_MULT = 0.8;
/** Daily points the Normal range needs before it means anything. */
export const MIN_BASELINE_POINTS = 7;
/** Pre-screen: a 15% move against the 24h/7d-ago price. Looser than SPIKE_MULT on purpose —
 *  it is a cheap filter to pick who gets a history fetch, not the verdict. */
export const SCREEN_MOVE = 0.15;
export const MAX_CANDIDATES = 20;
/** Pre-screen floor (gp): below this a single gp is a big percentage, so cheap items are skipped. */
export const MIN_SCREEN_PRICE = 1000;
export const COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const COOLDOWN_BREAKOUT = 0.1;

const HOUR = 3_600_000;
const BASELINE_DAYS = 30;

export type Direction = "spike" | "dump";
export interface HourlyPoint { t: number; high: number | null; low: number | null }
export interface DailyPoint { t: number; price: number }
export interface LatestQuote { high: number | null; low: number | null }

export interface Detection {
  direction: Direction;
  extreme: number;
  normalLow: number;
  normalHigh: number;
  pctBeyond: number;
  avg12h: number | null;
  avg1h: number | null;
}

/** Mid of both sides where both traded, else whichever side did. Same rule as ge-api. */
function mid(p: HourlyPoint): number | null {
  if (p.high != null && p.low != null) return Math.round((p.high + p.low) / 2);
  return p.high ?? p.low;
}

export function detectOutOfRange(
  hourly24h: HourlyPoint[],
  daily: DailyPoint[],
  latest: LatestQuote,
  nowMs: number,
): Detection | null {
  const cutoff = nowMs - 24 * HOUR;
  const baseline = daily
    .filter((p) => p.t < cutoff && p.t >= cutoff - BASELINE_DAYS * 24 * HOUR && p.price > 0)
    .map((p) => p.price);
  if (baseline.length < MIN_BASELINE_POINTS) return null;
  const normalLow = Math.min(...baseline);
  const normalHigh = Math.max(...baseline);

  const highs = hourly24h.map((p) => p.high).filter((n): n is number => n != null);
  const lows = hourly24h.map((p) => p.low).filter((n): n is number => n != null);

  const newest = [...hourly24h].sort((a, b) => b.t - a.t)[0];
  const mids12h = hourly24h.filter((p) => p.t >= nowMs - 12 * HOUR).map(mid).filter((n): n is number => n != null);
  const avg12h = mids12h.length ? Math.round(mids12h.reduce((a, b) => a + b, 0) / mids12h.length) : null;
  const avg1h = newest ? mid(newest) : null;

  const out: Detection[] = [];
  const maxHigh = highs.length ? Math.max(...highs) : null;
  // "Still out of range": a spike that already fell back under the normal high has nothing
  // left to sell into, so the latest price must still be beyond the range.
  if (maxHigh != null && maxHigh >= normalHigh * SPIKE_MULT && latest.high != null && latest.high > normalHigh) {
    out.push({ direction: "spike", extreme: maxHigh, normalLow, normalHigh, pctBeyond: (maxHigh / normalHigh - 1) * 100, avg12h, avg1h });
  }
  const minLow = lows.length ? Math.min(...lows) : null;
  if (minLow != null && minLow <= normalLow * DUMP_MULT && latest.low != null && latest.low < normalLow) {
    out.push({ direction: "dump", extreme: minLow, normalLow, normalHigh, pctBeyond: (1 - minLow / normalLow) * 100, avg12h, avg1h });
  }
  if (out.length === 0) return null;
  return out.sort((a, b) => b.pctBeyond - a.pctBeyond)[0];
}

export interface ScreenItem {
  id: number;
  geLimit: number;
  volume: number;
  hourVolume: number;
  buyPrice: number;
  sellPrice: number;
}
export interface Anchors { d1: number | null; d7: number | null }

/** Ids worth a history fetch: liquid items whose price moved >= SCREEN_MOVE against an
 *  anchor, strongest move first, at most MAX_CANDIDATES. */
export function screenCandidates(items: ScreenItem[], anchors: Record<string, Anchors>): number[] {
  const scored: { id: number; move: number }[] = [];
  for (const it of items) {
    if (!(it.volume >= it.geLimit && it.hourVolume > 0)) continue;
    const a = anchors[String(it.id)];
    if (!a) continue;
    const refs = [a.d1, a.d7].filter((n): n is number => n != null && n > 0);
    if (refs.length === 0) continue;
    // Mid vs mid: comparing a high/low side to a mid would count half the spread as movement.
    const cur = (it.buyPrice + it.sellPrice) / 2;
    if (cur < MIN_SCREEN_PRICE) continue;
    const up = cur / Math.min(...refs) - 1;
    const down = 1 - cur / Math.max(...refs);
    const move = Math.max(up, down);
    if (move >= SCREEN_MOVE) scored.push({ id: it.id, move });
  }
  return scored.sort((a, b) => b.move - a.move).slice(0, MAX_CANDIDATES).map((s) => s.id);
}

export interface CooldownRow {
  itemId: number;
  direction: Direction;
  lastAlertAt: Date;
  lastPrice: number;
}

/** Quiet for COOLDOWN_MS after an alert, unless the price has gone a further
 *  COOLDOWN_BREAKOUT in the same direction. */
export function isCoolingDown(row: CooldownRow | undefined, direction: Direction, price: number, nowMs: number): boolean {
  if (!row) return false;
  if (nowMs - row.lastAlertAt.getTime() >= COOLDOWN_MS) return false;
  // Ratio, not price * (1 + x): 100e6 * 1.1 is 110000000.00000001 in floating point.
  const ratio = price / row.lastPrice;
  const broke = direction === "spike"
    ? ratio >= 1 + COOLDOWN_BREAKOUT
    : ratio <= 1 - COOLDOWN_BREAKOUT;
  return !broke;
}

/** Which hits go in this tick's message: not cooling, strongest first, at most `cap`. Hits cut
 *  by the cap are simply not returned, so the caller records no cooldown for them and they
 *  can post on a later tick. */
export function pickToSend<T extends { itemId: number; detection: { direction: Direction; pctBeyond: number }; latest: { high: number | null; low: number | null } }>(
  hits: T[],
  cooldowns: CooldownRow[],
  nowMs: number,
  cap: number,
): T[] {
  const cool = new Map(cooldowns.map((c) => [`${c.itemId}:${c.direction}`, c]));
  return hits
    .filter((h) => {
      const price = h.detection.direction === "spike" ? h.latest.high : h.latest.low;
      return price != null && !isCoolingDown(cool.get(`${h.itemId}:${h.detection.direction}`), h.detection.direction, price, nowMs);
    })
    .sort((a, b) => b.detection.pctBeyond - a.detection.pctBeyond)
    .slice(0, cap);
}
