// Test des en-têtes de limite de Strava. Lancer : node --experimental-strip-types --no-warnings supabase/tests/edge/quota-strava.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireQuota } from "../../functions/_shared/quota-strava.ts";

const entetes = (o: Record<string, string>) => new Headers(o);

test("lireQuota : les limites et l'usage, par quart d'heure et par jour", () => {
  const q = lireQuota(entetes({ "X-RateLimit-Limit": "100,1000", "X-RateLimit-Usage": "45,310" }));
  assert.deepEqual(q, { limite15: 100, limiteJour: 1000, usage15: 45, usageJour: 310 });
});

test("lireQuota : des limites plus hautes sont reprises telles quelles", () => {
  const q = lireQuota(entetes({ "x-ratelimit-limit": "200, 2000", "x-ratelimit-usage": "0,0" }));
  assert.deepEqual(q, { limite15: 200, limiteJour: 2000, usage15: 0, usageJour: 0 });
});

test("lireQuota : null si les en-têtes manquent ou sont bizarres", () => {
  assert.equal(lireQuota(entetes({})), null);
  assert.equal(lireQuota(entetes({ "X-RateLimit-Limit": "100", "X-RateLimit-Usage": "1,2" })), null);
  assert.equal(lireQuota(entetes({ "X-RateLimit-Limit": "abc,def", "X-RateLimit-Usage": "1,2" })), null);
  assert.equal(lireQuota(entetes({ "X-RateLimit-Limit": "0,0", "X-RateLimit-Usage": "0,0" })), null);
  assert.equal(lireQuota(entetes({ "X-RateLimit-Limit": "100,1000", "X-RateLimit-Usage": "-5,3" })), null);
});
