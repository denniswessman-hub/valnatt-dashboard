import { CACHE_KEYS } from "./cacheKeys.ts";
import type { Env } from "./env";
import type {
  DashboardHealth,
  DashboardResult,
  SafeUpdateError,
  UpdateErrorCode,
} from "./types";

const SOURCE_NAME = "Valmyndigheten";
const STALE_AFTER_MS = 3 * 60 * 1000;
export const STALE_AFTER_SECONDS = STALE_AFTER_MS / 1000;

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isSafeUpdateError(value: unknown): value is SafeUpdateError {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const error = value as Record<string, unknown>;
  const validCodes: UpdateErrorCode[] = [
    "rate_limited",
    "source_unavailable",
    "invalid_source_data",
    "cache_error",
    "unknown",
  ];

  return isIsoTimestamp(error.at)
    && typeof error.code === "string"
    && validCodes.includes(error.code as UpdateErrorCode)
    && typeof error.message === "string"
    && typeof error.retryable === "boolean";
}

export function toSafeUpdateError(error: unknown, at: string): SafeUpdateError {
  const technicalMessage = error instanceof Error ? error.message : "Okänt fel";
  let code: UpdateErrorCode = "unknown";
  let message = "Resultatuppdateringen misslyckades av okänd anledning.";
  let retryable = true;

  if (technicalMessage.includes("Hämtningsgränsen")) {
    code = "rate_limited";
    message = "Valmyndighetens hämtningsgräns är tillfälligt uppnådd.";
  } else if (
    technicalMessage.includes("Kunde inte hämta")
    || technicalMessage.includes("HTTP ")
  ) {
    code = "source_unavailable";
    message = "Valmyndighetens resultatfiler kunde inte hämtas.";
  } else if (
    technicalMessage.includes("KV")
    || technicalMessage.includes("cache")
    || technicalMessage.includes("Checksumhistoriken")
  ) {
    code = "cache_error";
    message = "Resultatcachen kunde inte läsas eller uppdateras.";
  } else if (
    /checksum|json|zip|index|resultat saknas|val(distrikt|typ|datum)|kommun(kod)?/i
      .test(technicalMessage)
  ) {
    code = "invalid_source_data";
    message = "En resultatfil kunde inte verifieras eller tolkas.";
    retryable = false;
  }

  return { at, code, message, retryable };
}

export async function recordUpdateError(
  env: Env,
  at: string,
  error: unknown,
): Promise<SafeUpdateError> {
  const safeError = toSafeUpdateError(error, at);
  await env.VALNATT_CACHE.put(
    CACHE_KEYS.lastError,
    JSON.stringify(safeError),
  );
  return safeError;
}

export async function getDashboardHealth(
  env: Env,
  results: DashboardResult,
  now = new Date(),
): Promise<DashboardHealth> {
  const [storedSuccess, storedError] = await Promise.all([
    env.VALNATT_CACHE.get(CACHE_KEYS.lastSuccessfulUpdate),
    env.VALNATT_CACHE.get<unknown>(CACHE_KEYS.lastError, "json"),
  ]);
  const lastSuccessfulUpdate = isIsoTimestamp(storedSuccess)
    ? storedSuccess
    : null;
  const lastError = isSafeUpdateError(storedError) ? storedError : null;
  const serverTime = now.toISOString();

  if (
    lastError
    && (!lastSuccessfulUpdate
      || Date.parse(lastError.at) >= Date.parse(lastSuccessfulUpdate))
  ) {
    return {
      status: "error",
      serverTime,
      lastSuccessfulUpdate,
      lastError,
      staleAfterSeconds: STALE_AFTER_SECONDS,
    };
  }

  if (results.source !== SOURCE_NAME || !lastSuccessfulUpdate) {
    return {
      status: "waiting",
      serverTime,
      lastSuccessfulUpdate,
      lastError: null,
      staleAfterSeconds: STALE_AFTER_SECONDS,
    };
  }

  const ageMs = now.getTime() - Date.parse(lastSuccessfulUpdate);

  return {
    status: ageMs > STALE_AFTER_MS ? "stale" : "ok",
    serverTime,
    lastSuccessfulUpdate,
    lastError: null,
    staleAfterSeconds: STALE_AFTER_SECONDS,
  };
}
