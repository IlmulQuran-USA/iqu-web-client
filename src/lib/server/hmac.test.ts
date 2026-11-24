import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { ipHash, signature, signedHeaders, verifySignature } from "./hmac.ts";

/*
 * The signing contract with the plugin (enroll-plugin-changes.md,
 * "Authentication"): v1 = HMAC-SHA256(secret, timestamp + "." + rawBody).
 */

const SECRET = "s".repeat(48);
const BODY = JSON.stringify({ v: 1, form: "free", submit_id: "0123456789abcdef" });
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);

test("the signature is HMAC-SHA256 over 'timestamp.rawBody'", () => {
  const ts = Math.floor(NOW / 1000);
  const expected = createHmac("sha256", SECRET).update(`${ts}.${BODY}`).digest("hex");
  assert.equal(signature(SECRET, ts, BODY), expected);
  assert.deepEqual(signedHeaders(SECRET, BODY, NOW), {
    "X-IQU-Timestamp": String(ts),
    "X-IQU-Signature": `v1=${expected}`,
  });
});

test("the plugin-side check accepts a fresh signature and refuses tampering", () => {
  const h = signedHeaders(SECRET, BODY, NOW);
  assert.equal(verifySignature(SECRET, h["X-IQU-Signature"], h["X-IQU-Timestamp"], BODY, NOW), true);
  assert.equal(verifySignature(SECRET, h["X-IQU-Signature"], h["X-IQU-Timestamp"], BODY + " ", NOW), false);
  assert.equal(verifySignature("t".repeat(48), h["X-IQU-Signature"], h["X-IQU-Timestamp"], BODY, NOW), false);
  assert.equal(verifySignature(SECRET, "v2=" + h["X-IQU-Signature"].slice(3), h["X-IQU-Timestamp"], BODY, NOW), false);
});

test("a signature older than 300 seconds is refused", () => {
  const h = signedHeaders(SECRET, BODY, NOW);
  assert.equal(verifySignature(SECRET, h["X-IQU-Signature"], h["X-IQU-Timestamp"], BODY, NOW + 300_000), true);
  assert.equal(verifySignature(SECRET, h["X-IQU-Signature"], h["X-IQU-Timestamp"], BODY, NOW + 301_000), false);
});

test("the IP hash is stable, short and not the IP", () => {
  assert.equal(ipHash(SECRET, "203.0.113.7"), ipHash(SECRET, "203.0.113.7"));
  assert.notEqual(ipHash(SECRET, "203.0.113.7"), ipHash(SECRET, "203.0.113.8"));
  assert.equal(ipHash(SECRET, "203.0.113.7").length, 32);
  assert.ok(!ipHash(SECRET, "203.0.113.7").includes("203"));
});
