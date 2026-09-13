# Valnattsdashboard 2026

## Valdagen 13 september – aktuell drift

Bengtsfors total och fem ordinarie valdistrikt prioriteras: Nordvästra (0101), Norra (0102), Nordöstra (0613), Sydöstra (0616), Sydvästra (0919). Namn och koder är kontrollerade mot https://data.val.se/filer/val2026/rostmottagning/vallokaler.json den 13 september. Eventuella uppsamlingsdistrikt från resultatfilen läggs också till. Röster per distrikt hämtas från röstfördelningsfilen; kommuntotalen från mandatfördelningsfilen. Bengtsfors kan publiceras utan att invänta grannkommunerna.

Workers Free ($0) verifierades i Cloudflare den 13 september. Cron kör var tionde minut (144 gånger/dygn), med högst tre normala KV-skrivningar per körning (432/dygn). API-anrop skriver inte till KV; svar cachelagras 60 sekunder vid kanten. Gratisgränserna gäller hela kontot: 1 000 skrivningar och 100 000 läsningar/dygn. Gränsöverskridande på Free ger fel, inte automatisk betaldebitering. Ingen betalplan har aktiverats. Frontend kontrollerar API:t varje minut. Källa: https://developers.cloudflare.com/kv/platform/pricing/

Gamla demodata och simulationsresultat används inte som valresultat. Tomt index ger vänteläge med distriktsnamn och utan påhittade röster. Live-index var tomt vid förberedelserna; fullständig kontroll mot faktiska röstsiffror återstår tills filer publiceras. Pages publiceras med Wrangler (ingen automatisk GitHub-deploy är konfigurerad).

Backend: `cd backend; pnpm exec wrangler deploy`

Frontend: bygg från roten med `VITE_RESULTS_API_URL=https://valnatt-backend.valnatt-backend.workers.dev/api/results`, kör `pnpm --filter @valnatt/frontend build`, därefter från backend `pnpm exec wrangler pages deploy ../frontend/dist --project-name valnatt-dashboard --branch main`.

Äldre avsnitt nedan beskriver byggstegen; aktuell drift och intervall ovan har företräde.

Monorepo för en valnattsdashboard med React/Vite i frontend och en Cloudflare Worker i backend.

## Projektstruktur

```text
valnatt-dashboard/
├── frontend/
│   ├── public/
│   └── src/
│       ├── api/
│       └── components/
├── backend/
│   └── src/
├── scripts/
├── package.json
└── pnpm-workspace.yaml
```

## Status

Del 15 av 15 är klar: KV, Worker, cron och frontend är driftsatta i Cloudflare. Workern bevarar senast kända resultat vid fel, lagrar en säker felstatus i KV och API/frontend visar om data väntar, är färsk, fördröjd eller har ett källfel.

## Publicerad miljö

- Webbplats: <https://valnatt-dashboard.pages.dev>
- API: <https://valnatt-backend.valnatt-backend.workers.dev/api/results>
- Källkod: <https://github.com/denniswessman-hub/valnatt-dashboard>

Cloudflare Worker kör `scheduled` var tionde minut under testperioden. Fram till att Valmyndighetens valresultatindex innehåller kompletta kommunfullmäktigefiler för alla fyra kommuner visar webbplatsen tydligt märkt demodata och driftstatusen `waiting`.

## Lokal backend

```powershell
pnpm --filter @valnatt/backend dev
```

Mock-endpointen finns på `http://localhost:8787/api/results` när Workern körs lokalt.

### KV

Den lokala Workern använder en beständig, separat KV-instans. Följande nycklar hanteras:

- `latest-results`
- `latest-checksums`
- `last-successful-update`
- `last-error`

Produktionsbindingen `VALNATT_CACHE` pekar på det publicerade KV-namespacet. Lokal utveckling använder fortfarande Wranglers separata lokala lagring.

### Cron

Workerns `scheduled`-handler körs enligt `* * * * *`, alltså en gång per minut. Lokalt kan den testas via Wranglers schemalagda testväg.

### Valmyndighetens index

Workern använder den officiella adressen:

```text
https://resultat.val.se/resultatfiler/val2026/index.md5
```

Parsern accepterar endast MD5-rader med relativa ZIP-sökvägar inom Valmyndighetens resultatkatalog. En tom simulationsfil tolkas som ett index utan resultatfiler.

Efter hämtningen jämförs indexet mot `latest-checksums`. Bara nya eller ändrade poster markeras för fortsatt bearbetning, och borttagna poster rensas ur nästa KV-snapshot.

Endast kommunfullmäktigefiler för Bengtsfors (`1460`), Åmål (`1492`), Mellerud (`1461`) och Dals-Ed (`1438`) hämtas. Varje ändrat ZIP-arkiv storleksbegränsas, MD5-verifieras mot indexet och kontrolleras mot osäkra sökvägar innan JSON tolkas. Checksummorna skrivs till KV först när hela omgången har lyckats.

Normaliseringen använder kommunens totalsiffror och partier från mandatfördelningsfilens `valomrade`. Demodata ersätts först när samtliga fyra kommuner finns i samma kompletta resultatunderlag. Senare uppdateringar sammanfogas med oförändrade kommuner från `latest-results`. Aktivt räkningstillfälle styrs av `VAL_RESULT_STAGE`, som är `preliminar` fram till ett uttryckligt byte efter valet.

### Driftstatus och fel

Cron-fel kategoriseras och sparas i `last-error` utan att `latest-results` eller checksummorna skrivs över. Ett lyckat senare försök uppdaterar `last-successful-update` och rensar felet. API:t fortsätter servera senast kända resultat med driftstatusen `ok`, `waiting`, `stale` eller `error`; data betraktas som fördröjd efter 25 minuter utan lyckad källkontroll. Tekniska fel loggas i Workern men skickas inte till frontend.

## Lokal frontend

```powershell
pnpm --filter @valnatt/frontend dev
```

API-adressen läses från `VITE_RESULTS_API_URL`. Under lokal utveckling används `http://127.0.0.1:8787/api/results` automatiskt.

## Kontroll

Kör strukturkontrollen från projektroten:

```powershell
pnpm check:structure
```

Projektet använder inga hemligheter i repositoryt. Lokala miljöfiler och Cloudflare-utvecklingsvariabler ignoreras av Git.
