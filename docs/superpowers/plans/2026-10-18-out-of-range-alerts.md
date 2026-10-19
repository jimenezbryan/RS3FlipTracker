# Out-of-range alerts, price display and account identification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Post Discord alerts when an item's price is far outside its normal range and still is, show the same signal in the Scanner and Log Flip, and make RS accounts easier to identify on flips.

**Architecture:** A pure detector in `shared/` (numbers in, detection out) is used by one server orchestrator (`server/outOfRange.ts`) that both the 15-minute cron and a cached Scanner endpoint call. The cron step sits next to, not inside, `runDueAlerts`. A new `out_of_range_alerts` table holds the cooldown. The embed builder is pure and lives in `shared/` so it can be checked offline.

**Tech Stack:** TypeScript, Express, drizzle-orm (Postgres), React + TanStack Query + wouter, assert-based `tsx` check scripts (no test framework in this repo), QuickChart for the chart image.

**Spec:** `docs/superpowers/specs/2026-10-18-out-of-range-alerts-design.md` (vocabulary in `CONTEXT.md`). Read both first.

## Global Constraints

- Spike threshold `SPIKE_MULT = 1.25` of Normal range high; Dump threshold `DUMP_MULT = 0.80` of Normal range low. Named constants, not settings.
- Normal range = daily low/high over the 30 days before the last 24 hours (the last 24h excluded).
- Spike uses the buy-side price (`avgHighPrice` / `/latest` `high`); Dump uses the sell-side price (`avgLowPrice` / `/latest` `low`). In `ScannerItem`, `sellPrice` is the high side and `buyPrice` is the low side (`margin = sellPrice - buyPrice`).
- Alert only while the latest price is still out of range (`latest.high > normalHigh` for a Spike, `latest.low < normalLow` for a Dump).
- Liquidity floor: `volume >= geLimit` and `hourVolume > 0`.
- At most 20 candidates get history fetched; at most 5 embeds per Discord message, one message per cron tick, ranked by percent beyond range.
- Cooldown: same item and direction suppressed for 6 hours unless the price moved a further 10% in that direction. Items cut by the 5-embed cap get no cooldown row.
- Fail closed: if the cooldown read fails, send nothing that tick and log the error.
- QuickChart URL must stay under 2000 characters; each series is downsampled to at most 40 points and thinned further (30, 20, 12) until the URL fits, else the embed posts without the image. If the chart is missing, the embed still posts.
- Every market price shown in the UI or in a Discord embed names its data source, using the labels in `shared/priceSources.ts` (single source of truth). Prices the user typed in (flip buy/sell, targets) are the user's own data and get no tag.
- Webhook is the global `DISCORD_WEBHOOK_URL`. No per-user or per-account alert config.
- `await` every webhook post (Vercel freezes the function after the response).
- Check scripts follow `scripts/check-scanner-alerts.ts`: `node:assert/strict`, run with `npx tsx scripts/<name>.ts`, offline.
- Do not commit unless the task step says so. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Deviations from the spec, found while writing this plan:**
1. The spec's "or within ~10% of the 24h extreme" clause is dropped: a Spike extreme is at least 1.25x the normal high, so 90% of it is always above the normal high and the clause can never add a case.
2. The thin-baseline guard uses a local `MIN_BASELINE_POINTS = 7` daily points instead of `MIN_POINTS_FOR_AVERAGE` (which is 2 and not exported). The daily series comes from WeirdGloop history, not the wiki's 2026-07-23 dataset, so the guard is about "too few days to define a normal range".
3. Instant-buy/sell "x minutes ago" uses `getLatest()`'s `highTime` / `lowTime` (unix seconds), which already exist.

## Review Focus

- An item with fewer than 7 baseline days must never alert (thin data) — pinned in Task 1.
- An item with no trades on one side in the last 24h (null `high`/`low` hourly points) must not throw or produce NaN — pinned in Task 1.
- A Spike that has already reverted below the normal high must not alert — pinned in Task 1.
- A cooldown read that throws must produce no Discord post — pinned in Task 5.
- More than 5 hits in one tick: only the top 5 post, the rest stay un-cooled — pinned in Task 5.
- QuickChart URL over the length limit or with an empty series must not crash the embed — pinned in Task 3.
- A user with no RS accounts, or flips with no account, must render without error — pinned in Task 8.

---

## File Structure

| File | Responsibility |
|---|---|
| `shared/outOfRange.ts` (new) | Constants, `detectOutOfRange`, `screenCandidates`, `isCoolingDown`. Pure. |
| `shared/priceSources.ts` (new) | The four data-source labels and descriptions (Wiki quote, Wiki hourly, Wiki hourly series, Weird Gloop daily). |
| `client/src/components/SourceTag.tsx` (new) | Small tag + tooltip that renders one source next to a price. |
| `shared/outOfRangeEmbed.ts` (new) | `buildOutOfRangeEmbed`, `chartUrl`. Pure. |
| `scripts/check-out-of-range.ts` (new) | Offline asserts for the three shared modules plus the sampling report. |
| `shared/schema.ts` | `outOfRangeAlerts` table. |
| `server/storage.ts` | `getOutOfRangeCooldowns`, `markOutOfRangeAlerted`. |
| `server/ge-api.ts` | `getPriceAnchors()` (24h and 7d-ago prices for every item). |
| `server/outOfRange.ts` (new) | `findOutOfRange(items)`, cached `getOutOfRangeSummary()`, `runOutOfRangeAlerts()`. |
| `server/discord.ts` | `thumbnail`/`image`/`url` on `DiscordEmbed`, `postEmbeds`, `sendOutOfRangeAlertsToDiscord`. |
| `server/routes.ts` | Cron calls the new step; `GET /api/scanner/out-of-range`; detail route returns `outOfRange`. |
| `client/src/pages/Scanner.tsx` | Badge, filter toggle. |
| `client/src/components/FlipForm.tsx` | Range badge and price warning; last-used account default. |
| `client/src/components/FlipCard.tsx`, `FlipCardGrid.tsx`, `client/src/pages/Home.tsx` | Account badge and filter. |

---

### Task 1: Pure detector, screen and cooldown rule

**Files:**
- Create: `shared/outOfRange.ts`
- Create: `scripts/check-out-of-range.ts`

**Interfaces:**
- Produces:
```ts
export const SPIKE_MULT = 1.25;
export const DUMP_MULT = 0.8;
export const MIN_BASELINE_POINTS = 7;
export const SCREEN_MOVE = 0.15;
export const MAX_CANDIDATES = 20;
export const COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const COOLDOWN_BREAKOUT = 0.1;
export type Direction = "spike" | "dump";
export interface HourlyPoint { t: number; high: number | null; low: number | null }   // t = epoch ms
export interface DailyPoint { t: number; price: number }                                // t = epoch ms
export interface LatestQuote { high: number | null; low: number | null }
export interface Detection {
  direction: Direction;
  extreme: number;        // 24h max high (spike) or 24h min low (dump)
  normalLow: number;
  normalHigh: number;
  pctBeyond: number;      // spike: (extreme/normalHigh-1)*100; dump: (1-extreme/normalLow)*100
  avg12h: number | null;  // mean hourly mid over the last 12h
  avg1h: number | null;   // mid of the newest hourly point
}
export function detectOutOfRange(hourly24h: HourlyPoint[], daily: DailyPoint[], latest: LatestQuote, nowMs: number): Detection | null;
export interface ScreenItem { id: number; geLimit: number; volume: number; hourVolume: number; buyPrice: number; sellPrice: number }
export interface Anchors { d1: number | null; d7: number | null }
export function screenCandidates(items: ScreenItem[], anchors: Record<string, Anchors>): number[];  // item ids, strongest move first, max MAX_CANDIDATES
export interface CooldownRow { itemId: number; direction: Direction; lastAlertAt: Date; lastPrice: number }
export function isCoolingDown(row: CooldownRow | undefined, direction: Direction, price: number, nowMs: number): boolean;
```

