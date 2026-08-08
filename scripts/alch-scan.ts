/**
 * Top high-alchemy items for an Alchemiser mk. II. Run: npx tsx scripts/alch-scan.ts
 *
 * ponytail: a thin printer over server/alch.ts, which is what /api/alch/scan and the
 * Alchemy page also call. The maths lives in one place; this is just a terminal view of it.
 *
 * The asserts below guard the machine constants against the wiki's own worked example, so a
 * mistyped constant fails loudly here instead of quietly skewing every row in the UI.
 */
import assert from "node:assert/strict";
import {
  getAlchOpportunities,
  ITEMS_PER_DAY,
  CHARGE_PER_ITEM,
  CHARGES_PER_DIVINE_CHARGE,
} from "../server/alch";

// "600 items per day at a cost of 3,600 machine charge (approximately 1.2 divine charges)"
assert.equal(ITEMS_PER_DAY * CHARGE_PER_ITEM, 3600, "daily charge cost no longer matches the wiki");
assert.equal(
  (ITEMS_PER_DAY * CHARGE_PER_ITEM) / CHARGES_PER_DIVINE_CHARGE,
  1.2,
  "divine charge conversion no longer matches the wiki",
);

const minVolume = Number(process.argv[2]) || undefined;
const r = await getAlchOpportunities(minVolume);

const gp = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`;

console.log(
  `\nAlchemiser mk. II — nature rune ${r.naturePrice}gp, divine charge ${r.chargePrice}gp ` +
    `(${r.chargeCostPerItem}gp of charge per item)\n` +
    `Overhead ${r.overheadPerItem}gp per alch · ${r.itemsPerDay} items/day · buying at instant-buy\n`,
);
console.log(
  `${r.qualifyingCount} items pass volume >= ${r.minVolume.toLocaleString()} and the 500,000gp ` +
    `machine cap; ${r.profitableCount} of those alch at a profit.\n`,
);

if (r.rows.length === 0) {
  console.log("Nothing clears the overhead right now. That is a real answer, not an error.\n");
} else {
  console.log(
    "ITEM".padEnd(28) + "BUY".padStart(9) + "ALCH".padStart(8) + "PROFIT".padStart(9) +
      "LIMIT".padStart(8) + "CAP/DAY".padStart(9) + "PROFIT/DAY".padStart(12) + "  VOL/DAY",
  );
  for (const row of r.rows) {
    console.log(
      row.name.slice(0, 27).padEnd(28) +
        gp(row.buyPrice).padStart(9) +
        gp(row.highalch).padStart(8) +
        `${row.profitPerItem}`.padStart(9) +
        row.geLimit.toLocaleString().padStart(8) +
        row.dailyCap.toLocaleString().padStart(9) +
        gp(row.dailyProfit).padStart(12) +
        `  ${gp(row.volume)}`,
    );
  }
  console.log();
}
