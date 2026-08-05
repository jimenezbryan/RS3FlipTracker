/**
 * Self-check for the login session write.
 * Run: DATABASE_URL="postgres://unused/check" npx tsx scripts/check-session-persist.ts
 * (the URL is never dialled — importing replitAuth pulls in db.ts, which demands one at load)
 *
 * ponytail: no network, no DB, no framework. It guards one thing — that a login path never
 * responds before the session row is durably written. That ordering is the entire bug:
 * Vercel freezes the lambda when the response flushes, so a store write still in flight at
 * that moment is simply lost, and the user gets a cookie pointing at a session that does
 * not exist. Fakes stand in for passport and express-session.
 */
import assert from "node:assert/strict";
import { loginAndSave } from "../server/replitAuth";

const later = (fn: () => void) => setTimeout(fn, 5);

// ── 1. The response cannot go out before the store write finishes ────────────────
// Both callbacks are deliberately async. If loginAndSave ever stops awaiting save(),
// `saved` is still false when the promise resolves and this fails.
let saved = false;
const req: any = {
  login: (_u: any, cb: (e?: any) => void) => later(() => cb()),
  session: {
    save: (cb: (e?: any) => void) =>
      later(() => {
        saved = true;
        cb();
      }),
  },
};

await loginAndSave(req, { claims: { sub: "u1" } });
assert.equal(saved, true, "resolved before session.save completed — the row can be lost");

// ── 2. The user reaches passport unchanged ───────────────────────────────────────
let seen: any;
const req2: any = {
  login: (u: any, cb: (e?: any) => void) => {
    seen = u;
    later(() => cb());
  },
  session: { save: (cb: (e?: any) => void) => later(() => cb()) },
};
const sessionUser = { claims: { sub: "u2" }, authProvider: "email" };
await loginAndSave(req2, sessionUser);
assert.deepEqual(seen, sessionUser, "sessionUser was mutated on the way to req.login");

// ── 3. Both failure modes reject, so the route 500s instead of lying ─────────────
// A silent save failure is the worst outcome: 200 OK, valid cookie, no session.
const loginFails: any = {
  login: (_u: any, cb: (e?: any) => void) => later(() => cb(new Error("login boom"))),
  session: { save: (cb: (e?: any) => void) => later(() => cb()) },
};
await assert.rejects(() => loginAndSave(loginFails, {}), /login boom/, "login error swallowed");

const saveFails: any = {
  login: (_u: any, cb: (e?: any) => void) => later(() => cb()),
  session: { save: (cb: (e?: any) => void) => later(() => cb(new Error("save boom"))) },
};
await assert.rejects(() => loginAndSave(saveFails, {}), /save boom/, "save error swallowed");

console.log("ok — login resolves only after the session row is written; both errors propagate");
