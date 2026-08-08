/**
 * What is the market reacting to? Run: npx tsx scripts/update-radar.ts
 *
 * ponytail: a thin printer over server/update-radar.ts, same as alch-scan.ts. The detection
 * lives in one place, shared with /api/radar/themes and the Update Radar page.
 */
import assert from "node:assert/strict";
import { getUpdateRadar } from "../server/update-radar";

const r = await getUpdateRadar();

// The failure this catches actually shipped: a thin side quoting 1gp printed Bolt of cloth at
// +117,600%, which dragged the percentile up and pushed the real cluster out of detection.
// Nothing in RS3 moves 10x in a day, so a four-digit move is a bad quote, not an event.
const worst = r.topMovers[0];
assert.ok(
  !worst || Math.abs(worst.changePct) < 1000,
  `${worst?.name} at ${worst?.changePct.toFixed(0)}% is a quote artefact, not a move ` +
    `(${worst?.priceWas} -> ${worst?.price}gp) — the book filter has regressed`,
);

console.log(
  `\n${r.universeCount} liquid two-sided items · ${r.moverCount} movers ` +
    `(|24h| >= ${r.moverThresholdPct}%, the 95th percentile)\n`,
);

if (r.themes.length === 0) {
  console.log("No coherent theme today. On a day with no update, that is the right answer.\n");
} else {
  console.log("THEMES — words over-represented among movers, moving in one direction:\n");
  for (const t of r.themes) {
    console.log(
      `  ${t.token.padEnd(14)} ${String(t.moverCount).padStart(2)} movers  ` +
        `${t.lift.toFixed(1)}x baseline  ${(t.coherence * 100).toFixed(0)}% ${t.direction.toUpperCase()}  ` +
        `median ${t.medianMovePct}%`,
    );
    for (const i of t.items.slice(0, 4)) {
      console.log(
        `      ${i.name.slice(0, 34).padEnd(35)} ${i.changePct > 0 ? "+" : ""}${i.changePct.toFixed(1)}%` +
          `  ${i.priceWas.toLocaleString()} -> ${i.price.toLocaleString()} gp  vol ${i.volume.toLocaleString()}`,
      );
    }
    console.log();
  }
}

console.log("TOP MOVERS (clustered or not):");
for (const i of r.topMovers.slice(0, 10)) {
  console.log(
    `  ${i.name.slice(0, 34).padEnd(35)} ${i.changePct > 0 ? "+" : ""}${i.changePct.toFixed(1)}%` +
      `  vol ${i.volume.toLocaleString()}`,
  );
}
console.log();
