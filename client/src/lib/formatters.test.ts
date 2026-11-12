import { test } from "node:test";
import assert from "node:assert/strict";
import { formatGP } from "./formatters";
import { formatGp } from "@shared/taxCalculator";
import { formatGpShorthand } from "@shared/gpParser";

// #17, Option C: up to 2 decimals for M/B, up to 1 for K, trailing zeros dropped.
const cases: [number, string][] = [
  [2_500_000, "2.5M"],
  [2_860_000, "2.86M"],
  [3_000_000, "3M"],
  [1_500, "1.5K"],
  [500_000, "500K"],
  [4_300_000_000, "4.3B"],
  [999, "999"],
  [0, "0"],
  [-2_500_000, "-2.5M"],
  [-2_860_000, "-2.86M"],
  [-1_500, "-1.5K"],
  [-3_000_000_000, "-3B"],
];

for (const [name, fn] of [
  ["formatGP", formatGP],
  ["formatGp", formatGp],
  ["formatGpShorthand", formatGpShorthand],
] as const) {
  test(`${name} uses the one gp shorthand format`, () => {
    for (const [input, expected] of cases) assert.equal(fn(input), expected, `${name}(${input})`);
  });
}
