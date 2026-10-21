import { test } from "node:test";
import assert from "node:assert/strict";
import { retry } from "./retry";

test("retries a failing call and returns the first success", async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await retry(async () => {
    calls++;
    if (calls < 3) throw new Error("Authentication timed out");
    return "ok";
  }, [1000, 2000], async (ms) => { waits.push(ms); });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1000, 2000]);
});

test("gives up after the last delay and rethrows the last error", async () => {
  let calls = 0;
  await assert.rejects(
    retry(async () => { calls++; throw new Error(`fail ${calls}`); }, [1, 1], async () => {}),
    /fail 3/,
  );
  assert.equal(calls, 3);
});

test("does not wait when the first call succeeds", async () => {
  const waits: number[] = [];
  assert.equal(await retry(async () => 7, [1000], async (ms) => { waits.push(ms); }), 7);
  assert.deepEqual(waits, []);
});