- [ ] **Step 1: Write the failing check script**

Create `scripts/check-out-of-range.ts`:

```ts
/**
 * Self-check for the out-of-range alert's pure parts.
 * Run: npx tsx scripts/check-out-of-range.ts
 * Offline, assert-based, no framework.
 *
 * What would fail silently in production: a spike alert on an item with no real baseline, a
 * spike that has already reverted still posting, a null side (no trades) throwing, and the
 * cooldown either never suppressing or suppressing forever.
 */
import assert from "node:assert/strict";
import {
  detectOutOfRange, screenCandidates, isCoolingDown, MIN_BASELINE_POINTS, COOLDOWN_MS,
  type DailyPoint, type HourlyPoint,
} from "../shared/outOfRange";

const H = 3_600_000;
const D = 24 * H;
const now = Date.UTC(2026, 9, 18, 12, 0, 0);

/** n daily points ending just before the last-24h cutoff, all at `price`. */
const flatDaily = (n: number, price: number): DailyPoint[] =>
  Array.from({ length: n }, (_, i) => ({ t: now - 25 * H - (n - 1 - i) * D, price }));
/** 24 hourly points at `high`/`low`, newest last. */
const flatHourly = (high: number | null, low: number | null): HourlyPoint[] =>
  Array.from({ length: 24 }, (_, i) => ({ t: now - (23 - i) * H, high, low }));

// ── 1. detectOutOfRange ───────────────────────────────────────────────────────────
// Decimation-like: normal 40m..50m, trades at 100m now.
const daily = [...flatDaily(15, 40_000_000), ...flatDaily(15, 50_000_000).map((p) => ({ ...p, t: p.t - 20 * D }))];
const spikeHourly = flatHourly(100_000_000, 95_000_000);
const spike = detectOutOfRange(spikeHourly, daily, { high: 100_000_000, low: 95_000_000 }, now);
assert.ok(spike, "100m over a 50m high is a spike");
assert.equal(spike!.direction, "spike");
assert.equal(spike!.normalHigh, 50_000_000);
assert.equal(Math.round(spike!.pctBeyond), 100);
assert.equal(spike!.avg1h, 97_500_000, "1h = mid of newest point");

// Reverted: the 24h window still contains the spike but the latest price is back to normal.
const reverted = detectOutOfRange(spikeHourly, daily, { high: 48_000_000, low: 47_000_000 }, now);
assert.equal(reverted, null, "reverted spike must not alert");

// Inside the 1.25x band: 55m against a 50m high is not enough.
assert.equal(detectOutOfRange(flatHourly(55_000_000, 54_000_000), daily, { high: 55_000_000, low: 54_000_000 }, now), null, "1.1x is not out of range");

// Dump: normal low 40m, trades at 25m (0.625x, under 0.80x).
const dump = detectOutOfRange(flatHourly(30_000_000, 25_000_000), daily, { high: 30_000_000, low: 25_000_000 }, now);
assert.equal(dump?.direction, "dump");
assert.equal(dump?.normalLow, 40_000_000);

// Thin baseline: one fewer point than the minimum never alerts.
assert.equal(
  detectOutOfRange(spikeHourly, flatDaily(MIN_BASELINE_POINTS - 1, 50_000_000), { high: 100_000_000, low: 95_000_000 }, now),
  null, "thin baseline",
);
assert.ok(
  detectOutOfRange(spikeHourly, flatDaily(MIN_BASELINE_POINTS, 50_000_000), { high: 100_000_000, low: 95_000_000 }, now),
  "exactly the minimum is enough",
);

// Baseline excludes the last 24h: a daily point inside the window must not raise the normal high.
const polluted = [...flatDaily(10, 50_000_000), { t: now - 2 * H, price: 100_000_000 }];
assert.equal(detectOutOfRange(spikeHourly, polluted, { high: 100_000_000, low: 95_000_000 }, now)?.normalHigh, 50_000_000, "last 24h excluded from baseline");

// One-sided trading: null sides neither throw nor invent a dump.
const oneSided = detectOutOfRange(flatHourly(100_000_000, null), daily, { high: 100_000_000, low: null }, now);
assert.equal(oneSided?.direction, "spike");
assert.equal(oneSided?.avg1h, 100_000_000, "mid falls back to the side that traded");
assert.equal(detectOutOfRange(flatHourly(null, null), daily, { high: null, low: null }, now), null, "no trades, no alert");
assert.equal(detectOutOfRange([], daily, { high: 100_000_000, low: 95_000_000 }, now), null, "no hourly data");

// ── 2. screenCandidates ───────────────────────────────────────────────────────────
const item = (id: number, over: Partial<Parameters<typeof screenCandidates>[0][number]> = {}) =>
  ({ id, geLimit: 10, volume: 50, hourVolume: 3, buyPrice: 1000, sellPrice: 1000, ...over });
const anchors = { "1": { d1: 1000, d7: 1000 }, "2": { d1: 1000, d7: 1000 }, "3": { d1: 1000, d7: 1000 }, "4": { d1: null, d7: null }, "5": { d1: 1000, d7: 1000 } };
const ids = screenCandidates(
  [
    item(1, { sellPrice: 1300 }),                  // +30% -> spike candidate
    item(2, { buyPrice: 700 }),                    // -30% -> dump candidate
    item(3, { sellPrice: 1300, volume: 5 }),       // moved but under geLimit -> illiquid
    item(4, { sellPrice: 1300 }),                  // no anchors -> cannot screen
    item(5, { sellPrice: 1300, hourVolume: 0 }),   // nothing traded this hour
  ],
  anchors,
);
assert.deepEqual([...ids].sort(), [1, 2], "only liquid movers with anchors survive");
const many = Array.from({ length: 30 }, (_, i) => item(i + 100, { sellPrice: 1200 + i * 10 }));
const manyAnchors = Object.fromEntries(many.map((m) => [String(m.id), { d1: 1000, d7: 1000 }]));
const top = screenCandidates(many, manyAnchors);
assert.equal(top.length, 20, "capped at MAX_CANDIDATES");
assert.equal(top[0], 129, "strongest move first");

// ── 3. isCoolingDown ──────────────────────────────────────────────────────────────
const row = { itemId: 1, direction: "spike" as const, lastAlertAt: new Date(now - 2 * H), lastPrice: 100_000_000 };
assert.equal(isCoolingDown(undefined, "spike", 1, now), false, "never alerted");
assert.equal(isCoolingDown(row, "spike", 100_000_000, now), true, "2h in, same price");
assert.equal(isCoolingDown(row, "spike", 105_000_000, now), true, "+5% is not a breakout");
assert.equal(isCoolingDown(row, "spike", 110_000_000, now), false, "+10% further breaks the cooldown");
assert.equal(isCoolingDown(row, "spike", 90_000_000, now), true, "a smaller price is not a further spike");
assert.equal(isCoolingDown({ ...row, lastAlertAt: new Date(now - COOLDOWN_MS) }, "spike", 100_000_000, now), false, "cooldown elapsed");
const dumpRow = { ...row, direction: "dump" as const, lastPrice: 1000 };
assert.equal(isCoolingDown(dumpRow, "dump", 900, now), false, "-10% further breaks a dump cooldown");
assert.equal(isCoolingDown(dumpRow, "dump", 950, now), true, "-5% does not");

console.log("check-out-of-range: ok");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/check-out-of-range.ts`
Expected: FAIL — cannot resolve `../shared/outOfRange`.

- [ ] **Step 3: Write the implementation**

Create `shared/outOfRange.ts`:

```ts
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
    const up = it.sellPrice / Math.min(...refs) - 1;
    const down = 1 - it.buyPrice / Math.max(...refs);
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
  const broke = direction === "spike"
    ? price >= row.lastPrice * (1 + COOLDOWN_BREAKOUT)
    : price <= row.lastPrice * (1 - COOLDOWN_BREAKOUT);
  return !broke;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx scripts/check-out-of-range.ts`
