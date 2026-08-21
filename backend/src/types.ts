export type PartyResult = {
  code: string;
  name: string;
  votes: number;
  percent: number;
  color: string;
  changeVotes?: number;
  changePercent?: number;
};

export type MunicipalityResult = {
  code: string;
  name: string;
  districtsReported: number;
  districtsTotal: number;
  votesTotal: number;
  parties: PartyResult[];
};

export type DashboardResult = {
  source: string;
  election: string;
  status: "test" | "preliminar" | "slutlig";
  lastCheckedAt: string;
  lastChangedAt: string | null;
  municipalities: MunicipalityResult[];
};

export type UpdateErrorCode =
  | "rate_limited"
  | "source_unavailable"
  | "invalid_source_data"
  | "cache_error"
  | "unknown";

export type SafeUpdateError = {
  at: string;
  code: UpdateErrorCode;
  message: string;
  retryable: boolean;
};

export type DashboardHealth = {
  status: "ok" | "waiting" | "stale" | "error";
  serverTime: string;
  lastSuccessfulUpdate: string | null;
  lastError: SafeUpdateError | null;
  staleAfterSeconds: number;
};

export type DashboardResponse = DashboardResult & {
  health: DashboardHealth;
};
