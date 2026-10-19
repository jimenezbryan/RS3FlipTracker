/**
 * Replays the detector over the last 7 days for ~200 liquid items using their real daily
 * history, and prints how many would have alerted per day. Manual: it calls the live APIs.
 * Run: npx tsx scripts/report-out-of-range.ts
 *
 * Daily guide prices have one point per day, so each day D is judged as "price on D vs the
 * 30 days before D". That under-counts intraday spikes (no hourly history this far back), so
 * treat the number as a floor and tune the constants in shared/outOfRange.ts accordingly.
 */
import { getAllItemsForScanner, getItemPriceHistoryFull } from "../server/ge-api";
import { SPIKE_MULT, DUMP_MULT, MIN_BASELINE_POINTS } from "../shared/outOfRange";

const D = 86_400_000;
const items = (await getAllItemsForScanner())
  .filter((i) => i.volume >= i.geLimit && i.hourVolume > 0)
  .sort((a, b) => b.volume * b.sellPrice - a.volume * a.sellPrice)
  .slice(0, 200);

const perDay = new Array<number>(7).fill(0);
for (const item of items) {
  const full = await getItemPriceHistoryFull(item.id);
  if (!full) continue;
  const daily = full.daily.map((p) => ({ t: new Date(p.date).getTime(), price: p.price }));
  const now = Date.now();
  for (let back = 0; back < 7; back++) {
    const dayStart = now - (back + 1) * D;
    const today = daily.filter((p) => p.t >= dayStart && p.t < dayStart + D).map((p) => p.price);
    const base = daily.filter((p) => p.t < dayStart && p.t >= dayStart - 30 * D).map((p) => p.price);
    if (today.length === 0 || base.length < MIN_BASELINE_POINTS) continue;
    if (Math.max(...today) >= Math.max(...base) * SPIKE_MULT || Math.min(...today) <= Math.min(...base) * DUMP_MULT) perDay[back]++;
  }
}
console.log(`sampled ${items.length} items; SPIKE_MULT=${SPIKE_MULT} DUMP_MULT=${DUMP_MULT}`);
perDay.forEach((n, i) => console.log(`${i + 1} day(s) ago: ${n} would alert`));
console.log(`average: ${(perDay.reduce((a, b) => a + b, 0) / 7).toFixed(1)} per day (target 5-15 across the market)`);
