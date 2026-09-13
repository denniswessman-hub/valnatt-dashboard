import {
  CACHE_KEYS,
  getLatestResults,
  saveLatestResults,
} from "./cache";
import {
  compareIndexChecksums,
  getLatestChecksums,
  saveLatestChecksums,
} from "./checksums";
import type { Env } from "./env";
import { normalizeArchive, normalizeDashboardUpdate } from "./normalizer";
import {
  downloadChangedResultArchives,
  selectRelevantMunicipalityFiles,
  type ParsedResultArchive,
} from "./resultArchives";
import { fetchIndexMd5 } from "./valmyndigheten";

const MAIN_MUNICIPALITY_CODE = "1460";

function isMainMunicipalityFile(path: string): boolean {
  return new RegExp(`_${MAIN_MUNICIPALITY_CODE}_KF\\.zip$`, "i").test(path);
}

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
  const previousResults = await getLatestResults(env);
  const storedChecksums = await getLatestChecksums(env.VALNATT_CACHE);
  const previousChecksums = previousResults.source === 'Valmyndigheten'
    && previousResults.municipalities.find(m => m.code === '1460')?.districts
    ? storedChecksums : {};
  const comparison = compareIndexChecksums(entries, previousChecksums);

  // Varje fil hämtas och kontrolleras för sig. Ett fel i en grannkommuns fil
  // (nedladdning, checksumma, JSON-format) får inte stoppa Bengtsfors. Den
  // felande filen lämnas utanför checksummorna så att den försöks igen.
  const archives: ParsedResultArchive[] = [];
  const skippedPaths: string[] = [];

  for (const entry of comparison.changedEntries) {
    try {
      const [archive] = await downloadChangedResultArchives([entry]);
      normalizeArchive(archive, env.VAL_RESULT_STAGE);
      archives.push(archive);
    } catch (error) {
      if (isMainMunicipalityFile(entry.path)) {
        throw error;
      }

      console.error(`Hoppar över ${entry.path} i den här körningen.`, error);
      skippedPaths.push(entry.path);
    }
  }

  if (archives.some(a => a.files.some(f => !Array.isArray(f.data) && f.data.test === true))) {
    throw new Error('Testdata i produktionsresultat avvisas.');
  }
  const dashboardResults = normalizeDashboardUpdate(
    archives,
    previousResults,
    checkedAt,
    env.VAL_RESULT_STAGE,
  );

  // Resultatet sparas före checksummorna. Om en KV-skrivning avbryts kan nästa
  // Cron-körning säkert göra om samma idempotenta normalisering.
  if (dashboardResults && archives.length > 0) {
    await saveLatestResults(env, dashboardResults);
  }

  for (const path of skippedPaths) {
    delete comparison.currentChecksums[path];
  }

  if (
    dashboardResults !== null
    && (comparison.changedEntries.length > 0
      || comparison.removedPaths.length > 0)
  ) {
    await saveLatestChecksums(
      env.VALNATT_CACHE,
      comparison.currentChecksums,
    );
  }

  await env.VALNATT_CACHE.put(CACHE_KEYS.lastSuccessfulUpdate, checkedAt);
  const recordedError = await env.VALNATT_CACHE.get(CACHE_KEYS.lastError);
  if (recordedError !== null) {
    await env.VALNATT_CACHE.delete(CACHE_KEYS.lastError);
  }

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
