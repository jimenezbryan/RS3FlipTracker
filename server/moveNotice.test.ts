import { test } from "node:test";
import assert from "node:assert/strict";
import { moveNotice } from "./moveNotice";

test("no move date set: no notice", () => {
  assert.equal(moveNotice(undefined), null);
  assert.equal(moveNotice(""), null);
  assert.equal(moveNotice("   "), null);
});

test("an unreadable date shows no notice instead of a broken one", () => {
  assert.equal(moveNotice("next tuesday"), null);
});

test("a move date gives the new address and the moment as an ISO instant", () => {
  assert.deepEqual(moveNotice("2026-10-28T20:00:00-04:00"), {
    moveAt: "2026-10-29T00:00:00.000Z",
    newUrl: "https://rs3-flip-tracker.lovable.app",
  });
});

test("a date without a time zone is refused, so the banner never shows the wrong hour", () => {
  assert.equal(moveNotice("2026-10-28T20:00"), null);
  assert.equal(moveNotice("2026-10-28"), null);
  assert.notEqual(moveNotice("2026-10-29T00:00:00Z"), null);
});
