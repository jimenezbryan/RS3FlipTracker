import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { readOnlyGuard } from "./readOnly";

const NEW_ADDRESS = "https://rs3-flip-tracker.lovable.app";

// A stand-in for the real app: the guard in front of in-memory routes, invented data only.
async function startApp(env: Record<string, string | undefined>) {
  const flips: { item: string }[] = [{ item: "Invented item" }];
  let discordPosts = 0;
  const app = express();
  app.use(express.json());
  app.use(readOnlyGuard(env));
  app.get("/api/flips", (_req, res) => res.json(flips));
  app.post("/api/flips", (req, res) => { flips.push(req.body); res.status(201).json(req.body); });
  app.patch("/api/flips/:id", (_req, res) => res.json({ ok: true }));
  app.delete("/api/flips/:id", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/login", (_req, res) => res.json({ success: true }));
  app.post("/api/logout", (_req, res) => res.json({ success: true }));
  app.post("/api/cron/alerts", (_req, res) => { discordPosts++; res.json({ sent: 1 }); });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (method: string, path: string, body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { call, flips, discordPosts: () => discordPosts, close: () => server.close() };
}

test("switch on: every write is refused with the moving message, reads still work", async (t) => {
  const app = await startApp({ READ_ONLY_MOVING_TO: NEW_ADDRESS });
  t.after(app.close);

  for (const [method, path] of [["POST", "/api/flips"], ["PATCH", "/api/flips/1"], ["DELETE", "/api/flips/1"], ["PUT", "/api/flips/1"]]) {
    const res = await app.call(method, path, { item: "Another invented item" });
    assert.equal(res.status, 503, `${method} ${path}`);
    const body = await res.json();
    assert.match(body.message, /moving/i);
    assert.ok(body.message.includes(NEW_ADDRESS), "message points to the new address");
  }
  assert.deepEqual(app.flips, [{ item: "Invented item" }], "nothing was written");

  const read = await app.call("GET", "/api/flips");
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), [{ item: "Invented item" }]);
});

test("switch on: Users can still sign in and out to read their data", async (t) => {
  const app = await startApp({ READ_ONLY_MOVING_TO: NEW_ADDRESS });
  t.after(app.close);
  assert.equal((await app.call("POST", "/api/auth/login", { email: "a@example.test", password: "x" })).status, 200);
  assert.equal((await app.call("POST", "/api/logout")).status, 200);
});

test("switch on: the cron endpoint does not post to Discord", async (t) => {
  const app = await startApp({ READ_ONLY_MOVING_TO: NEW_ADDRESS });
  t.after(app.close);
  const res = await app.call("POST", "/api/cron/alerts");
  assert.equal(res.status, 200, "stays green so the scheduled job doesn't page anyone");
  assert.equal((await res.json()).skipped, "read-only");
  assert.equal(app.discordPosts(), 0);
});

test("switch off: writes and the cron work again, with no data lost", async (t) => {
  const env: Record<string, string | undefined> = { READ_ONLY_MOVING_TO: NEW_ADDRESS };
  const app = await startApp(env);
  t.after(app.close);

  assert.equal((await app.call("POST", "/api/flips", { item: "Refused item" })).status, 503);

  env.READ_ONLY_MOVING_TO = undefined; // the rollback: lift the freeze
  assert.equal((await app.call("POST", "/api/flips", { item: "New invented item" })).status, 201);
  assert.deepEqual(
    await (await app.call("GET", "/api/flips")).json(),
    [{ item: "Invented item" }, { item: "New invented item" }],
    "the data from before the freeze is intact and the new write landed",
  );
  assert.equal((await app.call("POST", "/api/cron/alerts")).status, 200);
  assert.equal(app.discordPosts(), 1);
});

test("an empty setting counts as off", async (t) => {
  const app = await startApp({ READ_ONLY_MOVING_TO: "" });
  t.after(app.close);
  assert.equal((await app.call("POST", "/api/flips", { item: "Invented" })).status, 201);
});
