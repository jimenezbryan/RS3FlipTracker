/**
 * Self-check for the GE price layer. Run: npx tsx scripts/check-ge-api.ts
 *
 * ponytail: one assert-based file, no framework, no fixtures. It guards the three things
 * that rot silently — the upstream contract, the no-fabrication rule, and the decimal
 * boundary. It hits the live wiki API, so it needs network and is not a unit test.
 */
import assert from "node:assert/strict";
import {
  USER_AGENT,
  searchItems,
  getItemPrice,
  getAllItemsForScanner,
  getMarketMovers,
} from "../server/ge-api";

const BASE = "https://prices.runescape.wiki/api/v2/rs";
const get = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": USER_AGENT } });
  assert.equal(res.ok, true, `${path} returned ${res.status}`);
  return res.json() as any;
};

// ── 1. Upstream contract ────────────────────────────────────────────────────────
// Fails loudly if the wiki changes shape, rather than silently zeroing every margin.
const latest = await get("/latest?id=2");
const tick = latest.data["2"];
assert.equal(typeof tick.high, "number", "/latest lost .high");
assert.equal(typeof tick.low, "number", "/latest lost .low");
assert.equal(typeof tick.highTime, "number", "/latest lost .highTime");

const mapping = await get("/mapping");
assert.ok(Array.isArray(mapping), "/mapping is not an array");
assert.ok(mapping.length > 7000, `/mapping shrank to ${mapping.length}`);
assert.ok(
  mapping.every((m: any) => typeof m.limit === "number"),
  "/mapping lost .limit — buy limits drive potentialProfit",
);

const hourly = await get("/1h");
const anyHour: any = Object.values(hourly.data)[0];
assert.ok("avgHighPrice" in anyHour && "highPriceVolume" in anyHour, "/1h lost its fields");

// ── 2. Name resolution works without WeirdGloop ─────────────────────────────────
const whip = await searchItems("abyssal whip");
assert.ok(whip.length > 0, "searchItems found no abyssal whip");
const exact = await getItemPrice("Abyssal whip");
assert.ok(exact, "getItemPrice returned null for a known item");
assert.equal(exact!.id, 4151, `whip resolved to ${exact!.id}`);
assert.ok((exact!.geLimit ?? 0) > 0, "no GE buy limit on the whip");
assert.ok(exact!.high != null && exact!.low != null, "no bid/ask on the whip");

// ── 3. No fabrication ───────────────────────────────────────────────────────────
// The original bug hardcoded margin to Math.round(price * 0.01) for every item, which
// also pinned `trend` and `volatility` to a single value each. These assertions fail in
// exactly that shape if it is ever reintroduced.
const items = await getAllItemsForScanner();
assert.ok(items.length > 500, `only ${items.length} scanner items`);

// Ids must be unique. /mapping ships a dozen ids twice (a base name and a tier alias
// sharing one id), and the scanner renders rows keyed by id — duplicates collided React's
// keys, which broke reconciliation so rows went stale and survived filter changes. Every
// filter looked broken at once. This is the assertion that catches it coming back.
assert.equal(
  new Set(items.map((i) => i.id)).size,
  items.length,
  "duplicate item ids — scanner rows share a React key and reconciliation breaks",
);

// Money arithmetic, end to end. netProfit and roi are what the user trades on.
for (const i of items) {
  const taxPerItem = i.sellPrice <= 49 ? 0 : Math.floor(i.sellPrice * 0.02);
  assert.equal(
    i.fillQty,
    Math.min(i.geLimit, Math.floor(i.volume / 6)),
    `fillQty is not min(buy limit, 24h volume / 6) on ${i.name}`,
  );
  assert.equal(
    i.netProfit,
    (i.margin - taxPerItem) * i.fillQty,
    `netProfit is not (margin - 2% tax) * fillQty on ${i.name}`,
  );
  if (i.buyPrice > 0) {
    const expected = Math.round(((i.margin - taxPerItem) / i.buyPrice) * 10000) / 100;
    assert.ok(
      Math.abs(expected - i.roi) <= 0.02,
      `roi ${i.roi} does not match per-unit net/buyPrice ${expected} on ${i.name}`,
    );
  }
}

// ── 3a. Profit is capped by what the item actually trades ───────────────────────
// netProfit used to be margin * geLimit — profit if you filled the whole buy limit. The
// median item trades ~400 units a day against limits in the thousands, so the default
// sort was topped by items nobody can buy: 6 of the top 12 could not move ONE unit in a
// 4h window. These fail if the cap is removed or quietly widened back to geLimit.
assert.ok(
  items.every((i) => i.fillQty <= i.geLimit),
  "fillQty exceeds the buy limit — you cannot buy more than the limit in one window",
);
const capped = items.filter((i) => i.fillQty < i.geLimit);
assert.ok(
  capped.length > items.length * 0.2,
  `only ${capped.length}/${items.length} items are volume-capped — the cap is not binding`,
);
const topByNet = [...items].sort((a, b) => b.netProfit - a.netProfit).slice(0, 20);
assert.ok(
  topByNet.every((i) => i.fillQty > 0),
  `an unfillable item ranks in the top 20 by netProfit: ${topByNet.find((i) => i.fillQty === 0)?.name}`,
);

