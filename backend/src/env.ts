import type { ResultStage } from "./resultArchives";

export interface Env {
  VALNATT_CACHE: KVNamespace;
  VAL_RESULTS_INDEX_URL: string;
  VAL_RESULT_STAGE: ResultStage;
}
