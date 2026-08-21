import type { DashboardResult } from "./types";
import type { Env } from "./env";
import { mockResults } from "./mockData";
import { CACHE_KEYS } from "./cacheKeys";

export { CACHE_KEYS } from "./cacheKeys";

export async function getOrSeedLatestResults(env: Env): Promise<DashboardResult> {
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

  await Promise.all([
    env.VALNATT_CACHE.put(CACHE_KEYS.latestResults, JSON.stringify(mockResults)),
    env.VALNATT_CACHE.put(CACHE_KEYS.latestChecksums, JSON.stringify({})),
  ]);

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
