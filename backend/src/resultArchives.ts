import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { unzipSync } from "fflate";
import type { ResultFileIndexEntry } from "./valmyndigheten";

export const TARGET_MUNICIPALITY_CODES = ["1460", "1492", "1461", "1438"] as const;
export type ResultStage = "preliminar" | "slutlig";

const MAX_ZIP_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 24;
const MAX_JSON_FILES = 8;
const MAX_JSON_FILE_SIZE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_JSON_SIZE_BYTES = 48 * 1024 * 1024;
const MUNICIPALITY_ZIP_PATTERN = /_(preliminar|slutlig)_(\d{4})_KF\.zip$/i;

export type ParsedResultJsonFile = {
  name: string;
  data: Record<string, unknown> | unknown[];
};

export type ParsedResultArchive = {
  source: ResultFileIndexEntry;
  files: ParsedResultJsonFile[];
};

function isSafeArchivePath(path: string): boolean {
  const segments = path.split("/");

  return path.length > 0
    && !path.startsWith("/")
    && !path.includes("\\")
    && !segments.includes("..")
    && !segments.includes("");
}

function validateResultFileUrl(source: ResultFileIndexEntry): URL {
  const url = new URL(source.url);

  if (
    url.protocol !== "https:"
    || url.hostname !== "resultat.val.se"
    || !url.pathname.startsWith("/resultatfiler/")
    || !url.pathname.toLowerCase().endsWith(".zip")
  ) {
    throw new Error(`Otillåten adress för resultatfilen ${source.path}.`);
  }

  return url;
}

async function readResponseWithLimit(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);

  if (declaredLength > maxBytes) {
    throw new Error("Resultatfilens ZIP-arkiv är oväntat stort.");
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());

    if (bytes.byteLength > maxBytes) {
      throw new Error("Resultatfilens ZIP-arkiv är oväntat stort.");
    }

    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Resultatfilens ZIP-arkiv är oväntat stort.");
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

export function selectRelevantMunicipalityFiles(
  entries: ResultFileIndexEntry[],
  stage: ResultStage = "preliminar",
): ResultFileIndexEntry[] {
  if (stage !== "preliminar" && stage !== "slutlig") {
    throw new Error("VAL_RESULT_STAGE måste vara preliminar eller slutlig.");
  }

  const targetCodes = new Set<string>(TARGET_MUNICIPALITY_CODES);

  return entries.filter((entry) => {
    const fileName = entry.path.split("/").at(-1) ?? "";
    const match = MUNICIPALITY_ZIP_PATTERN.exec(fileName);
    return match !== null
      && match[1].toLowerCase() === stage
      && targetCodes.has(match[2]);
  });
}

export function readJsonFilesFromZip(
  zipBytes: Uint8Array,
  archivePath: string,
): ParsedResultJsonFile[] {
  let archiveEntryCount = 0;
  let jsonFileCount = 0;
  let totalJsonBytes = 0;
  const seenPaths = new Set<string>();

  const files = unzipSync(zipBytes, {
    filter(file) {
      archiveEntryCount += 1;

      if (archiveEntryCount > MAX_ARCHIVE_ENTRIES) {
        throw new Error(`ZIP-arkivet ${archivePath} innehåller för många poster.`);
      }

      if (!isSafeArchivePath(file.name) || seenPaths.has(file.name)) {
        throw new Error(`ZIP-arkivet ${archivePath} innehåller en otillåten filsökväg.`);
      }

      seenPaths.add(file.name);

      if (!file.name.toLowerCase().endsWith(".json")) {
        return false;
      }

      jsonFileCount += 1;
      totalJsonBytes += file.originalSize;

      if (jsonFileCount > MAX_JSON_FILES) {
        throw new Error(`ZIP-arkivet ${archivePath} innehåller för många JSON-filer.`);
      }

      if (
        file.originalSize > MAX_JSON_FILE_SIZE_BYTES
        || totalJsonBytes > MAX_TOTAL_JSON_SIZE_BYTES
      ) {
        throw new Error(`ZIP-arkivet ${archivePath} innehåller oväntat mycket JSON-data.`);
      }

      return true;
    },
  });

  const decoder = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: false,
  });
  const parsedFiles: ParsedResultJsonFile[] = [];

  for (const [name, contents] of Object.entries(files)) {
    let data: unknown;

    try {
      const jsonText = decoder.decode(contents).replace(/^\uFEFF/, "");
      data = JSON.parse(jsonText);
    } catch {
      throw new Error(`JSON-filen ${name} i ${archivePath} kunde inte tolkas.`);
    }

    if (!data || typeof data !== "object") {
      throw new Error(`JSON-filen ${name} i ${archivePath} saknar ett objekt eller en lista.`);
    }

    parsedFiles.push({
      name,
      data: data as Record<string, unknown> | unknown[],
    });
  }

  if (parsedFiles.length === 0) {
    throw new Error(`ZIP-arkivet ${archivePath} innehåller ingen JSON-fil.`);
  }

  return parsedFiles;
}

export async function downloadResultArchive(
  source: ResultFileIndexEntry,
): Promise<ParsedResultArchive> {
  const url = validateResultFileUrl(source);
  const response = await fetch(url, {
    headers: { accept: "application/zip" },
  });

  if (!response.ok) {
    const detail = response.status === 429
      ? "Hämtningsgränsen är tillfälligt uppnådd."
      : `HTTP ${response.status}.`;
    throw new Error(`Kunde inte hämta ${source.path}: ${detail}`);
  }

  const zipBytes = await readResponseWithLimit(response, MAX_ZIP_SIZE_BYTES);
  const actualChecksum = bytesToHex(md5(zipBytes));

  if (actualChecksum !== source.checksum.toLowerCase()) {
    throw new Error(`Checksumkontrollen misslyckades för ${source.path}.`);
  }

  let files: ParsedResultJsonFile[];

  try {
    files = readJsonFilesFromZip(zipBytes, source.path);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`ZIP-arkivet ${source.path} kunde inte packas upp.`);
  }

  return { source, files };
}

export async function downloadChangedResultArchives(
  entries: ResultFileIndexEntry[],
): Promise<ParsedResultArchive[]> {
  const archives: ParsedResultArchive[] = [];

  for (const entry of entries) {
    archives.push(await downloadResultArchive(entry));
  }

  return archives;
}
