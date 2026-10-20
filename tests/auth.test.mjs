import test from "node:test";
import assert from "node:assert/strict";
import {
  newSession,
  tokenHash,
  hashPassword,
  checkPassword,
  sessionUser,
  allows,
  branchFilter,
  sameOrigin,
  cookieName,
} from "../src/lib/authCore.mjs";
test("Passwords are salted hashes and reject invalid records", async () => {
  const a = await hashPassword("test-only-long-password"),
    b = await hashPassword("test-only-long-password");
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(await checkPassword("test-only-long-password", a), true);
  assert.equal(await checkPassword("incorrect", a), false);
  assert.equal(await checkPassword("incorrect", { hash: "bad" }), false);
});
test("Sessions use unpredictable opaque tokens and only hashes are stored", () => {
  const a = newSession(),
    b = newSession();
  assert.match(a.token, /^[a-f0-9]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.hash, a.token);
  assert.equal(a.hash, tokenHash(a.token));
  assert.ok(a.expiresAt > Date.now());
});
test("Expired, disabled and revoked sessions are rejected", () => {
  const user = {
    _id: "u",
    name: "Test",
    username: "test",
    role: "Admin",
    authVersion: 2,
    removed: false,
    credentials: { hash: "private" },
  };
  const session = { version: 2, expiresAt: new Date(Date.now() + 10000) };
  assert.equal(sessionUser(session, user).id, "u");
  assert.equal("credentials" in sessionUser(session, user), false);
  assert.equal(sessionUser({ ...session, expiresAt: new Date(0) }, user), null);
  assert.equal(sessionUser(session, { ...user, removed: true }), null);
  assert.equal(sessionUser(session, { ...user, authVersion: 3 }), null);
  assert.equal(sessionUser(session, null), null);
});
test("Server permission checks reject missing or forged roles", () => {
  assert.equal(allows(null, "users"), false);
  assert.equal(
    allows(
      { role: "Unknown", permissions: { users: { view: true } } },
      "users"
    ),
    false
  );
  assert.equal(
    allows({ role: "Employee", removed: false }, "employees"),
    false
  );
  assert.equal(
    allows({ role: "Branch Manager", removed: false }, "users"),
    false
  );
  assert.equal(allows({ role: "Admin", removed: false }, "users"), true);
});
test("Branch filters fail closed without assignment", () => {
  assert.deepEqual(branchFilter({ role: "Admin" }), {});
  assert.deepEqual(branchFilter({ role: "Branch Manager", branchId: "b1" }), {
    branchId: "b1",
  });
  assert.deepEqual(branchFilter({ role: "Branch Manager" }), {
    branchId: "__unassigned__",
  });
});
test("Mutation requests require an exact origin and production uses host-only secure cookie name", () => {
  const request = (origin) =>
    new Request("http://localhost:5173/api/users", {
      method: "POST",
      headers: origin ? { origin } : {},
    });
  assert.equal(sameOrigin(request("http://localhost:5173")), true);
  for (const origin of [
    null,
    "null",
    "https://evil.example",
    "http://localhost:5174",
  ])
    assert.equal(sameOrigin(request(origin)), false);
  assert.equal(cookieName(true), "__Host-horizon-session");
  assert.equal(cookieName(false), "horizon-session");
});

test("Render uses its trusted external URL behind an internal proxy", () => {
  const request = (origin) =>
    new Request("http://localhost:10000/api/auth/login", {
      method: "POST",
      headers: {
        origin,
        host: "localhost:10000",
        "x-forwarded-host": "evil.example",
      },
    });
  const environment = { RENDER_EXTERNAL_URL: "https://portal.onrender.com" };
  assert.equal(
    sameOrigin(request("https://portal.onrender.com"), environment),
    true
  );
  assert.equal(sameOrigin(request("https://evil.example"), environment), false);
  assert.equal(
    sameOrigin(request("http://localhost:10000"), environment),
    false
  );
  assert.equal(
    sameOrigin(request("https://portal.onrender.com"), {
      ...environment,
      APP_ORIGIN: "https://wrong.example",
    }),
    true
  );
  assert.equal(
    sameOrigin(request("https://custom.example"), {
      ...environment,
      APP_ORIGIN: "  https://CUSTOM.example/  ",
    }),
    true
  );
  assert.equal(
    sameOrigin(request("https://portal.onrender.com"), {
      ...environment,
      APP_ORIGIN: "invalid",
    }),
    true
  );
  assert.equal(
    sameOrigin(request("http://localhost:10000"), { APP_ORIGIN: "invalid" }),
    false
  );
  assert.equal(
    sameOrigin(
      request("https://portal.onrender.com.evil.example"),
      environment
    ),
    false
  );
});
test("Cross-site fetch metadata is rejected even for an allowed origin", () => {
  const request = new Request("http://localhost:10000/api/auth/login", {
    headers: {
      origin: "https://portal.onrender.com",
      "sec-fetch-site": "cross-site",
    },
  });
  assert.equal(
    sameOrigin(request, { RENDER_EXTERNAL_URL: "https://portal.onrender.com" }),
    false
  );
});
import { loginErrorMessage } from "../src/data/loginErrors.mjs";
test("Login distinguishes settings, credentials and throttling without exposing arbitrary errors", () => {
  assert.match(
    loginErrorMessage(Error("Invalid request origin.")),
    /address settings/
  );
  assert.equal(
    loginErrorMessage(Error("Username or password is incorrect.")),
    "Username or password is incorrect."
  );
  assert.match(
    loginErrorMessage(
      Error("Too many login attempts. Please try again later.")
    ),
    /15 minutes/
  );
  assert.match(
    loginErrorMessage(Error("Sign-in is temporarily unavailable.")),
    /temporarily unavailable/
  );
  assert.equal(
    loginErrorMessage(Error("private internal diagnostic")),
    loginErrorMessage(null)
  );
});
