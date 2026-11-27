import assert from "node:assert/strict";
import { test } from "node:test";
import { clerkConfigured, portalAuth, portalData, portalEnabled, previewPassword } from "../site-env.ts";
import { AREA_HOME, decideAccess, homeFor, isPortalPath, safeNext } from "./access.ts";
import { rolesFromClaims, verifyClerkToken } from "./clerk.ts";
import { sameSecret, signSession, verifySession, type Session } from "./session.ts";

/* Portal Batch 1: the preview session, the access rules and the guards. A dummy password only: the real one is never in tests. */

const SECRET = "dummy-preview-password-for-tests";
const NOW = Date.UTC(2026, 10, 27, 18, 0);
const session = (roles: Session["roles"], expInS = 3600): Session => ({
  sub: "acc-x",
  email: "x@example.com",
  name: "X",
  roles,
  exp: Math.floor(NOW / 1000) + expInS,
});

/* ── Session ─────────────────────────────────────────────────────────── */

test("a signed session verifies with the same secret, and only with it", async () => {
  const token = await signSession(session(["parent"]), SECRET);
  assert.deepEqual(await verifySession(token, SECRET, NOW), session(["parent"]));
  assert.equal(await verifySession(token, "another-secret-entirely", NOW), null);
});

test("a tampered, malformed or expired session is refused", async () => {
  const token = await signSession(session(["parent"]), SECRET);
  const [payload, sig] = token.split(".");
  // Turn the parent into an admin without re-signing.
  const forged = Buffer.from(JSON.stringify({ ...session(["admin"]) })).toString("base64url");
  assert.equal(await verifySession(`${forged}.${sig}`, SECRET, NOW), null);
  assert.equal(await verifySession(`${payload}.${sig}x`, SECRET, NOW), null);
  assert.equal(await verifySession(`${payload}`, SECRET, NOW), null);
  assert.equal(await verifySession(`${payload}.${sig}.extra`, SECRET, NOW), null);
  assert.equal(await verifySession(undefined, SECRET, NOW), null);
  assert.equal(await verifySession(await signSession(session(["parent"], -1), SECRET), SECRET, NOW), null);
  // Unknown roles never pass.
  const odd = await signSession({ ...session(["parent"]), roles: ["superuser" as never] }, SECRET);
  assert.equal(await verifySession(odd, SECRET, NOW), null);
});

test("passwords are compared in constant time and exactly", async () => {
  assert.equal(await sameSecret(SECRET, SECRET), true);
  assert.equal(await sameSecret(SECRET, SECRET + " "), false);
  assert.equal(await sameSecret("", SECRET), false);
});

/* ── Guards ──────────────────────────────────────────────────────────── */

const PW = { PREVIEW_DEFAULT_PASSWORD: "a-long-enough-password" };

