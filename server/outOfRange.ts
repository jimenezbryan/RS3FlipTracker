/**
 * Out-of-range detection over the live market, shared by the cron alert and the Scanner's
 * badge endpoint so the two can never disagree about what is out of range.
 *
 * Cost shape: one bulk screen over ~2200 items (already fetched by getAllItemsForScanner),
 * then history for at most MAX_CANDIDATES survivors. History calls are cached upstream.
 */
import { getAllItemsForScanner, getItemIntraday, getItemPriceHistoryFull, getLatest, getPriceAnchors } from "./ge-api";
import { storage } from "./storage";
import { sendOutOfRangeAlertsToDiscord } from "./discord";
import {
  detectOutOfRange, screenCandidates, isCoolingDown,
  type DailyPoint, type Direction, type HourlyPoint,
} from "@shared/outOfRange";
import type { EmbedHit } from "@shared/outOfRangeEmbed";
import type { ScannerItem } from "@shared/scannerPipeline";

export type OutOfRangeHit = EmbedHit;
export const MAX_EMBEDS_PER_TICK = 5;
const SUMMARY_TTL_MS = 5 * 60 * 1000;
const CONCURRENCY = 5;

export interface OutOfRangeSummary {
  itemId: number;
  direction: Direction;
  extreme: number;
  normalLow: number;
  normalHigh: number;
  pctBeyond: number;
}

async function inChunks<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < xs.length; i += n) out.push(...(await Promise.all(xs.slice(i, i + n).map(fn))));
  return out;
}

export async function findOutOfRange(items: ScannerItem[], nowMs = Date.now()): Promise<OutOfRangeHit[]> {
  const [anchors, latestAll] = await Promise.all([getPriceAnchors(), getLatest()]);
  const ids = screenCandidates(items, anchors);
  const byId = new Map(items.map((i) => [i.id, i]));

  const hits = await inChunks(ids, CONCURRENCY, async (id): Promise<OutOfRangeHit | null> => {
    const item = byId.get(id);
    const quote = latestAll[String(id)];
    if (!item || !quote) return null;
    try {
      const [week, full] = await Promise.all([getItemIntraday(id, 24 * 7), getItemPriceHistoryFull(id)]);
      if (!week || !full) return null;
      const series7d: HourlyPoint[] = week.map((p) => ({ t: new Date(p.date).getTime(), high: p.high ?? null, low: p.low ?? null }));
      const hourly24h = series7d.filter((p) => p.t >= nowMs - 24 * 3_600_000);
      const daily: DailyPoint[] = full.daily.map((p) => ({ t: new Date(p.date).getTime(), price: p.price }));
      const detection = detectOutOfRange(hourly24h, daily, { high: quote.high, low: quote.low }, nowMs);
      if (!detection) return null;
      return {
        itemId: id, name: item.name, icon: item.icon, geLimit: item.geLimit, volume: item.volume, margin: item.margin,
        detection, latest: quote, series7d,
      };
    } catch (error) {
      // One bad history fetch must not hide the other candidates.
      console.error(`[outOfRange] ${id} failed:`, error);
      return null;
    }
  });
  return hits.filter((h): h is OutOfRangeHit => h !== null).sort((a, b) => b.detection.pctBeyond - a.detection.pctBeyond);
}

let summaryCache: { at: number; rows: OutOfRangeSummary[] } | null = null;

/** What the Scanner shows: the same detection, trimmed to what a badge needs, cached 5 min. */
export async function getOutOfRangeSummary(): Promise<OutOfRangeSummary[]> {
  if (summaryCache && Date.now() - summaryCache.at < SUMMARY_TTL_MS) return summaryCache.rows;
  const hits = await findOutOfRange(await getAllItemsForScanner());
  const rows = hits.map((h) => ({
    itemId: h.itemId, direction: h.detection.direction, extreme: h.detection.extreme,
    normalLow: h.detection.normalLow, normalHigh: h.detection.normalHigh, pctBeyond: h.detection.pctBeyond,
  }));
  summaryCache = { at: Date.now(), rows };
  return rows;
}

/** The cron step. Returns what happened so the cron response (and the Actions log) shows it. */
export async function runOutOfRangeAlerts(now = new Date()): Promise<{ found: number; sent: number; error?: string }> {
  // Fail closed: without the cooldown we would repeat every alert every 15 minutes.
  let cooldowns;
  try {
    cooldowns = await storage.getOutOfRangeCooldowns();
  } catch (error) {
    console.error("[outOfRange] cooldown read failed, sending nothing:", error);
    return { found: 0, sent: 0, error: "cooldown read failed" };
  }
  const cool = new Map(cooldowns.map((c) => [`${c.itemId}:${c.direction}`, c]));

  const hits = await findOutOfRange(await getAllItemsForScanner(), now.getTime());
  const fresh = hits.filter((h) => {
    const price = h.detection.direction === "spike" ? h.latest.high : h.latest.low;
    return price != null && !isCoolingDown(cool.get(`${h.itemId}:${h.detection.direction}`), h.detection.direction, price, now.getTime());
  });
  const batch = fresh.slice(0, MAX_EMBEDS_PER_TICK);
  if (batch.length === 0) return { found: hits.length, sent: 0 };

  // Awaited on purpose: Vercel freezes the function once the response flushes.
  const ok = await sendOutOfRangeAlertsToDiscord(batch);
  if (!ok) return { found: hits.length, sent: 0 };
  try {
    await storage.markOutOfRangeAlerted(
      batch.map((h) => ({ itemId: h.itemId, direction: h.detection.direction, price: (h.detection.direction === "spike" ? h.latest.high : h.latest.low)! })),
      now,
    );
  } catch (error) {
    // Sent but not recorded: the next tick may repeat it once. Loud, because it means the table is unwritable.
    console.error("[outOfRange] cooldown write failed after send:", error);
  }
  return { found: hits.length, sent: batch.length };
}
