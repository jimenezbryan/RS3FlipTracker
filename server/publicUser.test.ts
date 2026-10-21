import { test } from "node:test";
import assert from "node:assert/strict";
import { toPublicUser } from "./publicUser";

test("drops the password hash and keeps every other field", () => {
  const row = { id: "u1", email: "a@b.c", firstName: "A", password: "$2b$12$hash", isAdmin: false };
  const out = toPublicUser(row);
  assert.equal("password" in out, false);
  assert.deepEqual(out, { id: "u1", email: "a@b.c", firstName: "A", isAdmin: false });
  assert.equal(row.password, "$2b$12$hash", "must not mutate the stored row");
});

test("passes through a missing user", () => {
  assert.equal(toPublicUser(undefined), undefined);
});
