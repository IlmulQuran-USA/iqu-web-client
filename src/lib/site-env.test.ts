import assert from "node:assert/strict";
import { test } from "node:test";
import { isProductionSite, siteEnv } from "./site-env.ts";

/*
 * Staging must never be indexed (DEPLOYMENT.md): anything other than the exact
 * value "production" is staging, including a missing variable.
 */

test("only the exact value 'production' is the public site", () => {
  assert.equal(siteEnv("production"), "production");
  assert.equal(isProductionSite("production"), true);
});

test("missing, empty or misspelt values are staging", () => {
  for (const value of [undefined, "", "staging", "Production", "PRODUCTION", " production", "production ", "prod", "true"]) {
    assert.equal(siteEnv(value), "staging", `value ${JSON.stringify(value)}`);
  }
});
