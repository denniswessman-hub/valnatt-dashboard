import type { ResultFileIndexEntry } from "./valmyndigheten";

export const LATEST_CHECKSUMS_KEY = "latest-checksums";

const MD5_PATTERN = /^[a-f0-9]{32}$/;

export type ChecksumMap = Record<string, string>;

export type ChecksumComparison = {
  changedEntries: ResultFileIndexEntry[];
  removedPaths: string[];
  unchangedCount: number;
  currentChecksums: ChecksumMap;
};

function isChecksumMap(value: unknown): value is ChecksumMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([path, checksum]) => path.length > 0
      && typeof checksum === "string"
      && MD5_PATTERN.test(checksum),
  );
}

export async function getLatestChecksums(
  cache: KVNamespace,
): Promise<ChecksumMap> {
  const stored = await cache.get<unknown>(LATEST_CHECKSUMS_KEY, "json");

  if (stored === null) {
    return {};
  }

  if (!isChecksumMap(stored)) {
    throw new Error("Checksumhistoriken i KV har ett ogiltigt format.");
  }

  return stored;
}

export function compareIndexChecksums(
  entries: ResultFileIndexEntry[],
  previousChecksums: ChecksumMap,
): ChecksumComparison {
  const currentChecksums: ChecksumMap = {};
  const changedEntries: ResultFileIndexEntry[] = [];

  for (const entry of entries) {
    currentChecksums[entry.path] = entry.checksum;

    if (previousChecksums[entry.path] !== entry.checksum) {
      changedEntries.push(entry);
    }
  }

  const removedPaths = Object.keys(previousChecksums).filter(
    (path) => !(path in currentChecksums),
  );

  return {
    changedEntries,
    removedPaths,
    unchangedCount: entries.length - changedEntries.length,
    currentChecksums,
  };
}

export async function saveLatestChecksums(
  cache: KVNamespace,
  checksums: ChecksumMap,
): Promise<void> {
  await cache.put(LATEST_CHECKSUMS_KEY, JSON.stringify(checksums));
}
