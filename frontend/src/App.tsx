import { useEffect, useState } from "react";
import { getResults, RESULTS_REFRESH_INTERVAL_MS } from "./api/resultsClient";
import { MainMunicipality } from "./components/MainMunicipality";
import { SideMunicipalityCard } from "./components/SideMunicipalityCard";
import type { DashboardResult } from "./types";

const timeFormatter = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatAge(timestamp: string, serverTime: string): string {
  const ageSeconds = Math.max(
    0,
    Math.floor((Date.parse(serverTime) - Date.parse(timestamp)) / 1_000),
  );

  if (ageSeconds < 60) {
    return "mindre än en minut sedan";
  }

  const ageMinutes = Math.floor(ageSeconds / 60);

  if (ageMinutes < 60) {
    return `${ageMinutes} ${ageMinutes === 1 ? "minut" : "minuter"} sedan`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  return `${ageHours} ${ageHours === 1 ? "timme" : "timmar"} sedan`;
}

export function App() {
  const [results, setResults] = useState<DashboardResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadResults() {
      try {
        const nextResults = await getResults({ signal: controller.signal });

        if (active) {
          setResults(nextResults);
          setLoadError(null);
        }
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setLoadError(
          error instanceof Error ? error.message : "Kunde inte ansluta till resultat-API:t.",
        );
      }
    }

    void loadResults();
    const intervalId = window.setInterval(() => {
      void loadResults();
    }, RESULTS_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  const healthStatus = results?.health.status;
  const connectionState = loadError || healthStatus === "error"
    ? "error"
    : healthStatus === "stale" || healthStatus === "waiting"
      ? "loading"
      : results
        ? "connected"
        : "loading";
  const connectionLabel = loadError
    ? "Anslutningsfel – visar cache"
    : healthStatus === "error"
      ? "Källfel – visar cache"
      : healthStatus === "stale"
        ? "Fördröjd data"
        : healthStatus === "waiting"
          ? "Väntar på valdata"
          : results
            ? "Uppdateringen fungerar"
            : "Ansluter";
  const [mainMunicipality, ...nearbyMunicipalities] = results?.municipalities ?? [];
  const resultNotice = results?.status === "test"
    ? {
        title: "Testdata – inte ett verkligt valresultat",
        text: "Siffrorna är testdata och får inte användas som valresultat.",
      }
    : results?.status === "slutlig"
      ? {
          title: "Slutligt valresultat",
          text: "Dashboarden visar Valmyndighetens slutliga resultatfiler.",
        }
      : {
          title: "Preliminärt valresultat",
          text: "Resultatet uppdateras under rösträkningen och kan förändras.",
        };
  const successfulUpdateAge = results?.health.lastSuccessfulUpdate
    ? formatAge(results.health.lastSuccessfulUpdate, results.health.serverTime)
    : null;
  const displayedHealthStatus = loadError ? "error" : healthStatus;
  const healthNotice = loadError
    ? {
        title: "Resultat-API:t kan inte nås",
        text: `Senast hämtade resultat ligger kvar i webbläsaren${successfulUpdateAge ? `; senaste lyckade källkontroll var ${successfulUpdateAge}` : ""}.`,
      }
    : healthStatus === "error"
    ? {
        title: "Senaste källuppdateringen misslyckades",
        text: `${results?.health.lastError?.message ?? "Ett uppdateringsfel inträffade"} Senast kända resultat visas${successfulUpdateAge ? `; senaste lyckade kontroll var ${successfulUpdateAge}` : ""}.`,
      }
    : healthStatus === "stale"
      ? {
          title: "Resultatet kan vara fördröjt",
          text: `Senast kända resultat visas. Senaste lyckade kontroll var ${successfulUpdateAge ?? "längre tillbaka än förväntat"}.`,
        }
      : healthStatus === "waiting"
        ? {
            title: "Väntar på resultat från Bengtsfors",
            text: "Valdistrikten visas redan nu. Röster visas när Valmyndighetens kommunfiler har publicerats och verifierats.",
          }
        : {
            title: "Källuppdateringen fungerar",
            text: `Valmyndigheten kontrollerades senast ${successfulUpdateAge ?? "nyligen"}.`,
          };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="Till huvudinnehållet">
          <span className="brand-mark" aria-hidden="true">V26</span>
          <span>
            <strong>Valnatt Dalsland</strong>
            <small>Kommunvalet 2026</small>
          </span>
        </a>
        <div
          className={`live-status live-status--${connectionState}`}
          aria-label={`Datastatus: ${connectionLabel}`}
        >
          <span aria-hidden="true" />
          {connectionLabel}
        </div>
      </header>

      <main id="main-content">
        {!results ? (
          <section
            className={`connection-state${loadError ? " connection-state--error" : ""}`}
            role={loadError ? "alert" : "status"}
          >
            <span className="connection-state__indicator" aria-hidden="true" />
            <p className="eyebrow">Resultat-API</p>
            <h1>{loadError ? "Kunde inte ansluta" : "Hämtar valresultat"}</h1>
            <p>{loadError ?? "Dashboarden hämtar senaste tillgängliga resultat."}</p>
          </section>
        ) : (
          <>
            <section
              className={`notice notice--health notice--${displayedHealthStatus}`}
              aria-labelledby="health-title"
              role={displayedHealthStatus === "error" ? "alert" : "status"}
            >
              <span className="notice-icon" aria-hidden="true">
                {displayedHealthStatus === "ok" ? "✓" : "!"}
              </span>
              <div>
                <strong id="health-title">{healthNotice.title}</strong>
                <p>{healthNotice.text}</p>
              </div>
            </section>

            <section className="notice" aria-labelledby="notice-title">
              <span className="notice-icon" aria-hidden="true">i</span>
              <div>
                <strong id="notice-title">{resultNotice.title}</strong>
                <p>{resultNotice.text}</p>
              </div>
            </section>

            {mainMunicipality && (
              <div className="dashboard-grid">
                <MainMunicipality
                  municipality={mainMunicipality}
                  status={results.status}
                />

                <aside className="side-panel" aria-labelledby="nearby-title">
                  <div className="side-heading">
                    <div>
                      <p className="eyebrow">Överblick</p>
                      <h2 id="nearby-title">Närliggande kommuner</h2>
                    </div>
                    <span>{nearbyMunicipalities.length} kommuner</span>
                  </div>
                  <div className="municipality-list">
                    {nearbyMunicipalities.length === 0 && <p>Åmål, Mellerud och Dals-Ed visas när deras resultatfiler finns.</p>}
                    {nearbyMunicipalities.map((municipality) => (
                      <SideMunicipalityCard key={municipality.code} municipality={municipality} />
                    ))}
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </main>

      <footer>
        <p>
          {results ? (
            <>
              Senast lyckad källkontroll{" "}
              <strong>
                {results.health.lastSuccessfulUpdate
                  ? timeFormatter.format(new Date(results.health.lastSuccessfulUpdate))
                  : "saknas"}
              </strong>
              <span aria-hidden="true"> · </span>
              Källa: {results.source}
            </>
          ) : (
            "Väntar på resultat-API:t"
          )}
        </p>
        <p>Källkontroll var 10:e minut · Sidan kontrollerar uppdateringar varje minut · <a href="https://resultat.val.se/">Valmyndigheten</a></p>
      </footer>
    </div>
  );
}
