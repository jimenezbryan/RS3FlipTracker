/**
 * Self-check for theme detection. Run: npx tsx scripts/check-market-themes.ts
 * Offline, assert-based, no framework.
 *
 * These fixtures encode the failure the first prototype actually hit: with a fixed 8%
 * threshold, 44% of the universe counted as "moving", every token tied at the lift ceiling,
 * and the top cluster contained items moving in opposite directions. Each assertion below
 * fails if any of those come back.
 */
import assert from "node:assert/strict";
import { detectThemes, tokenize, type ThemeCandidate } from "../shared/marketThemes";

/** Filler so the universe is big enough for a percentile to mean something.
 *  Values are distinct on purpose: ties at the percentile cut sweep every tied item into
 *  the mover set, which dilutes lift and is a fixture artefact, not a real-market one. */
const noise = (n: number): ThemeCandidate[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `Filler item ${i}`,
    examine: "Nothing interesting.",
    changePct: i * 0.001, // 0%..0.1%, all distinct, none of it a real move
  }));

// ── 1. A real cluster is found ──────────────────────────────────────────────────
const farming: ThemeCandidate[] = [
  { name: "Magic seed", examine: "Plant in a tree patch.", changePct: 42 },
  { name: "Yew seed", examine: "Plant in a tree patch.", changePct: 38 },
  { name: "Palm tree seed", examine: "Plant in a fruit tree patch.", changePct: 35 },
  { name: "Snapdragon seed", examine: "Plant in a herb patch.", changePct: 51 },
  { name: "Torstol seed", examine: "Plant in a herb patch.", changePct: 47 },
];
const found = detectThemes([...noise(100), ...farming]);
const seed = found.themes.find((t) => t.token === "seed");
assert.ok(seed, `"seed" cluster not detected; got ${found.themes.map((t) => t.token).join(", ")}`);
assert.equal(seed!.moverCount, 5, "all five seeds should be in the cluster");
assert.equal(seed!.direction, "up");
assert.equal(seed!.coherence, 1, "all five moved the same way");
assert.ok(seed!.lift > 5, `lift should be strong, got ${seed!.lift.toFixed(1)}`);
assert.ok(
  found.themes[0].token === "seed" || found.themes[0].token === "plant" || found.themes[0].token === "patch",
  `the farming tokens should rank first, got "${found.themes[0].token}"`,
);

// The farming fixture shares "plant" and "patch" across the same five items. One event should
// be one card, so only the strongest of a co-occurring set survives — this is what stopped the
// live radar rendering "seed" and "plant" as two identical panels.
assert.equal(
  found.themes.filter((t) => t.items.length === 5 && t.items.every((i) => i.name.includes("seed"))).length,
  1,
  `co-occurring tokens over identical items should collapse to one theme, got ${found.themes.map((t) => t.token).join(", ")}`,
);

// ── 2. Direction incoherence kills a cluster ────────────────────────────────────
// The prototype's "hatchet" result: one item +139%, two down. Shared vocabulary, opposite
// moves — that is noise wearing a theme's clothes, and it must not be reported.
const hatchets: ThemeCandidate[] = [
  { name: "Adamant hatchet", examine: "A axe.", changePct: 139 },
  { name: "Bronze hatchet", examine: "A axe.", changePct: -45 },
  { name: "Steel hatchet", examine: "A axe.", changePct: -38 },
  { name: "Rune hatchet", examine: "A axe.", changePct: -41 },
];
const incoherent = detectThemes([...noise(100), ...hatchets]);
assert.ok(
  !incoherent.themes.some((t) => t.token === "hatchet"),
  "a cluster split 1-up/3-down must not be reported as a theme",
);

// One flipped item inside an otherwise coherent cluster is tolerated (80% default).
const mostlyUp = [...farming, { name: "Limpwurt seed", examine: "Plant in a flower patch.", changePct: -44 }];
const tolerant = detectThemes([...noise(100), ...mostlyUp]);
const seed2 = tolerant.themes.find((t) => t.token === "seed");
assert.ok(seed2, "5-of-6 in one direction should still qualify");
assert.ok(seed2!.coherence < 1 && seed2!.coherence >= 0.8, `coherence should be ~0.83, got ${seed2!.coherence}`);

// ── 3. Cluster size floor ───────────────────────────────────────────────────────
const tiny = detectThemes([
  ...noise(100),
  { name: "Rare seed", examine: "Plant it.", changePct: 90 },
  { name: "Odd seed", examine: "Plant it.", changePct: 88 },
]);
assert.ok(
  !tiny.themes.some((t) => t.token === "seed"),
  "two items sharing a word is a coincidence, not a theme",
);

// ── 4. A calm market reports nothing ────────────────────────────────────────────
// The percentile always selects a top 5%, so the size and coherence gates are what stop it
// inventing a theme out of ordinary drift. Reporting "no theme" must remain possible.
const calm = detectThemes(noise(200));
assert.equal(calm.themes.length, 0, "a calm market must produce no themes");
assert.ok(calm.universeCount === 200, "universe count should be reported even with no themes");

// ── 5. Degenerate input ─────────────────────────────────────────────────────────
assert.deepEqual(detectThemes([]).themes, [], "empty universe");
assert.equal(detectThemes(noise(5)).themes.length, 0, "too small to percentile");
assert.equal(detectThemes(noise(5)).universeCount, 5);

// ── 6. Tokenizer ────────────────────────────────────────────────────────────────
assert.deepEqual(tokenize("Magic seed"), ["magic", "seed"]);
assert.ok(!tokenize("Plant this with the seed").includes("the"), "stop words must be dropped");
assert.ok(!tokenize("A ox").includes("ox"), "words under 3 letters are dropped");
assert.deepEqual(tokenize("Seed seed SEED"), ["seed"], "tokens dedupe per item");

console.log(
  `ok — themes: "seed" found at ${seed!.lift.toFixed(1)}x with ${seed!.moverCount} movers, ` +
    `incoherent hatchet cluster rejected, calm market reported ${calm.themes.length} themes`,
);
