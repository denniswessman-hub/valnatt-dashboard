import { getLatestResults } from "./cache";
import type { Env } from "./env";
import { getDashboardHealth, recordUpdateError } from "./operationalStatus";
import { updateResults } from "./updateResults";

const resultsPath = "/api/results";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function jsonResponse(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== resultsPath) {
      return jsonResponse({ error: "Sökvägen finns inte" }, 404);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "access-control-max-age": "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return jsonResponse(
        { error: "Metoden stöds inte" },
        405,
        { allow: "GET, OPTIONS" },
      );
    }

    try {
      const edgeCache = caches.default;
      const cacheKey = new Request(`${url.origin}${resultsPath}`);
      const hit = await edgeCache.match(cacheKey);
      if (hit) return hit;
      const results = await getLatestResults(env);
      const health = await getDashboardHealth(env, results);
      const response = jsonResponse({ ...results, health, version: '2026-09-13-districts' }, 200, {
        'cache-control': 'public, max-age=60',
      });
      ctx.waitUntil(edgeCache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      console.error("Kunde inte läsa dashboardens cache.", error);
      return jsonResponse(
        { error: "Valresultatet är tillfälligt otillgängligt." },
        503,
        { "retry-after": "20" },
      );
    }
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const checkedAt = new Date(controller.scheduledTime).toISOString();

    try {
      await updateResults(env, checkedAt);
    } catch (error) {
      console.error("Den schemalagda resultatuppdateringen misslyckades.", error);

      try {
        await recordUpdateError(env, checkedAt, error);
      } catch (recordingError) {
        console.error("Kunde inte spara uppdateringsfelet i KV.", recordingError);
      }

      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
