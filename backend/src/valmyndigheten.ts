export const DEFAULT_RESULTS_INDEX_URL =
  "https://resultat.val.se/resultatfiler/val2026/index.md5";

const MAX_INDEX_SIZE_BYTES = 1_000_000;
const EMPTY_INDEX_CHECKSUM = "d41d8cd98f00b204e9800998ecf8427e";
const MD5_LINE_PATTERN = /^([a-f0-9]{32})\s+(\*?)(.+)$/i;

export type ResultFileIndexEntry = {
  checksum: string;
  path: string;
  url: string;
};

function validateIndexUrl(indexUrl: string): URL {
  const url = new URL(indexUrl);

  if (
    url.protocol !== "https:"
    || url.hostname !== "resultat.val.se"
    || !url.pathname.endsWith("/index.md5")
  ) {
    throw new Error("Indexadressen måste vara Valmyndighetens HTTPS-adress för index.md5.");
  }

  return url;
}

export function parseIndexMd5(
  content: string,
  indexUrl = DEFAULT_RESULTS_INDEX_URL,
): ResultFileIndexEntry[] {
  const validatedIndexUrl = validateIndexUrl(indexUrl);
  const baseUrl = new URL(".", validatedIndexUrl);
  const entries: ResultFileIndexEntry[] = [];
  const seenPaths = new Set<string>();

  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (const [index, sourceLine] of lines.entries()) {
    const line = sourceLine.trim();

    if (!line) {
      continue;
    }

    const match = MD5_LINE_PATTERN.exec(line);

    if (!match) {
      throw new Error(`Ogiltig rad ${index + 1} i Valmyndighetens index.md5.`);
    }

    const checksum = match[1].toLowerCase();
    const rawPath = match[3].trim();

    if (rawPath === "-" && checksum === EMPTY_INDEX_CHECKSUM) {
      continue;
    }

    const normalizedPath = rawPath.replace(/^\.\//, "");
    const pathSegments = normalizedPath.split("/");

    if (
      !normalizedPath
      || normalizedPath.startsWith("/")
      || normalizedPath.includes("\\")
      || pathSegments.includes("..")
      || !normalizedPath.toLowerCase().endsWith(".zip")
    ) {
      throw new Error(`Otillåten filsökväg på rad ${index + 1} i index.md5.`);
    }

    const fileUrl = new URL(normalizedPath, baseUrl);

    if (
      fileUrl.origin !== baseUrl.origin
      || !fileUrl.pathname.startsWith(baseUrl.pathname)
    ) {
      throw new Error(`Filsökvägen på rad ${index + 1} lämnar resultatkatalogen.`);
    }

    if (seenPaths.has(normalizedPath)) {
      throw new Error(`Dubblett för ${normalizedPath} i index.md5.`);
    }

    seenPaths.add(normalizedPath);
    entries.push({
      checksum,
      path: normalizedPath,
      url: fileUrl.toString(),
    });
  }

  return entries;
}

export async function fetchIndexMd5(
  indexUrl = DEFAULT_RESULTS_INDEX_URL,
): Promise<ResultFileIndexEntry[]> {
  const validatedIndexUrl = validateIndexUrl(indexUrl);
  const response = await fetch(validatedIndexUrl, {
    headers: { accept: "text/plain" },
  });

  if (!response.ok) {
    const detail = response.status === 429
      ? "Hämtningsgränsen är tillfälligt uppnådd."
      : `HTTP ${response.status}.`;

    throw new Error(`Kunde inte hämta Valmyndighetens index.md5: ${detail}`);
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);

  if (declaredLength > MAX_INDEX_SIZE_BYTES) {
    throw new Error("Valmyndighetens index.md5 är oväntat stor.");
  }

  const content = await response.text();

  if (new TextEncoder().encode(content).byteLength > MAX_INDEX_SIZE_BYTES) {
    throw new Error("Valmyndighetens index.md5 är oväntat stor.");
  }

  return parseIndexMd5(content, validatedIndexUrl.toString());
}
