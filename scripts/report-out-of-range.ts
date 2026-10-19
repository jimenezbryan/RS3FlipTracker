/**
 * Replays the REAL out-of-range detector over the last 7 days for ~200 liquid items and prints
 * how many would have alerted per day. Manual: it calls the live APIs, sequentially.
 * Run: npx tsx scripts/report-out-of-range.ts
 *
 * Each day D is judged exactly as production judges "now": that day's 24 wiki hourly points
 * against the Weird Gloop daily guide history, with the day's last hourly point as the latest
 * quote. Limits: the wiki keeps only 7 days of hourly history, and the sample is the 200 most
 * liquid items, not the whole market, so scale the per-day count rather than reading it as a total.
 * Use it to tune the constants in shared/outOfRange.ts.
 */
import { getAllItemsForScanner, getItemIntraday, getItemPriceHistoryFull } from "../server/ge-api";
import { detectOutOfRange, SPIKE_MULT, DUMP_MULT, type DailyPoint, type HourlyPoint } from "../shared/outOfRange";

const H = 3_600_000;
const items = (await getAllItemsForScanner())
  .filter((i) => i.volume >= i.geLimit && i.hourVolume > 0)
  .sort((a, b) => b.volume * b.sellPrice - a.volume * a.sellPrice)
  .slice(0, 200);

const perDay = new Array<number>(7).fill(0);
const now = Date.now();
for (const item of items) {
  const week = await getItemIntraday(item.id, 24 * 7);
  const full = await getItemPriceHistoryFull(item.id);
  if (!week || !full) continue;
  const hourly: HourlyPoint[] = week.map((p) => ({ t: new Date(p.date).getTime(), high: p.high ?? null, low: p.low ?? null }));
  const daily: DailyPoint[] = full.daily.map((p) => ({ t: new Date(p.date).getTime(), price: p.price }));
  for (let back = 0; back < 7; back++) {
    const end = now - back * 24 * H;
    const day = hourly.filter((p) => p.t > end - 24 * H && p.t <= end).sort((a, b) => a.t - b.t);
    const last = day[day.length - 1];
    if (!last) continue;
    if (detectOutOfRange(day, daily, { high: last.high, low: last.low }, end)) perDay[back]++;
  }
}
console.log(`sampled ${items.length} items; SPIKE_MULT=${SPIKE_MULT} DUMP_MULT=${DUMP_MULT}`);
perDay.forEach((n, i) => console.log(`${i + 1} day(s) ago: ${n} would alert`));
console.log(`average: ${(perDay.reduce((a, b) => a + b, 0) / 7).toFixed(1)} per day in the 200-item sample`);
