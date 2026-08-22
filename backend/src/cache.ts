import type { DashboardResult } from "./types";
import type { Env } from "./env";
import { mockResults } from "./mockData.ts";
import { CACHE_KEYS } from "./cacheKeys.ts";

export { CACHE_KEYS } from "./cacheKeys.ts";

export async function getLatestResults(env: Env): Promise<DashboardResult> {
  const cached = await env.VALNATT_CACHE.get<DashboardResult & {
    lastChangedAt?: string | null;
  }>(
    CACHE_KEYS.latestResults,
    "json",
  );

  if (cached && cached.lastChangedAt !== undefined) {
    return cached;
  }

  if (cached && cached.source !== mockResults.source) {
    throw new Error("Det cachelagrade dashboardresultatet har ett äldre eller ogiltigt format.");
  }

  // Vanliga API-anrop ska vara strikt läsande. Om cachen ännu inte är
  // initierad används demodata i svaret utan att besöket orsakar KV-writes.
  return mockResults;
}

export async function saveLatestResults(
  env: Env,
  results: DashboardResult,
): Promise<void> {
  await env.VALNATT_CACHE.put(
    CACHE_KEYS.latestResults,
    JSON.stringify(results),
  );
}
