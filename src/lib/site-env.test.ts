import assert from "node:assert/strict";
import { test } from "node:test";
import { isProductionSite, siteEnv, siteUrl } from "./site-env.ts";

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

test("siteUrl reads NEXT_PUBLIC_SITE_URL and keeps only the origin", () => {
  assert.equal(siteUrl("https://dev.ilmulquranus.org", "staging").href, "https://dev.ilmulquranus.org/");
  assert.equal(siteUrl(" https://ilmulquranus.org/ ", "production").href, "https://ilmulquranus.org/");
  assert.equal(siteUrl("http://localhost:3000/courses", "staging").href, "http://localhost:3000/");
});

test("siteUrl falls back to the origin for the site environment", () => {
  for (const value of [undefined, "", "dev.ilmulquranus.org", "ftp://ilmulquranus.org"]) {
    assert.equal(siteUrl(value, undefined).href, "https://dev.ilmulquranus.org/", `value ${JSON.stringify(value)}`);
  }
  assert.equal(siteUrl(undefined, "production").href, "https://ilmulquranus.org/");
});