Expected: prints `check-out-of-range: ok`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add shared/outOfRange.ts scripts/check-out-of-range.ts
git commit -m "feat: pure out-of-range detector, candidate screen and cooldown rule

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cooldown table and storage

**Files:**
- Modify: `shared/schema.ts` (add table after `scannerPresets` block, ~line 252; extend the `drizzle-orm/pg-core` import with `primaryKey`)
- Modify: `server/storage.ts` (add two methods next to `markScannerPresetRun`, ~line 1138; add to the `IStorage` interface and the class)

**Interfaces:**
- Consumes: `CooldownRow`, `Direction` from `shared/outOfRange.ts`.
- Produces:
```ts
// shared/schema.ts
export const outOfRangeAlerts: PgTableWithColumns<...>;   // columns itemId, direction, lastAlertAt, lastPrice
export type OutOfRangeAlertRow = typeof outOfRangeAlerts.$inferSelect;
// server/storage.ts (IStorage + DatabaseStorage)
getOutOfRangeCooldowns(): Promise<CooldownRow[]>;
markOutOfRangeAlerted(rows: { itemId: number; direction: Direction; price: number }[], now: Date): Promise<void>;
```

- [ ] **Step 1: Add the table**

In `shared/schema.ts`, add `primaryKey` to the pg-core import and add, after `export type ScannerPreset ...`:

```ts
// Cooldown for out-of-range alerts (server/outOfRange.ts). One row per item+direction; a row
// means "we last told Discord about this at this price". Additive: no existing table changes.
export const outOfRangeAlerts = pgTable(
  "out_of_range_alerts",
  {
    itemId: integer("item_id").notNull(),
    direction: varchar("direction", { length: 5 }).notNull(), // 'spike' | 'dump'
    lastAlertAt: timestamp("last_alert_at").notNull(),
    lastPrice: bigint("last_price", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.direction] })],
);
export type OutOfRangeAlertRow = typeof outOfRangeAlerts.$inferSelect;
```

- [ ] **Step 2: Add the storage methods**

In `server/storage.ts`, import `outOfRangeAlerts` from `@shared/schema` and `type CooldownRow, type Direction` from `@shared/outOfRange`. Add both signatures to `IStorage` (follow how `markScannerPresetRun` is declared there) and, in the class beside `markScannerPresetRun`:

```ts
  async getOutOfRangeCooldowns(): Promise<CooldownRow[]> {
    // The table only ever holds items that alerted in recent days; reading all of it is cheaper
    // than one query per candidate.
    const rows = await db.select().from(outOfRangeAlerts);
    return rows.map((r) => ({ itemId: r.itemId, direction: r.direction as Direction, lastAlertAt: r.lastAlertAt, lastPrice: r.lastPrice }));
  }

  async markOutOfRangeAlerted(rows: { itemId: number; direction: Direction; price: number }[], now: Date): Promise<void> {
    for (const r of rows) {
      await db
        .insert(outOfRangeAlerts)
        .values({ itemId: r.itemId, direction: r.direction, lastAlertAt: now, lastPrice: r.price })
        .onConflictDoUpdate({
          target: [outOfRangeAlerts.itemId, outOfRangeAlerts.direction],
          set: { lastAlertAt: now, lastPrice: r.price },
        });
    }
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `IStorage` has another implementation (e.g. an in-memory one), tsc names it; add the same two methods there (an in-memory `Map` keyed `${itemId}:${direction}`).

- [ ] **Step 4: Commit** (do not run `db:push` — that is Task 10, run by Bryan against production)

```bash
git add shared/schema.ts server/storage.ts
git commit -m "feat: out_of_range_alerts cooldown table and storage methods

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Data-source labels, embed builder and QuickChart URL

**Files:**
- Create: `shared/priceSources.ts`
- Create: `shared/outOfRangeEmbed.ts`
- Modify: `scripts/check-out-of-range.ts` (append section 4)

**Interfaces:**
- Consumes: `Detection`, `HourlyPoint`, `DailyPoint` from `shared/outOfRange.ts`; `formatGpShorthand` from `shared/gpParser.ts`.
- Produces:
```ts
// shared/priceSources.ts
export type SourceKey = "wiki-quote" | "wiki-hourly" | "wiki-series" | "weirdgloop";
export const SOURCES: Record<SourceKey, { label: string; name: string; detail: string }>;
// shared/outOfRangeEmbed.ts
export interface EmbedHit {
  itemId: number;
  name: string;
  icon: string;               // ScannerItem.icon URL
  geLimit: number;
  volume: number;
  margin: number;             // ScannerItem.margin (gp per unit)
  detection: Detection;
  latest: { high: number | null; highTime: number | null; low: number | null; lowTime: number | null }; // times in unix SECONDS (getLatest shape)
  series7d: HourlyPoint[];    // hourly, ~7 days, oldest first
}
export interface OutOfRangeEmbed {
  title: string; color: number; url?: string; description: string;
  thumbnail?: { url: string }; image?: { url: string };
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp: string; footer: { text: string };
}
export function chartUrl(series7d: HourlyPoint[], normalLow: number, normalHigh: number, nowMs: number): string | null;
export function buildOutOfRangeEmbed(hit: EmbedHit, nowMs: number): OutOfRangeEmbed;
```

- [ ] **Step 1: Append failing checks**

Append to `scripts/check-out-of-range.ts` before the final `console.log`:

```ts
// ── 4. embed + chart ──────────────────────────────────────────────────────────────
import { buildOutOfRangeEmbed, chartUrl } from "../shared/outOfRangeEmbed";

const week: HourlyPoint[] = Array.from({ length: 168 }, (_, i) => ({ t: now - (167 - i) * H, high: 50_000_000 + i * 300_000, low: 48_000_000 }));
const url = chartUrl(week, 40_000_000, 50_000_000, now);
assert.ok(url && url.startsWith("https://quickchart.io/chart?"), "chart url");
assert.ok(url!.length < 2000, `chart url must stay short, was ${url!.length}`);
assert.equal(chartUrl([], 1, 2, now), null, "no series, no chart");

const embed = buildOutOfRangeEmbed({
  itemId: 11694, name: "Decimation", icon: "https://example.test/i.gif", geLimit: 8, volume: 2268, margin: 1_251_561,
  detection: spike!, latest: { high: 100_000_000, highTime: Math.floor(now / 1000) - 35 * 60, low: 95_000_000, lowTime: Math.floor(now / 1000) - 35 * 60 },
  series7d: week,
}, now);
assert.match(embed.title, /^Spike on Decimation/);
assert.equal(embed.color, 0x22c55e, "spike is green: a price to sell into");
assert.equal(embed.thumbnail?.url, "https://example.test/i.gif");
assert.ok(embed.image?.url.startsWith("https://quickchart.io/"), "chart attached");
assert.match(embed.description, /Volume.*2,268.*Limit.*8/);
assert.match(embed.description, /<t:\d+:R>/, "relative timestamps for insta buy/sell");
assert.match(embed.footer.text, /RuneScape Wiki/, "footer names the price source");
assert.match(embed.footer.text, /Weird Gloop/, "footer names the Normal range source");
assert.equal(
  buildOutOfRangeEmbed({ ...{ itemId: 1, name: "X", icon: "i", geLimit: 1, volume: 1, margin: 1, detection: dump!, latest: { high: null, highTime: null, low: 25_000_000, lowTime: null }, series7d: [] } }, now).image,
  undefined, "no series means no image, and null times must not crash",
);
assert.equal(
  buildOutOfRangeEmbed({ itemId: 1, name: "X", icon: "i", geLimit: 1, volume: 1, margin: 1, detection: dump!, latest: { high: null, highTime: null, low: 25_000_000, lowTime: null }, series7d: [] }, now).color,
  0xef4444, "dump is red",
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/check-out-of-range.ts`
Expected: FAIL — cannot resolve `../shared/outOfRangeEmbed`.

- [ ] **Step 3: Implement**

Create `shared/priceSources.ts`:

