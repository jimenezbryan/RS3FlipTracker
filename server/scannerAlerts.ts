/**
 * Evaluates saved Scanner presets on a schedule and posts the result to Discord.
 *
 * Driven from outside: `POST /api/cron/alerts` (GitHub Actions, every 15 min — Vercel Hobby
 * crons run once a day). Nothing here keeps time; each preset stores its own interval and
 * lastRunAt, and storage.getDueAlertPresets picks the ones whose interval has elapsed.
 */
import { storage } from "./storage";
import { getAllItemsForScanner } from "./ge-api";
import { sendScannerAlertToDiscord } from "./discord";
import { runPreset, pickItems, type ScannerItem } from "@shared/scannerPipeline";
import type { ScannerPreset } from "@shared/schema";

async function favoritesFor(preset: ScannerPreset): Promise<Set<number>> {
  if (!preset.filters.watchlistOnly) return new Set();
  const favs = await storage.getFavorites(preset.userId);
  return new Set(favs.map((f) => f.itemId));
}

/** Runs one preset against `items` and posts. Returns whether a message went out. */
export async function runPresetNow(
  preset: ScannerPreset,
  items: ScannerItem[],
  now: Date,
  opts: { force?: boolean } = {},
): Promise<{ sent: boolean; matched: number }> {
  const results = runPreset(items, preset.filters, await favoritesFor(preset));
  const pick = pickItems(preset, results, opts);
  let sent = false;
  if (pick) {
    // Awaited on purpose: Vercel freezes the function once the response flushes, and a
    // fire-and-forget post here would be lost the same way unsaved sessions were.
    sent = await sendScannerAlertToDiscord(preset.webhookUrl, preset.name, preset.mode as "new" | "summary", pick.items, pick.total);
  }
  await storage.markScannerPresetRun(preset.id, now, results.map((i) => i.id));
  return { sent, matched: results.length };
}

export async function runDueAlerts(now = new Date()) {
  const due = await storage.getDueAlertPresets(now);
  if (due.length === 0) return { ran: 0, sent: 0, errors: [] as string[] };

  // One market fetch for every preset; getAllItemsForScanner is the expensive call.
  const items = await getAllItemsForScanner();
  let sent = 0;
  const errors: string[] = [];
  for (const preset of due) {
    try {
      if ((await runPresetNow(preset, items, now)).sent) sent++;
    } catch (error) {
      // A dead webhook on one preset must not stop the others.
      errors.push(`${preset.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ran: due.length, sent, errors };
}