test("the portal is mock on staging by default, never mock on the public site, and live only with Clerk", () => {
  assert.equal(portalData({}), "mock");
  assert.equal(portalData({ NEXT_PUBLIC_SITE_ENV: "production" }), "off");
  assert.equal(portalData({ NEXT_PUBLIC_SITE_ENV: "production", PORTAL_DATA: "mock" }), "off");
  assert.equal(portalData({ PORTAL_DATA: "off" }), "off");
  assert.equal(portalData({ PORTAL_DATA: "something" }), "off");
  assert.equal(portalData({ NEXT_PUBLIC_SITE_ENV: "production", PORTAL_DATA: "live" }), "live");

  assert.equal(portalAuth({ ...PW }), "preview");
  assert.equal(portalAuth({}), null, "no preview password: closed");
  assert.equal(portalAuth({ PREVIEW_DEFAULT_PASSWORD: "short" }), null, "a password under 12 characters keeps it closed");
  assert.equal(portalAuth({ ...PW, NEXT_PUBLIC_SITE_ENV: "production" }), null, "production never opens the preview");
  assert.equal(portalAuth({ ...PW, NEXT_PUBLIC_SITE_ENV: "production", PORTAL_DATA: "live" }), null, "live without Clerk keys: closed");
  const clerk = { CLERK_SECRET_KEY: "sk_test_x", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x" };
  assert.equal(clerkConfigured(clerk), true);
  assert.equal(portalAuth({ ...clerk, NEXT_PUBLIC_SITE_ENV: "production", PORTAL_DATA: "live" }), "clerk");
  assert.equal(portalEnabled({ NEXT_PUBLIC_SITE_ENV: "production" }), false);
  assert.equal(previewPassword({ PREVIEW_DEFAULT_PASSWORD: "x".repeat(12) }), "x".repeat(12));
});

test("which paths the portal guard covers", () => {
  for (const p of ["/login", "/forgot-password", "/a", "/a/live", "/p/overview", "/s/overview", "/t/today", "/preview/parent-dashboard", "/preview/parent-dashboard/all"]) {
    assert.equal(isPortalPath(p), true, p);
  }
  for (const p of ["/", "/about", "/programs/summer-ilm-camp", "/scholarship", "/teach", "/preview/sample-report", "/enroll", "/admin"]) {
    assert.equal(isPortalPath(p), false, p);
  }
});

test("closed portal: every portal path is a 404, public pages are untouched", () => {
  for (const p of ["/login", "/a/live", "/p/overview", "/preview/parent-dashboard"]) {
    assert.deepEqual(decideAccess({ pathname: p, enabled: false, session: null }), { action: "notFound" }, p);
  }
  assert.deepEqual(decideAccess({ pathname: "/about", enabled: false, session: null }), { action: "next" });
});

test("strangers go to sign-in with the page to return to; signed-in people skip the sign-in page", () => {
  assert.deepEqual(decideAccess({ pathname: "/p/overview", search: "?child=x", enabled: true, session: null }), {
    action: "redirect",
    to: "/login?next=%2Fp%2Foverview%3Fchild%3Dx",
  });
  assert.deepEqual(decideAccess({ pathname: "/login", enabled: true, session: null }), { action: "next" });
  assert.deepEqual(decideAccess({ pathname: "/login", enabled: true, session: { roles: ["teacher"] } }), { action: "redirect", to: "/t/today" });
});

test("each role sees only its own area; another area sends them to their own home", () => {
  const cases: [Session["roles"], string, string][] = [
    [["parent"], "/a/live", "/p/overview"],
    [["parent"], "/s/overview", "/p/overview"],
    [["student"], "/p/overview", "/s/overview"],
    [["teacher"], "/a/live", "/t/today"],
    [["admin", "billing_admin"], "/t/today", "/a/live"],
  ];
  for (const [roles, path, home] of cases) {
    assert.deepEqual(decideAccess({ pathname: path, enabled: true, session: { roles } }), { action: "redirect", to: home }, `${roles} → ${path}`);
  }
  assert.deepEqual(decideAccess({ pathname: "/a/live", enabled: true, session: { roles: ["admin", "billing_admin"] } }), { action: "next" });
  assert.deepEqual(decideAccess({ pathname: "/a", enabled: true, session: { roles: ["admin"] } }), { action: "redirect", to: AREA_HOME.a });
});

test("a ?next= target is followed only inside the person's own area", () => {
  assert.equal(safeNext("/p/overview", ["parent"]), "/p/overview");
  assert.equal(safeNext("/a/live", ["parent"]), "/p/overview");
  assert.equal(safeNext("https://evil.example/", ["parent"]), "/p/overview");
  assert.equal(safeNext("//evil.example/a", ["admin"]), "/a/live");
  assert.equal(safeNext("/\\evil", ["admin"]), "/a/live");
  assert.equal(safeNext("", ["student"]), "/s/overview");
  assert.equal(homeFor(["admin", "billing_admin"]), "/a/live");
});

/* ── Clerk adapter (ready for the keys; tested with a throwaway key pair) ── */

test("a Clerk session token verifies against the instance key; roles come from the metadata claim", async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const spki = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey)).toString("base64");
  const pem = `-----BEGIN PUBLIC KEY-----\n${spki.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const sign = async (claims: object) => {
    const head = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}`;
    const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(head))).toString("base64url");
    return `${head}.${sig}`;
  };
  const exp = Math.floor(NOW / 1000) + 60;
  const good = await sign({ sub: "user_1", exp, azp: "https://dev.ilmulquranus.org", metadata: { roles: ["parent", "nonsense"], familyId: "f-1" } });
  const claims = await verifyClerkToken(good, pem, { nowMs: NOW, authorizedParties: ["https://dev.ilmulquranus.org"] });
  assert.ok(claims);
  assert.deepEqual(rolesFromClaims(claims), ["parent"]);
  assert.equal(await verifyClerkToken(good, pem, { nowMs: NOW, authorizedParties: ["https://ilmulquranus.org"] }), null, "wrong party");
  assert.equal(await verifyClerkToken(await sign({ sub: "user_1", exp: exp - 120 }), pem, { nowMs: NOW }), null, "expired");
  assert.equal(await verifyClerkToken(good.slice(0, -4) + "AAAA", pem, { nowMs: NOW }), null, "bad signature");
});
