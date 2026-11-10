import { test } from "node:test";
import assert from "node:assert/strict";
import { formatGP } from "./formatters";

test("formatGP shortens a losing flip like a winning one", () => {
  assert.equal(formatGP(-2_500_000), "-2.50M");
  assert.equal(formatGP(-1_500), "-1.5K");
  assert.equal(formatGP(-3_000_000_000), "-3.00B");
});

test("formatGP leaves positive amounts as they were", () => {
  assert.equal(formatGP(2_500_000), "2.50M");
  assert.equal(formatGP(999), "999");
});
