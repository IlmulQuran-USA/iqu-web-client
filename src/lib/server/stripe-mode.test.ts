import assert from "node:assert/strict";
import { test } from "node:test";
import { checkStripeEnv, keyMode } from "./stripe-mode.ts";

/*
 * dev.ilmulquranus.org, previews and local run on Stripe TEST keys only; live
 * keys only on the production site (owner, 24 Nov 2026). Key values here are
 * fake shapes, not real keys.
 */

const test_ = { secretKey: "sk_test_abc123", publishableKey: "pk_test_abc123", webhookSecret: "whsec_abc" };
const live = { secretKey: "rk_live_abc123", publishableKey: "pk_live_abc123", webhookSecret: "whsec_abc" };

test("key mode from the key prefix", () => {
  assert.equal(keyMode("sk_test_abc"), "test");
  assert.equal(keyMode("rk_live_abc"), "live");
  assert.equal(keyMode("pk_live_abc"), "live");
  assert.equal(keyMode("whsec_abc"), null);
  assert.equal(keyMode(undefined), null);
});

test("staging, previews and local accept test keys and refuse live keys", () => {
  assert.deepEqual(checkStripeEnv({ siteEnv: "staging", ...test_ }), { ok: true, mode: "test" });
  assert.deepEqual(checkStripeEnv({ siteEnv: undefined, ...test_ }), { ok: true, mode: "test" });
  const r = checkStripeEnv({ siteEnv: "staging", ...live });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : "", /Live Stripe keys are not allowed/);
});

test("the production site needs live keys", () => {
  assert.deepEqual(checkStripeEnv({ siteEnv: "production", ...live }), { ok: true, mode: "live" });
  const r = checkStripeEnv({ siteEnv: "production", ...test_ });
  assert.equal(r.ok, false);
});

test("mixed, missing or wrong-kind keys are refused", () => {
  assert.equal(checkStripeEnv({ siteEnv: "staging", ...test_, publishableKey: "pk_live_x" }).ok, false);
  assert.equal(checkStripeEnv({ siteEnv: "staging", ...test_, secretKey: "pk_test_x" }).ok, false);
  assert.equal(checkStripeEnv({ siteEnv: "staging", ...test_, webhookSecret: "" }).ok, false);
  assert.equal(checkStripeEnv({ siteEnv: "staging" }).ok, false);
});