```ts
/**
 * Where each kind of market price comes from. One table so the UI tags and the Discord footer
 * can never disagree. Hosts are in server/ge-api.ts (WIKI_API_BASE, GE_API_BASE).
 *
 * The two upstreams differ in kind: the wiki has real instant-buy / instant-sell prices at
 * hourly resolution but its RS3 dataset starts 2026-07-23; Weird Gloop has years of history
 * but a single guide price per day, with no buy/sell split.
 */
export type SourceKey = "wiki-quote" | "wiki-hourly" | "wiki-series" | "weirdgloop";

export const SOURCES: Record<SourceKey, { label: string; name: string; detail: string }> = {
  "wiki-quote": {
    label: "Wiki",
    name: "RuneScape Wiki",
    detail:
      "RuneScape Wiki real-time prices (prices.runescape.wiki). The average of the last hour's trades where both sides traded, otherwise the latest single trade on each side.",
  },
  "wiki-hourly": {
    label: "Wiki · hourly",
    name: "RuneScape Wiki",
    detail: "RuneScape Wiki real-time prices (prices.runescape.wiki): the average of trades in one hour, compared with the same hour 24h and 7d earlier.",
  },
  "wiki-series": {
    label: "Wiki · hourly series",
    name: "RuneScape Wiki",
    detail: "RuneScape Wiki real-time prices (prices.runescape.wiki): one point per hour for the last 7 days.",
  },
  weirdgloop: {
    label: "Weird Gloop · daily",
    name: "Weird Gloop",
    detail: "Weird Gloop Exchange (api.weirdgloop.org): one guide price per day. No separate buy and sell prices.",
  },
};
```

Create `shared/outOfRangeEmbed.ts`:

```ts
/**
 * The Discord embed for one out-of-range alert, in the style of the Flipper bot: title, links,
 * rating, volume/limit, max profit, GE price, 12h|1h, insta buy/sell with relative time, item
 * icon, and a chart. Pure so scripts/check-out-of-range.ts can render it offline; discord.ts
 * only posts what this returns.
 */
import { formatGpShorthand } from "./gpParser";
import type { Detection, HourlyPoint } from "./outOfRange";
import { SOURCES } from "./priceSources";

export interface EmbedHit {
  itemId: number;
  name: string;
  icon: string;
  geLimit: number;
  volume: number;
  margin: number;
  detection: Detection;
  latest: { high: number | null; highTime: number | null; low: number | null; lowTime: number | null };
  series7d: HourlyPoint[];
}

export interface OutOfRangeEmbed {
  title: string;
  color: number;
  url?: string;
  description: string;
  thumbnail?: { url: string };
  image?: { url: string };
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp: string;
  footer: { text: string };
}

const MAX_CHART_POINTS = 40;
const MAX_URL = 1990;
const gp = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));
const ago = (unixSeconds: number | null) => (unixSeconds == null ? "" : ` <t:${unixSeconds}:R>`);

/** 7d hourly series -> QuickChart line chart: the week in blue, the last 24h in amber over it,
 *  and the Normal range as two dashed lines so "how far out" is visible at a glance.
 *
 *  The whole chart config rides in the URL and JSON balloons under percent-encoding, so values
 *  are shown in K/M/B and, if the URL is still too long, the series is thinned and retried. */
export function chartUrl(series7d: HourlyPoint[], normalLow: number, normalHigh: number, nowMs: number): string | null {
  const prices = series7d
    .map((p) => ({ t: p.t, v: p.high != null && p.low != null ? Math.round((p.high + p.low) / 2) : (p.high ?? p.low) }))
    .filter((p): p is { t: number; v: number } => p.v != null);
  if (prices.length < 2) return null;
  const top = Math.max(...prices.map((p) => p.v), normalHigh);
  const [unit, unitName] = top >= 1e9 ? [1e9, "B"] : top >= 1e6 ? [1e6, "M"] : top >= 1e3 ? [1e3, "K"] : [1, ""];
  const r = (n: number) => Math.round((n / unit) * 100) / 100;
  const dayAgo = nowMs - 24 * 3_600_000;

  for (const maxPoints of [MAX_CHART_POINTS, 30, 20, 12]) {
    const step = Math.max(1, Math.ceil(prices.length / maxPoints));
    const sampled = prices.filter((_, i) => i % step === 0 || i === prices.length - 1);
    const config = {
      type: "line",
      data: {
        labels: sampled.map((_, i) => i),
        datasets: [
          { data: sampled.map((p) => r(p.v)), borderColor: "#60a5fa" },
          { data: sampled.map((p) => (p.t >= dayAgo ? r(p.v) : null)), borderColor: "#f59e0b", borderWidth: 3 },
          { data: sampled.map(() => r(normalHigh)), borderColor: "#6b7280", borderDash: [4, 4], borderWidth: 1 },
          { data: sampled.map(() => r(normalLow)), borderColor: "#6b7280", borderDash: [4, 4], borderWidth: 1 },
        ],
      },
      options: {
        legend: { display: false },
        elements: { point: { radius: 0 }, line: { fill: false, borderWidth: 2 } },
        scales: { xAxes: [{ display: false }], yAxes: [{ scaleLabel: { display: true, labelString: `gp (${unitName || "raw"})` } }] },
      },
    };
    const url = `https://quickchart.io/chart?bkg=%23202225&w=520&h=180&c=${encodeURIComponent(JSON.stringify(config))}`;
    if (url.length <= MAX_URL) return url;
  }
  return null;
}

