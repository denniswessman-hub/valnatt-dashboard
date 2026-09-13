import assert from "node:assert/strict";
import { getLatestResults } from "../src/cache.ts";
import { CACHE_KEYS } from "../src/cacheKeys.ts";
import { mockResults } from "../src/mockData.ts";
import {
  getDashboardHealth,
  recordUpdateError,
  toSafeUpdateError,
} from "../src/operationalStatus.ts";

const memory = new Map();
let mutationCount = 0;
const fakeKv = {
  async get(key, type) {
    const value = memory.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  },
  async put(key, value) {
    mutationCount += 1;
    memory.set(key, value);
  },
  async delete(key) {
    mutationCount += 1;
    memory.delete(key);
  },
};
const env = { VALNATT_CACHE: fakeKv };
const realResults = { ...mockResults, source: "Valmyndigheten" };

const uncachedResults = await getLatestResults(env);
assert.equal(uncachedResults.source, 'Inväntar Valmyndigheten');
assert.equal(uncachedResults.municipalities[0].districts.length, 5);
memory.set(CACHE_KEYS.latestResults, JSON.stringify(mockResults));
assert.equal((await getLatestResults(env)).status, 'preliminar');
assert.equal((await getLatestResults(env)).municipalities[0].parties.length, 0);
memory.clear();
assert.equal(mutationCount, 0, "Ett vanligt API-anrop får inte skriva till KV.");

assert.equal(
  toSafeUpdateError(
    new Error("Kunde inte hämta Valmyndighetens index.md5: HTTP 503."),
    "2026-09-13T19:20:00Z",
  ).code,
  "source_unavailable",
);
assert.equal(
  toSafeUpdateError(
    new Error("Checksumkontrollen misslyckades för resultat.zip."),
    "2026-09-13T19:20:00Z",
  ).code,
  "invalid_source_data",
);

let health = await getDashboardHealth(
  env,
  mockResults,
  new Date("2026-09-13T19:20:00Z"),
);
assert.equal(health.status, "waiting");

memory.set(CACHE_KEYS.lastSuccessfulUpdate, "2026-09-13T18:50:00Z");
health = await getDashboardHealth(
  env,
  realResults,
  new Date("2026-09-13T19:20:00Z"),
);
assert.equal(health.status, "stale");

memory.set(CACHE_KEYS.lastSuccessfulUpdate, "2026-09-13T19:19:00Z");
health = await getDashboardHealth(
  env,
  realResults,
  new Date("2026-09-13T19:20:00Z"),
);
assert.equal(health.status, "ok");

const recorded = await recordUpdateError(
  env,
  "2026-09-13T19:21:00Z",
  new Error("Hämtningsgränsen är tillfälligt uppnådd."),
);
assert.equal(recorded.code, "rate_limited");
health = await getDashboardHealth(
  env,
  realResults,
  new Date("2026-09-13T19:22:00Z"),
);
assert.equal(health.status, "error");
assert.equal(health.lastError?.message, "Valmyndighetens hämtningsgräns är tillfälligt uppnådd.");

memory.set(CACHE_KEYS.lastSuccessfulUpdate, "2026-09-13T19:23:00Z");
health = await getDashboardHealth(
  env,
  realResults,
  new Date("2026-09-13T19:24:00Z"),
);
assert.equal(health.status, "ok");
assert.equal(health.lastError, null);

console.log("Driftstatusen hanterar väntan, färsk data, gammal data, fel och återhämtning.");
