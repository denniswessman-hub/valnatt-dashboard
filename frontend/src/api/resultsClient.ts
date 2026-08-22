import type { DashboardResult, MunicipalityResult, PartyResult } from "../types";

export const RESULTS_REFRESH_INTERVAL_MS = 60_000;

const configuredApiUrl = import.meta.env.VITE_RESULTS_API_URL?.trim();
const resultsApiUrl = configuredApiUrl
  || (import.meta.env.DEV ? "http://127.0.0.1:8787/api/results" : "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPartyResult(value: unknown): value is PartyResult {
  return isRecord(value)
    && typeof value.code === "string"
    && typeof value.name === "string"
    && typeof value.votes === "number"
    && typeof value.percent === "number"
    && typeof value.color === "string"
    && (value.changeVotes === undefined || typeof value.changeVotes === "number")
    && (value.changePercent === undefined || typeof value.changePercent === "number");
}

function isMunicipalityResult(value: unknown): value is MunicipalityResult {
  return isRecord(value)
    && typeof value.code === "string"
    && typeof value.name === "string"
    && typeof value.districtsReported === "number"
    && typeof value.districtsTotal === "number"
    && typeof value.votesTotal === "number"
    && Array.isArray(value.parties)
    && value.parties.every(isPartyResult);
}

function isDashboardResult(value: unknown): value is DashboardResult {
  const health = isRecord(value) && isRecord(value.health) ? value.health : null;
  const lastError = health && isRecord(health.lastError) ? health.lastError : null;

  return isRecord(value)
    && typeof value.source === "string"
    && typeof value.election === "string"
    && ["test", "preliminar", "slutlig"].includes(String(value.status))
    && typeof value.lastCheckedAt === "string"
    && (value.lastChangedAt === null || typeof value.lastChangedAt === "string")
    && Array.isArray(value.municipalities)
    && value.municipalities.length > 0
    && value.municipalities.every(isMunicipalityResult)
    && health !== null
    && ["ok", "waiting", "stale", "error"].includes(String(health.status))
    && typeof health.serverTime === "string"
    && (health.lastSuccessfulUpdate === null || typeof health.lastSuccessfulUpdate === "string")
    && typeof health.staleAfterSeconds === "number"
    && (
      health.lastError === null
      || (
        lastError !== null
        && typeof lastError.at === "string"
        && typeof lastError.code === "string"
        && typeof lastError.message === "string"
        && typeof lastError.retryable === "boolean"
      )
    );
}

type GetResultsOptions = {
  signal?: AbortSignal;
};

export async function getResults(options: GetResultsOptions = {}): Promise<DashboardResult> {
  if (!resultsApiUrl) {
    throw new Error("VITE_RESULTS_API_URL saknas för produktionsbygget.");
  }

  const response = await fetch(resultsApiUrl, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Kunde inte hämta valresultat (${response.status}).`);
  }

  const data: unknown = await response.json();

  if (!isDashboardResult(data)) {
    throw new Error("API-svaret har ett oväntat format.");
  }

  return data;
}