export function buildOutOfRangeEmbed(hit: EmbedHit, nowMs: number): OutOfRangeEmbed {
  const d = hit.detection;
  const spike = d.direction === "spike";
  const fires = d.pctBeyond >= 100 ? "🔥🔥🔥" : d.pctBeyond >= 50 ? "🔥🔥" : "🔥";
  const wiki = `https://runescape.wiki/w/Exchange:${encodeURIComponent(hit.name.replace(/ /g, "_"))}`;
  const lines = [
    `[Wiki](${wiki})`,
    `**Rating**: ${fires}`,
    `**Volume**: ${gp(hit.volume)} | **Limit**: ${gp(hit.geLimit)}`,
    `**Max profit**: ${gp(hit.margin * hit.geLimit)}`,
    `**${spike ? "24h high" : "24h low"}**: ${gp(d.extreme)} (${d.pctBeyond.toFixed(0)}% beyond normal)`,
    `**Normal range**: ${formatGpShorthand(d.normalLow)} – ${formatGpShorthand(d.normalHigh)}`,
    `**12h**: ${gp(d.avg12h)} | **1h**: ${gp(d.avg1h)}`,
    ``,
    `**Insta Buy**: ${gp(hit.latest.high)}${ago(hit.latest.highTime)}`,
    `**Insta Sell**: ${gp(hit.latest.low)}${ago(hit.latest.lowTime)}`,
  ];
  const chart = chartUrl(hit.series7d, d.normalLow, d.normalHigh, nowMs);
  return {
    title: `${spike ? "Spike" : "Dump"} on ${hit.name} 👀`,
    // Green when there is something to sell into, red when it is something to buy.
    color: spike ? 0x22c55e : 0xef4444,
    url: wiki,
    description: lines.join("\n"),
    thumbnail: { url: hit.icon },
    ...(chart ? { image: { url: chart } } : {}),
    fields: [],
    timestamp: new Date(nowMs).toISOString(),
    // The 24h extreme is a wiki hourly price; the Normal range is a Weird Gloop daily guide
    // price. Different series, so the embed says so rather than implying one source.
    footer: { text: `RS3 Flip Tracker · Prices: ${SOURCES["wiki-quote"].name} · Normal range: ${SOURCES.weirdgloop.name} daily` },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx scripts/check-out-of-range.ts`
Expected: `check-out-of-range: ok`.

- [ ] **Step 5: Commit**

```bash
git add shared/priceSources.ts shared/outOfRangeEmbed.ts scripts/check-out-of-range.ts
git commit -m "feat: data-source labels and out-of-range embed builder with QuickChart sparkline

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Price anchors, orchestrator and Discord sender

**Files:**
- Modify: `server/ge-api.ts` (add `getPriceAnchors` after `getHourly7dAgo`/`hourlyMid`, ~line 215)
- Create: `server/outOfRange.ts`
- Modify: `server/discord.ts` (extend `DiscordEmbed`, add `postEmbeds`, make `postEmbed` delegate, add `sendOutOfRangeAlertsToDiscord`)

**Interfaces:**
- Consumes: Task 1 (`screenCandidates`, `detectOutOfRange`, types), Task 3 (`EmbedHit`, `buildOutOfRangeEmbed`), existing `getAllItemsForScanner`, `getItemIntraday(itemId, hours)`, `getItemPriceHistoryFull(itemId)`, `getLatest()`.
- Produces:
```ts
// server/ge-api.ts
export async function getPriceAnchors(): Promise<Record<string, { d1: number | null; d7: number | null }>>;
// server/outOfRange.ts
export interface OutOfRangeHit extends EmbedHit {}
export async function findOutOfRange(items: ScannerItem[], nowMs?: number): Promise<OutOfRangeHit[]>;   // ranked by detection.pctBeyond desc
export interface OutOfRangeSummary { itemId: number; direction: Direction; extreme: number; normalLow: number; normalHigh: number; pctBeyond: number }
export async function getOutOfRangeSummary(): Promise<OutOfRangeSummary[]>;   // cached ~5 min
// server/discord.ts
export async function sendOutOfRangeAlertsToDiscord(hits: EmbedHit[]): Promise<boolean>;
```

- [ ] **Step 1: `getPriceAnchors` in `server/ge-api.ts`**

After the `hourlyMid` function add:

```ts
/** 24h-ago and 7d-ago hourly mid for every item — the cheap anchors the out-of-range screen
 *  compares the current price against. Two memoized bulk calls, shared with the movers. */
export async function getPriceAnchors(): Promise<Record<string, { d1: number | null; d7: number | null }>> {
  const [dayAgo, weekAgo] = await Promise.all([getHourly24hAgo(), getHourly7dAgo()]);
  const out: Record<string, { d1: number | null; d7: number | null }> = {};
  for (const id of new Set([...Object.keys(dayAgo), ...Object.keys(weekAgo)])) {
    out[id] = { d1: hourlyMid(dayAgo[id]), d7: hourlyMid(weekAgo[id]) };
  }
  return out;
}
```

- [ ] **Step 2: Extend Discord helpers in `server/discord.ts`**

Replace the `DiscordEmbed` interface with:

```ts
interface DiscordEmbed {
  title: string;
  color: number;
  url?: string;
  description?: string;
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
  footer?: { text: string };
  thumbnail?: { url: string };
  image?: { url: string };
}
```

Replace `postEmbed` with a delegating pair (behaviour of `postEmbed` is unchanged):

```ts
/** One webhook POST carrying up to 10 embeds. The four older senders each inline this; new
 *  senders go through here. */
export async function postEmbeds(webhookUrl: string, embeds: DiscordEmbed[]): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds } satisfies DiscordWebhookPayload),
    });
    if (!response.ok) {
      console.error("[Discord] Webhook failed:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Discord] Error sending webhook:", error);
    return false;
  }
}

export const postEmbed = (webhookUrl: string, embed: DiscordEmbed) => postEmbeds(webhookUrl, [embed]);
```

Add at the end of the file (and `import { buildOutOfRangeEmbed, type EmbedHit } from "@shared/outOfRangeEmbed";` at the top):

```ts
/** One message, one embed per hit. The caller caps `hits` (Discord allows 10 embeds). */
export async function sendOutOfRangeAlertsToDiscord(hits: EmbedHit[]): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.log("[Discord] No DISCORD_WEBHOOK_URL, skipping out-of-range alert");
    return false;
  }
  if (hits.length === 0) return false;
  const now = Date.now();
  return postEmbeds(url, hits.map((h) => buildOutOfRangeEmbed(h, now)));
}
```

- [ ] **Step 3: Orchestrator `server/outOfRange.ts`**

```ts
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
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `getLatest` values type differs from `EmbedHit["latest"]`, they match by construction (`{ high, highTime, low, lowTime }` all `number | null`).

- [ ] **Step 5: Re-run the check script, then commit**

Run: `npx tsx scripts/check-out-of-range.ts` → `check-out-of-range: ok`.

```bash
git add server/ge-api.ts server/outOfRange.ts server/discord.ts
git commit -m "feat: out-of-range orchestrator, price anchors and Discord sender

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cron wiring, cap and cooldown selection

**Files:**
- Modify: `shared/outOfRange.ts` (add `pickToSend`)
- Modify: `server/outOfRange.ts` (use `pickToSend`)
- Modify: `scripts/check-out-of-range.ts`
- Modify: `server/routes.ts`

The "not cooling, strongest first, capped" decision is extracted as a pure function first so the cap and cooldown behaviour can be checked offline.

**Interfaces:**
- Produces:
```ts
export function pickToSend<T extends { itemId: number; detection: { direction: Direction; pctBeyond: number }; latest: { high: number | null; low: number | null } }>(
  hits: T[], cooldowns: CooldownRow[], nowMs: number, cap: number,
): T[];   // not cooling, ranked by pctBeyond desc, at most `cap`
```

- [ ] **Step 1: Failing check**

Append before the final `console.log` in `scripts/check-out-of-range.ts`:

```ts
// ── 5. pickToSend ─────────────────────────────────────────────────────────────────
import { pickToSend } from "../shared/outOfRange";
const mkHit = (itemId: number, pctBeyond: number, high = 100) => ({ itemId, detection: { direction: "spike" as const, pctBeyond }, latest: { high, low: 90 } });
const seven = [1, 2, 3, 4, 5, 6, 7].map((id) => mkHit(id, id * 10));
const sent = pickToSend(seven, [], now, 5);
assert.deepEqual(sent.map((h) => h.itemId), [7, 6, 5, 4, 3], "top 5 by pctBeyond; 1 and 2 are cut and stay un-cooled");
const cooled = pickToSend(seven, [{ itemId: 7, direction: "spike", lastAlertAt: new Date(now - H), lastPrice: 100 }], now, 5);
assert.deepEqual(cooled.map((h) => h.itemId), [6, 5, 4, 3, 2], "a cooling item is skipped and the next one takes its slot");
assert.deepEqual(pickToSend([mkHit(9, 50, null as any)], [], now, 5), [], "no live price on the alert side: skip, do not crash");
```

Run `npx tsx scripts/check-out-of-range.ts` → FAIL (`pickToSend` not exported).

- [ ] **Step 2: Implement `pickToSend`** — append to `shared/outOfRange.ts`:

```ts
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
```

In `server/outOfRange.ts`, replace the `cool` map, the `fresh` filter and the `batch` line in `runOutOfRangeAlerts` with:

```ts
  const hits = await findOutOfRange(await getAllItemsForScanner(), now.getTime());
  const batch = pickToSend(hits, cooldowns, now.getTime(), MAX_EMBEDS_PER_TICK);
```

and update its import to `import { detectOutOfRange, screenCandidates, pickToSend, type ... } from "@shared/outOfRange";` (drop the now-unused `isCoolingDown` import).

- [ ] **Step 3: Verify it passes**

Run: `npx tsx scripts/check-out-of-range.ts` → `check-out-of-range: ok`. Run `npx tsc --noEmit` → clean.

- [ ] **Step 4: Wire the cron route**

In `server/routes.ts`, import `runOutOfRangeAlerts` from `./outOfRange` and replace the cron handler body's `try` block:

```ts
    try {
      // Presets first, then the global out-of-range check. Independent: a failure in one must
      // not hide the other, and the second runs even when no preset is due.
      const presets = await runDueAlerts();
      let outOfRange: Awaited<ReturnType<typeof runOutOfRangeAlerts>>;
      try {
        outOfRange = await runOutOfRangeAlerts();
      } catch (error) {
        console.error("Out-of-range alerts error:", error);
        outOfRange = { found: 0, sent: 0, error: error instanceof Error ? error.message : String(error) };
      }
      res.json({ ...presets, outOfRange });
    } catch (error) {
```

(keep the existing `catch` body). Note this changes the response from `{ran, sent, errors}` to `{ran, sent, errors, outOfRange}`; `.github/workflows/scanner-alerts.yml` only checks the HTTP status — confirm with `grep -n "curl" -A6 .github/workflows/scanner-alerts.yml`.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add shared/outOfRange.ts server/outOfRange.ts server/routes.ts scripts/check-out-of-range.ts
git commit -m "feat: run out-of-range alerts on every cron tick, capped and cooled down

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sampling report to tune the thresholds

**Files:**
- Create: `scripts/report-out-of-range.ts`

This is the spec's "tune to roughly 5-15 alerts a day" step. It hits live APIs, so it is a manual tool, not part of the offline checks.

**Interfaces:**
- Consumes: `getAllItemsForScanner`, `getItemPriceHistoryFull`, `detectOutOfRange`, `SPIKE_MULT`, `DUMP_MULT`.

- [ ] **Step 1: Write the script**

```ts
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
```

- [ ] **Step 2: Run it and tune**

Run: `npx tsx scripts/report-out-of-range.ts`
Expected: prints a per-day count and an average. If the average is above ~15, raise `SPIKE_MULT` (e.g. 1.35); if below ~5, lower it (e.g. 1.20) — scaled to the 200-item sample, so apply judgement: the real run covers ~2200 items. Edit the constant in `shared/outOfRange.ts` and re-run `npx tsx scripts/check-out-of-range.ts` (its fixtures use 2.0x and 1.1x, so they hold for any multiplier between 1.11 and 1.99).

- [ ] **Step 3: Commit**

```bash
git add scripts/report-out-of-range.ts shared/outOfRange.ts
git commit -m "chore: threshold sampling report for out-of-range alerts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Scanner endpoint, badge and filter

**Files:**
- Modify: `server/routes.ts` (new route next to `/api/scanner/items`; extend the detail route's JSON)
- Modify: `client/src/pages/Scanner.tsx`

**Interfaces:**
- Consumes: `getOutOfRangeSummary`, `OutOfRangeSummary` from `server/outOfRange.ts`; `detectOutOfRange` for the detail route.
- Produces:
  - `GET /api/scanner/out-of-range` → `OutOfRangeSummary[]` (any logged-in user, `isAuthenticated` only).
  - `GET /api/scanner/item/:itemId/detail` gains `outOfRange: Detection | null`.

- [ ] **Step 1: Server routes**

In `server/routes.ts`, import `getOutOfRangeSummary` from `./outOfRange` and `detectOutOfRange` from `@shared/outOfRange`; next to `GET /api/scanner/items` add:

```ts
  // Items currently out of range, from the same detector the Discord alert uses. Cached 5 min.
  app.get("/api/scanner/out-of-range", isAuthenticated, async (_req: any, res) => {
    try {
      res.json(await getOutOfRangeSummary());
    } catch (error) {
      console.error("Out-of-range summary error:", error);
      res.status(500).json({ error: "Failed to load out-of-range items" });
    }
  });
```

In the detail route (`/api/scanner/item/:itemId/detail`), after `range30d` is computed inside the `fullHistory` block, add a `let outOfRange: Detection | null = null;` beside the other `let`s (import `type Detection`) and, inside `if (fullHistory.daily.length > 0) { ... }`, add:

```ts
            const [week, latest] = await Promise.all([getItemIntraday(itemId, 24), getLatest()]);
            const q = latest[String(itemId)];
            if (week && q) {
              outOfRange = detectOutOfRange(
                week.map((p) => ({ t: new Date(p.date).getTime(), high: p.high ?? null, low: p.low ?? null })),
                fullHistory.daily.map((p) => ({ t: new Date(p.date).getTime(), price: p.price })),
                { high: q.high, low: q.low },
                Date.now(),
              );
            }
```

and add `outOfRange,` to the `res.json({ ... })` object (import `getItemIntraday, getLatest` from `./ge-api` if not already imported).

- [ ] **Step 2: Verify the endpoints**

Run: `npx tsc --noEmit` → clean. Start the dev server (`npm run dev`), log in, and open `/api/scanner/out-of-range` and `/api/scanner/item/<id>/detail` in the browser. Expected: a JSON array (possibly empty) and a detail object containing an `outOfRange` key. While logged out, `/api/scanner/out-of-range` returns 401.

- [ ] **Step 3: Scanner UI**

In `client/src/pages/Scanner.tsx`:

1. Add the type and query next to the other `useQuery` calls (~line 714):

```tsx
interface OutOfRangeRow { itemId: number; direction: "spike" | "dump"; extreme: number; normalLow: number; normalHigh: number; pctBeyond: number }

  const { data: outOfRange = [] } = useQuery<OutOfRangeRow[]>({
    queryKey: ["/api/scanner/out-of-range"],
    refetchInterval: 5 * 60 * 1000,
  });
  const outOfRangeById = useMemo(() => new Map(outOfRange.map((r) => [r.itemId, r])), [outOfRange]);
```

2. Add state `const [outOfRangeOnly, setOutOfRangeOnly] = useState(false);` beside `signalsOnly`, and apply it where `processedItems` is derived (follow how `signalsOnly` filters the list): `.filter((i) => !outOfRangeOnly || outOfRangeById.has(i.id))`.

3. Add a checkbox next to the "signals only" one (copy its JSX at ~line 1183, ids `out-of-range-only`, test id `checkbox-out-of-range-only`), labelled "Out of range" with a count badge `{outOfRange.length}` styled like `badge-signals-count`.

4. In the name cell (`<span className="block truncate max-w-[200px]">{item.name}</span>`, ~line 1428) add after it:

```tsx
{outOfRangeById.get(item.id) && (
  <Badge
    variant="outline"
    className={`ml-1 text-[10px] ${outOfRangeById.get(item.id)!.direction === "spike" ? "border-emerald-500/50 text-emerald-500" : "border-rose-500/50 text-rose-400"}`}
    title={`24h extreme ${outOfRangeById.get(item.id)!.extreme.toLocaleString()} vs normal ${outOfRangeById.get(item.id)!.normalLow.toLocaleString()}–${outOfRangeById.get(item.id)!.normalHigh.toLocaleString()}`}
    data-testid={`badge-out-of-range-${item.id}`}
  >
    {outOfRangeById.get(item.id)!.direction === "spike" ? "Spike" : "Dump"} +{outOfRangeById.get(item.id)!.pctBeyond.toFixed(0)}%
  </Badge>
)}
```

5. In `ItemDetailPanel` (`detail?.range30d` is read near line 401) show the detail's `outOfRange` when present: extend the `ItemDetail` type with `outOfRange: { direction: "spike" | "dump"; extreme: number; normalLow: number; normalHigh: number; pctBeyond: number } | null`, and render one line near the 30-day range block: `Out of range: 24h {direction === "spike" ? "high" : "low"} {extreme.toLocaleString()} gp is {pctBeyond.toFixed(0)}% beyond the normal {normalLow.toLocaleString()}–{normalHigh.toLocaleString()} gp.`

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`, open `/scanner` as a non-admin and an admin. Expected: the "Out of range" checkbox with a count; when the count is above 0, badges on those rows and the filter narrows the table to them; expanding a flagged row shows the out-of-range line. When the count is 0, everything else renders as before.

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts client/src/pages/Scanner.tsx
git commit -m "feat: out-of-range badge, filter and detail line in the Scanner

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Log Flip price warning and account identification

**Files:**
- Modify: `client/src/components/FlipForm.tsx`
- Modify: `client/src/components/FlipCard.tsx`
- Modify: `client/src/components/FlipCardGrid.tsx`
- Modify: `client/src/pages/Home.tsx`

**Interfaces:**
- Consumes: `GET /api/scanner/item/:itemId/detail` → `outOfRange` and `range30d` (Task 7); `GET /api/rs-accounts` → `RsAccount[]`.
- Produces: no new server API.

- [ ] **Step 1: Range badge and price warning in `FlipForm.tsx`**

Add a query keyed on the picked item (`gePrice?.id`) and the warning, below the existing `rsAccounts` query (~line 120):

```tsx
  const { data: itemDetail } = useQuery<{ range30d: { low: number; high: number } | null; outOfRange: { direction: "spike" | "dump"; pctBeyond: number } | null }>({
    queryKey: ["/api/scanner/item", gePrice?.id, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/scanner/item/${gePrice!.id}/detail`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch item detail");
      return res.json();
    },
    enabled: !!gePrice?.id,
    staleTime: 5 * 60 * 1000,
  });
  const normal = itemDetail?.range30d ?? null;
  // Entered price vs the 30-day range. Silent when there is no range or no price yet.
  const priceWarning = (raw: string): string | null => {
    const v = parseGp(raw);
    if (!normal || !v) return null;
    if (v > normal.high) return `Above the 30-day high (${formatGp(normal.high)} gp)`;
    if (v < normal.low) return `Below the 30-day low (${formatGp(normal.low)} gp)`;
    return null;
  };
