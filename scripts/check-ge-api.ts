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
    `${gainers.length} gainers`,
);
