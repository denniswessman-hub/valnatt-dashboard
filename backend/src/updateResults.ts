import {
  CACHE_KEYS,
  getOrSeedLatestResults,
  saveLatestResults,
} from "./cache";
import {
  compareIndexChecksums,
  getLatestChecksums,
  saveLatestChecksums,
} from "./checksums";
import type { Env } from "./env";
import { normalizeDashboardUpdate } from "./normalizer";
import {
  downloadChangedResultArchives,
  selectRelevantMunicipalityFiles,
} from "./resultArchives";
import { fetchIndexMd5 } from "./valmyndigheten";

export type UpdateResultsSummary = {
  indexEntryCount: number;
  changedFileCount: number;
  unchangedFileCount: number;
  removedFileCount: number;
  downloadedArchiveCount: number;
  parsedJsonFileCount: number;
  dashboardUpdated: boolean;
};

export async function updateResults(
  env: Env,
  checkedAt: string,
): Promise<UpdateResultsSummary> {
  const indexEntries = await fetchIndexMd5(env.VAL_RESULTS_INDEX_URL);
  const entries = selectRelevantMunicipalityFiles(
    indexEntries,
    env.VAL_RESULT_STAGE,
  );
  const previousResults = await getOrSeedLatestResults(env);
  const previousChecksums = await getLatestChecksums(env.VALNATT_CACHE);
  const comparison = compareIndexChecksums(entries, previousChecksums);
  const archives = await downloadChangedResultArchives(comparison.changedEntries);
  const dashboardResults = normalizeDashboardUpdate(
    archives,
    previousResults,
    checkedAt,
    env.VAL_RESULT_STAGE,
  );

  // Resultatet sparas före checksummorna. Om en KV-skrivning avbryts kan nästa
  // Cron-körning säkert göra om samma idempotenta normalisering.
  if (dashboardResults) {
    await saveLatestResults(env, dashboardResults);
  }

  await saveLatestChecksums(
    env.VALNATT_CACHE,
    comparison.currentChecksums,
  );

  await env.VALNATT_CACHE.put(CACHE_KEYS.lastSuccessfulUpdate, checkedAt);
  await env.VALNATT_CACHE.delete(CACHE_KEYS.lastError);

  return {
    indexEntryCount: entries.length,
    changedFileCount: comparison.changedEntries.length,
    unchangedFileCount: comparison.unchangedCount,
    removedFileCount: comparison.removedPaths.length,
    downloadedArchiveCount: archives.length,
    parsedJsonFileCount: archives.reduce(
      (total, archive) => total + archive.files.length,
      0,
    ),
    dashboardUpdated: dashboardResults !== null,
  };
}