```

(`parseGp` and `formatGp` are already used in this file — reuse their existing imports.) Render, directly under each price `<Input>` (buy at ~line 1066, sell at ~line 1094), before the sell field's `taxCalc` block:

```tsx
{priceWarning(buyPrice) && (
  <p className="text-xs text-warning flex items-center gap-1" data-testid="warning-buy-out-of-range">
    <AlertTriangle className="h-3 w-3" />{priceWarning(buyPrice)}
  </p>
)}
```

and the same with `sellPrice` / `warning-sell-out-of-range`. Under the item picker (next to where `gePrice` is displayed), show when `itemDetail?.outOfRange` is set a small badge: `{outOfRange.direction === "spike" ? "Spike" : "Dump"} +{pctBeyond.toFixed(0)}% — normal {formatGp(normal.low)}–{formatGp(normal.high)} gp`. `AlertTriangle` is already imported (used at ~line 814).

- [ ] **Step 2: Last-used account default in `FlipForm.tsx`**

Replace `const [selectedRsAccountId, setSelectedRsAccountId] = useState<string>("");` with a lazy initialiser that reads the browser, and persist on change. Add a constant above the component:

```tsx
const LAST_ACCOUNT_KEY = "flipsync:lastRsAccountId";
function readLastAccount(): string {
  try { return localStorage.getItem(LAST_ACCOUNT_KEY) ?? ""; } catch { return ""; }
}
```

```tsx
  const [selectedRsAccountId, setSelectedRsAccountIdRaw] = useState<string>(readLastAccount);
  const setSelectedRsAccountId = (id: string) => {
    setSelectedRsAccountIdRaw(id);
    try { id ? localStorage.setItem(LAST_ACCOUNT_KEY, id) : localStorage.removeItem(LAST_ACCOUNT_KEY); } catch { /* private mode: the default just doesn't persist */ }
  };