// hourVolume is the "can I flip this right now" number. It was computed and discarded.
assert.ok(
  items.every((i) => Number.isInteger(i.hourVolume) && i.hourVolume >= 0),
  "hourVolume is not a non-negative integer",
);
assert.ok(
  items.filter((i) => i.hourVolume > 0).length > 100,
  "hourVolume is zero everywhere — it is not being carried through from /1h",
);

const onePct = items.filter((i) => i.margin === Math.round(i.buyPrice * 0.01));
assert.ok(
  onePct.length < items.length * 0.05,
  `${onePct.length}/${items.length} items have exactly a 1% margin — fabrication is back`,
);
assert.ok(new Set(items.map((i) => i.volatility)).size > 1, "volatility is constant");
assert.ok(new Set(items.map((i) => i.trend)).size > 1, "trend is constant");
assert.ok(
  items.every((i) => i.margin === i.sellPrice - i.buyPrice),
  "margin is not sellPrice - buyPrice",
);

// ── 3b. changePct24h carries magnitude, not just direction ──────────────────────
// Scanner.tsx gates its momentum signals on |changePct24h|. When only the bucketed `trend`
// existed those signals fired on direction alone, which was true of ~half the game. A null
// here must stay null: coercing "no 24h anchor" to 0 silently means "did not move".
assert.ok(
  items.every((i) => i.changePct24h === null || Number.isFinite(i.changePct24h)),
  "changePct24h is neither null nor a finite number",
);
const withChange = items.filter((i) => i.changePct24h !== null);
assert.ok(
  withChange.length > items.length * 0.25,
  `only ${withChange.length}/${items.length} items have a 24h anchor`,
);
assert.ok(
  new Set(withChange.map((i) => i.changePct24h)).size > 100,
  "changePct24h is degenerate — momentum signals have nothing to gate on",
);
assert.ok(
  withChange.some((i) => i.changePct24h! < 0) && withChange.some((i) => i.changePct24h! > 0),
  "changePct24h never goes both directions",
);

// ── 3c. The AI estimate actually looks at the item ──────────────────────────────
// It used to be calculateSmartPricing(price, null, null), which returns the tier baseline
// unchanged: 4 distinct values across every item, confidence "low" on all of them, shown in
// the UI as a per-item estimate. These fail if it regresses to a per-tier constant.
assert.ok(
  new Set(items.map((i) => i.suggestedMarginPct)).size > 100,
  "suggestedMarginPct is a per-tier constant again, not a per-item estimate",
);
assert.ok(
  new Set(items.map((i) => i.confidence)).size > 1,
  "confidence is constant — it conveys nothing",
);
assert.ok(
  items.every((i) => i.suggestedBuyPrice <= i.suggestedSellPrice),
  "suggested buy price exceeds suggested sell price",
);
assert.ok(
  items.every(
    (i) =>
      Number.isInteger(i.suggestedBuyPrice) && Number.isInteger(i.suggestedSellPrice),
  ),
  "suggested prices carry decimals — price columns are bigint",
);

// ── 4. Decimal boundary ─────────────────────────────────────────────────────────
// The wiki's hourly averages carry decimals; every price column is bigint, and Postgres
// rejects 786.4. Rounding happens once, in ge-api, so nothing downstream has to know.
for (const i of items) {
  assert.equal(i.buyPrice, Math.round(i.buyPrice), `decimal buyPrice on ${i.name}`);
  assert.equal(i.sellPrice, Math.round(i.sellPrice), `decimal sellPrice on ${i.name}`);
  assert.equal(i.margin, Math.round(i.margin), `decimal margin on ${i.name}`);
}

// ── 5. Market movers report real movement ───────────────────────────────────────
// The old implementation defaulted a missing anchor to the current price, so items that
// had not moved showed up as 0% "movers".
const { gainers, losers } = await getMarketMovers();
assert.ok(gainers.length > 0, "no gainers");
assert.ok(
  [...gainers, ...losers].every((m) => m.changePercent24h !== 0 && m.price24hAgo != null),
  "a mover has no 24h anchor — reporting non-movement as movement",
);

const spreads = items.map((i) => i.margin / i.buyPrice).sort((a, b) => a - b);
console.log(
  `ok — ${items.length} scanner items, ${onePct.length} at exactly 1%, ` +
    `median spread ${(spreads[Math.floor(spreads.length / 2)] * 100).toFixed(2)}%, ` +
    `${withChange.length} with a 24h anchor, ${gainers.length} gainers`,
);