```

And once accounts load, drop a remembered id that no longer exists (account deleted), so the picker doesn't show a blank value:

```tsx
  useEffect(() => {
    if (selectedRsAccountId && rsAccounts.length > 0 && !rsAccounts.some((a) => a.id === selectedRsAccountId)) setSelectedRsAccountId("");
  }, [rsAccounts, selectedRsAccountId]);
```

(`useEffect` — add to the `react` import if missing.) Confirm the form's reset-after-submit code (search `setSelectedRsAccountId(` in the file) does not clear the remembered account; if it resets to `""`, change that line to leave the selection alone so the next flip keeps the account.

- [ ] **Step 3: Account badge on flip cards**

In `client/src/components/FlipCardGrid.tsx` add `rsAccountId?: string | null;` to its local `Flip` interface (~line 28). In `client/src/pages/Home.tsx`, the `flips.map(...)` passes `...flip`, so `rsAccountId` already flows through. Fetch accounts in `Home.tsx`:

```tsx
  const { data: rsAccounts = [] } = useQuery<RsAccount[]>({ queryKey: ["/api/rs-accounts"] });
```

(import `type RsAccount` from `@shared/schema`) and pass `rsAccounts={rsAccounts}` to `<FlipCardGrid>`; add `rsAccounts: RsAccount[]` to `FlipCardGridProps` and thread `accountLabel` to each card:

```tsx
const accountLabel = (id?: string | null) => {
  if (rsAccounts.length === 0) return undefined;           // one-account users see no badge noise
  const a = rsAccounts.find((x) => x.id === id);
  return a ? `${a.displayName} (${a.accountType})` : "Unassigned";
};
```

In `FlipCard.tsx` add an optional prop `accountLabel?: string` and render, beside the item name, `{accountLabel && <Badge variant="outline" className="text-[10px]" data-testid="badge-flip-account">{accountLabel}</Badge>}` (import `Badge` as the grid does).

- [ ] **Step 4: Account filter in `FlipCardGrid.tsx`**

Add `const [accountFilter, setAccountFilter] = useState<string>("all");` and, in the existing filtering logic (the block around `flip.itemName.toLowerCase().includes(query)`, ~line 103), add:

```tsx
if (accountFilter === "unassigned" && flip.rsAccountId) return false;
if (accountFilter !== "all" && accountFilter !== "unassigned" && flip.rsAccountId !== accountFilter) return false;
```

and, only when `rsAccounts.length > 0`, render a `Select` beside the existing status/category selects (copy one of them) with values `all` ("All accounts"), `unassigned` ("Unassigned"), then one `SelectItem` per account (`value={a.id}`, label `${a.displayName} (${a.accountType})`), `data-testid="select-account-filter"`. Include `accountFilter` in the memo's dependency list.

- [ ] **Step 5: Verify in the browser**

Run `npx tsc --noEmit` → clean, then `npm run dev` and check:
1. A user with no RS accounts: the flip form and grid look exactly as before (no account select, no badge, no filter).
2. A user with accounts: pick an account on a flip, submit, reload — the picker still shows that account; flip cards show the account badge, old flips show "Unassigned"; the filter narrows to one account or to Unassigned.
3. Pick an item in Log Flip: range text appears; typing a buy price above the 30-day high shows the warning, a price inside the range shows none, and clearing the item clears both.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/FlipForm.tsx client/src/components/FlipCard.tsx client/src/components/FlipCardGrid.tsx client/src/pages/Home.tsx
git commit -m "feat: price range warning in Log Flip; account badge, filter and remembered default on flips

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Data-source tag on every market price

**Files:**
- Create: `client/src/components/SourceTag.tsx`
- Modify: `client/src/pages/Scanner.tsx`, `client/src/pages/MarketInsights.tsx`, `client/src/pages/MarketMovers.tsx`, `client/src/pages/Alerts.tsx`, `client/src/pages/Watchlist.tsx`, `client/src/components/FlipForm.tsx`, `client/src/components/PriceHistoryChart.tsx`

**Interfaces:**
- Consumes: `SOURCES`, `SourceKey` from `shared/priceSources.ts` (Task 3); `Tooltip`, `TooltipContent`, `TooltipTrigger` from `@/components/ui/tooltip` (a `TooltipProvider` already wraps the app in `App.tsx`).
- Produces: `<SourceTag source={SourceKey} className?: string />`.

Which source each price is (from `server/ge-api.ts`):

| Where | Source key | Why |
|---|---|---|
| Scanner BUY / SELL columns | `wiki-quote` | Hourly average when both sides traded that hour, else the latest single trade (the fallback is per item and is not exposed to the client, so the tooltip explains both). |
| Scanner detail: 7-day / 30-day range, Fair Value, Current Price | `weirdgloop` | Computed from `fullHistory.daily`. |
| Market Insights "GE Price", Log Flip "GE Price", Alerts and Watchlist "Current Price" | `wiki-quote` | Live price from the cached wiki quote. |
| Market Movers "Price", "24h Change", "7d Change" | `wiki-hourly` | Hourly mids now, 24h ago and 7d ago. |
| Price history chart, 24H and 7D | `wiki-series` | `getItemIntraday`. |
| Price history chart, 90D / 6M / 1Y / ALL | `weirdgloop` | `getItemPriceHistory`. |

User-entered prices (flip buy/sell, goal and alert targets) are not tagged.

- [ ] **Step 1: Create the component**

`client/src/components/SourceTag.tsx`:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SOURCES, type SourceKey } from "@shared/priceSources";

/** Small "where this number comes from" tag. The tooltip carries the longer explanation. */
export function SourceTag({ source, className = "" }: { source: SourceKey; className?: string }) {
  const s = SOURCES[source];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block text-[10px] font-normal normal-case tracking-normal text-muted-foreground/80 border border-border rounded px-1 align-middle cursor-help ${className}`}
          data-testid={`source-tag-${source}`}
        >
          {s.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{s.detail}</TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Scanner**

In `client/src/pages/Scanner.tsx`, import `SourceTag` from `@/components/SourceTag`, then:

- Scanner BUY header (`data-testid="header-buy"`): after `BUY <SortIcon columnKey="buyPrice" />{funnel(COLUMN_SPECS.buyPrice)}` add ` <SourceTag source="wiki-quote" className="ml-1" />`. Do the same for `header-sell`.
- In the detail panel, `Based on actual recorded prices` (`<span className="text-xs text-muted-foreground">`, ~line 412): change the span's contents to `Based on actual recorded prices <SourceTag source="weirdgloop" />`.
- In the value-gap block, after the `<p className="text-xs text-muted-foreground">Fair Value</p>` and `Current Price` labels (~lines 520 and 524) append ` <SourceTag source="weirdgloop" />` inside each `<p>`.

- [ ] **Step 3: Other pages and components**

- `client/src/pages/MarketInsights.tsx` ~line 103: `<div className="text-xs text-muted-foreground uppercase tracking-wide">GE Price</div>` → `GE Price <SourceTag source="wiki-quote" />`; ~line 283: after `GE Price: {formatFullPrice(selectedItem.price)} gp` add ` <SourceTag source="wiki-quote" />`.
- `client/src/components/FlipForm.tsx` ~line 837: `<span className="text-sm font-medium">GE Price</span>` → add `<SourceTag source="wiki-quote" />` right after it. Also add `<SourceTag source="weirdgloop" />` after the 30-day range text added in Task 8 Step 1 (the "normal" range line and the price warnings use `range30d`, which is Weird Gloop daily).
- `client/src/pages/MarketMovers.tsx` lines 170-178: after the text `Price`, `24h Change` and `7d Change` in their `TableHead` cells add ` <SourceTag source="wiki-hourly" />` (only on these three).
- `client/src/pages/Alerts.tsx` ~line 468 and `client/src/pages/Watchlist.tsx` ~line 313: after `Current Price` in each `<th>` add ` <SourceTag source="wiki-quote" />`.
- `client/src/components/PriceHistoryChart.tsx` ~line 365: directly after `<CardTitle className="text-base">{itemName}</CardTitle>` add `<SourceTag source={period === "24h" || period === "7d" ? "wiki-series" : "weirdgloop"} />`, so it follows the selected period.

Import `SourceTag` in each file.

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` → clean. Run `npm run dev` and check, logged in:
1. `/scanner`: BUY and SELL headers show a "Wiki" tag whose tooltip explains the hourly-else-latest rule; expand a row — the range block, Fair Value and Current Price show "Weird Gloop · daily".
2. `/movers`: Price, 24h Change and 7d Change headers show "Wiki · hourly".
3. Log Flip: pick an item — "GE Price" shows "Wiki"; the 30-day range hint shows "Weird Gloop · daily".
4. Open a chart and switch 24H → 7D → 90D → 1Y: the tag reads "Wiki · hourly series" for the first two and "Weird Gloop · daily" for the others.
5. Alerts and Watchlist "Current Price" columns show "Wiki"; narrow the window to phone width and confirm the tags wrap instead of overflowing.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/SourceTag.tsx client/src/pages client/src/components
git commit -m "feat: name the data source next to every market price

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Production rollout and end-to-end check

**Files:** none (operational). Bryan runs the two steps marked **Bryan**, because they need the production `DATABASE_URL` (a secret Claude does not write or read).

- [ ] **Step 1: Run all checks locally**

Run: `npx tsc --noEmit && npx tsx scripts/check-out-of-range.ts && npx tsx scripts/check-scanner-alerts.ts`
Expected: no tsc output, `check-out-of-range: ok`, and the existing scanner-alerts script's own success line.

- [ ] **Step 2: Create the table in production — Bryan**

Bryan runs, from the repo root, with the production connection string in his shell (not pasted into the chat):

```bash
DATABASE_URL="<production url>" npm run db:push
```

Expected: drizzle-kit reports one new table, `out_of_range_alerts`, and no changes or data-loss prompts for existing tables. If it proposes dropping anything, answer no and stop; report what it listed.

- [ ] **Step 3: Deploy**

Push to `main` (Vercel deploys from git). Do not push before Step 2 has succeeded: until the table exists the cron step fails closed (sends nothing, logs `cooldown read failed`), so an early push is safe but silent.

- [ ] **Step 4: Trigger one run and read the result**

Run: `gh workflow run "Scanner alerts" && sleep 20 && gh run list --workflow "Scanner alerts" --limit 1`
Expected: status `completed`, conclusion `success`. Then `gh run view --log` for that run and look for the cron response body: it now ends with `"outOfRange":{"found":N,"sent":M}`. `"error":"cooldown read failed"` means Step 2 did not take effect.

- [ ] **Step 5: Confirm an embed in Discord (when one is available)**

If `found` is 0, the market simply has nothing out of range right now — wait for later ticks (every 15 min) rather than forcing one. When `sent` is above 0, check the Discord channel for an embed with the item icon, the Normal range line, relative timestamps and the chart image. If the chart is missing, open the embed's image URL from a `console.log` of `chartUrl(...)` output in a browser to see whether QuickChart rejected the config.

- [ ] **Step 6: Record the session** — per `CLAUDE.local.md`, invoke the `worklog` skill.

---

## Self-review

**Spec coverage:** detector (Task 1), still-out-of-range rule (Task 1), liquidity floor and screen (Task 1), thresholds and tuning (Tasks 1, 6), cron on every tick independent of presets (Task 5), cap of 5 and un-cooled overflow (Task 5), cooldown table and fail-closed (Tasks 2, 4, 5), Flopper-style embed with relative times and QuickChart fallback (Task 3), shared cached endpoint with Scanner badge/filter (Tasks 4, 7), Log Flip warning (Task 8), account remember/badge/Unassigned/filter (Task 8), `db:push` before deploy (Task 10). Out of scope items have no tasks.

**Type consistency:** `Detection`, `HourlyPoint`, `DailyPoint`, `LatestQuote`, `CooldownRow`, `Direction` are defined once in `shared/outOfRange.ts` and imported everywhere. `EmbedHit.latest` matches `getLatest()` values. `OutOfRangeHit = EmbedHit`. `pickToSend` (Task 5) replaces the inline filter from Task 4 and Task 4's import list is updated in Task 5.

**Source labels (added after the plan was first written):** Task 3 creates `shared/priceSources.ts` and the embed footer; Task 9 adds the `SourceTag` to the Scanner, Market Insights, Movers, Alerts, Watchlist, Log Flip and chart prices. The Scanner BUY/SELL tag is per column, not per item, because whether a row used the hourly average or the latest trade is decided inside `getAllItemsForScanner` and is not on `ScannerItem`.

**Known limits to tell Bryan:** the sampling report only sees daily prices, so it under-counts intraday spikes; the Scanner badge list refreshes every 5 minutes at most; the embed chart depends on QuickChart being reachable.
