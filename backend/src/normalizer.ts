import type {
  DistrictResult,
  DashboardResult,
  MunicipalityResult,
  PartyResult,
} from "./types";
import {
  TARGET_MUNICIPALITY_CODES,
  type ParsedResultArchive,
  type ResultStage,
} from "./resultArchives.ts";
import { bengtsforsDistricts } from './waitingData.ts';

const SOURCE_NAME = "Valmyndigheten";
const FALLBACK_PARTY_COLOR = "#667085";
const MANDATE_FILE_PATTERN = /_mandatfordelning_\d{4}_KF\.json$/i;
const ARCHIVE_CODE_PATTERN = /_(\d{4})_KF\.zip$/i;

type NormalizedMunicipality = {
  municipality: MunicipalityResult;
  sourceUpdatedAt: string;
  electionYear: string;
  test: boolean;
};

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} måste vara ett objekt.`);
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}.${key} måste vara en text.`);
  }

  return value.trim();
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} måste vara ett tal.`);
  }

  return value;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
  path: string,
): number {
  const value = readNumber(record, key, path);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${path}.${key} måste vara ett positivt heltal eller noll.`);
  }

  return value;
}

function readOptionalNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
): number | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} måste vara ett tal eller null.`);
  }

  return value;
}

function normalizeStage(value: string, path: string): ResultStage {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized === "preliminar" || normalized === "slutlig") {
    return normalized;
  }

  throw new Error(`${path} har ett okänt räkningstillfälle.`);
}

function normalizeColor(value: string): string {
  const color = value.trim();

  if (/^#[a-f0-9]{6}$/i.test(color)) {
    return color;
  }

  if (/^[a-f0-9]{6}$/i.test(color)) {
    return `#${color}`;
  }

  return FALLBACK_PARTY_COLOR;
}

function normalizeParty(
  value: unknown,
  index: number,
): PartyResult & { order: number } {
  const path = `valomrade.rostfordelning.rosterPaverkaMandat.partiRoster[${index}]`;
  const party = asRecord(value, path);
  const percent = readNumber(party, "andelRoster", path);

  if (percent < 0 || percent > 100) {
    throw new Error(`${path}.andelRoster måste vara mellan 0 och 100.`);
  }

  return {
    code: readString(party, "partiforkortning", path),
    name: readString(party, "partibeteckning", path),
    votes: readNonNegativeInteger(party, "antalRoster", path),
    percent,
    color: normalizeColor(readString(party, "fargkod", path)),
    changeVotes: readOptionalNumber(party, "forandringAntalRoster", path),
    changePercent: readOptionalNumber(party, "forandringAndelRoster", path),
    order: readNonNegativeInteger(party, "ordningsnummer", path),
  };
}

function normalizeArchive(
  archive: ParsedResultArchive,
  expectedStage: ResultStage,
): NormalizedMunicipality {
  const mandateFiles = archive.files.filter((file) => MANDATE_FILE_PATTERN.test(file.name));

  if (mandateFiles.length !== 1) {
    throw new Error(`${archive.source.path} måste innehålla exakt en mandatfördelningsfil.`);
  }

  const archiveCode = ARCHIVE_CODE_PATTERN.exec(archive.source.path)?.[1];

  if (!archiveCode || !TARGET_MUNICIPALITY_CODES.includes(
    archiveCode as (typeof TARGET_MUNICIPALITY_CODES)[number],
  )) {
    throw new Error(`${archive.source.path} har en oväntad kommunkod.`);
  }

  const root = asRecord(mandateFiles[0].data, "root");
  const valtyp = readString(root, "valtyp", "root");

  if (valtyp !== "KF") {
    throw new Error(`${archive.source.path} innehåller inte ett kommunfullmäktigeval.`);
  }

  const sourceStage = normalizeStage(
    readString(root, "rakningstillfalle", "root"),
    "root.rakningstillfalle",
  );

  if (sourceStage !== expectedStage) {
    throw new Error(`${archive.source.path} har fel räkningstillfälle.`);
  }

  const valdatum = readString(root, "valdatum", "root");
  const electionYear = /^(\d{4})-\d{2}-\d{2}$/.exec(valdatum)?.[1];

  if (!electionYear) {
    throw new Error("root.valdatum måste anges som ÅÅÅÅ-MM-DD.");
  }

  const latestUpdate = readString(root, "senasteUppdateringstid", "root");

  if (!Number.isFinite(Date.parse(latestUpdate))) {
    throw new Error("root.senasteUppdateringstid är inte en giltig tidpunkt.");
  }

  if (root.test !== undefined && typeof root.test !== "boolean") {
    throw new Error("root.test måste vara boolean om fältet finns.");
  }

  const area = asRecord(root.valomrade, "valomrade");
  const code = readString(area, "kod", "valomrade");

  if (code !== archiveCode) {
    throw new Error(`Kommunkoden i ${archive.source.path} stämmer inte med JSON-innehållet.`);
  }

  const districtsReported = readNonNegativeInteger(
    area,
    "antalValdistriktRaknade",
    "valomrade",
  );
  const districtsTotal = readNonNegativeInteger(
    area,
    "antalValdistriktSomSkaRaknas",
    "valomrade",
  );

  if (districtsReported > districtsTotal) {
    throw new Error(`Antalet räknade valdistrikt är för högt i ${archive.source.path}.`);
  }

  const voteDistribution = asRecord(area.rostfordelning, "valomrade.rostfordelning");
  const validVotes = asRecord(
    voteDistribution.rosterPaverkaMandat,
    "valomrade.rostfordelning.rosterPaverkaMandat",
  );
  const partyValues = validVotes.partiRoster;

  if (!Array.isArray(partyValues)) {
    throw new Error("valomrade.rostfordelning.rosterPaverkaMandat.partiRoster måste vara en lista.");
  }

  const normalizedParties = partyValues.map(normalizeParty);
  const partyCodes = new Set<string>();

  for (const party of normalizedParties) {
    if (partyCodes.has(party.code)) {
      throw new Error(`Dubblett av partiförkortningen ${party.code} i ${archive.source.path}.`);
    }

    partyCodes.add(party.code);
  }

  normalizedParties.sort((left, right) =>
    left.order - right.order
    || right.votes - left.votes
    || left.code.localeCompare(right.code, "sv"),
  );

  const otherParties = asRecord(
    validVotes.rosterOvrigaPartier,
    "valomrade.rostfordelning.rosterPaverkaMandat.rosterOvrigaPartier",
  );
  const otherVotes = readNonNegativeInteger(
    otherParties,
    "antalRoster",
    "valomrade.rostfordelning.rosterPaverkaMandat.rosterOvrigaPartier",
  );

  const parties: PartyResult[] = normalizedParties.map(({ order: _order, ...party }) => party);

  if (otherVotes > 0) {
    const otherPercent = readNumber(
      otherParties,
      "andelRoster",
      "valomrade.rostfordelning.rosterPaverkaMandat.rosterOvrigaPartier",
    );

    if (otherPercent < 0 || otherPercent > 100) {
      throw new Error("Andelen för övriga partier måste vara mellan 0 och 100.");
    }

    parties.push({
      code: "ÖVR",
      name: "Övriga partier",
      votes: otherVotes,
      percent: otherPercent,
      color: FALLBACK_PARTY_COLOR,
      changeVotes: readOptionalNumber(
        otherParties,
        "forandringAntalRoster",
        "valomrade.rostfordelning.rosterPaverkaMandat.rosterOvrigaPartier",
      ),
      changePercent: readOptionalNumber(
        otherParties,
        "forandringAndelRoster",
        "valomrade.rostfordelning.rosterPaverkaMandat.rosterOvrigaPartier",
      ),
    });
  }

  const districtFiles = archive.files.filter(file => /_rostfordelning_\d{4}_KF\.json$/i.test(file.name));
  if (districtFiles.length !== 1) throw new Error('Exakt en röstfördelningsfil krävs.');
  const districtRoot = asRecord(districtFiles[0].data, 'rostfordelning');
  if (!Array.isArray(districtRoot.valdistrikt)) throw new Error('valdistrikt måste vara en lista.');
  const districts = new Map<string, DistrictResult>(code === '1460'
    ? bengtsforsDistricts.map(d => [d.code, { ...d }]) : []);
  const seen = new Set<string>();
  for (const item of districtRoot.valdistrikt) {
    const d = asRecord(item, 'valdistrikt');
    if (d.kommunkod !== code) throw new Error('Valdistrikt har fel kommunkod.');
    const districtCode = readString(d, 'valdistriktskod', 'valdistrikt');
    const key = districtCode.startsWith(code) && districtCode.length === 8 ? districtCode.slice(4) : districtCode;
    if (seen.has(key)) throw new Error('Dubblett av valdistrikt.');
    seen.add(key);
    const reported = typeof d.rapporteringsTid === 'string' && d.rapporteringsTid.trim() !== '';
    let districtParties: PartyResult[] = [];
    if (reported) {
      const distribution = asRecord(d.rostfordelning, 'valdistrikt.rostfordelning');
      const valid = asRecord(distribution.rosterPaverkaMandat, 'rosterPaverkaMandat');
      if (!Array.isArray(valid.partiRoster)) throw new Error('partiRoster måste vara en lista.');
      districtParties = valid.partiRoster.map(normalizeParty).sort((a,b) => a.order-b.order)
        .map(({order: _order, ...party}) => party);
      const others = asRecord(valid.rosterOvrigaPartier, 'rosterOvrigaPartier');
      const votes = readNonNegativeInteger(others, 'antalRoster', 'rosterOvrigaPartier');
      if (votes > 0) districtParties.push({code:'ÖVR', name:'Övriga partier', votes,
        percent: readNumber(others, 'andelRoster', 'rosterOvrigaPartier'), color:FALLBACK_PARTY_COLOR});
    }
    districts.set(key, { code:key, name:readString(d, 'namn', 'valdistrikt'), reported,
      votesTotal: reported ? readNonNegativeInteger(d, 'totaltAntalRoster', 'valdistrikt') : 0,
      parties:districtParties });
  }

  return {
    municipality: {
      districts: [...districts.values()].sort((a,b) => a.code.localeCompare(b.code)),
      code,
      name: readString(area, "namn", "valomrade"),
      districtsReported,
      districtsTotal,
      votesTotal: readNonNegativeInteger(area, "totaltAntalRoster", "valomrade"),
      parties,
    },
    sourceUpdatedAt: new Date(latestUpdate).toISOString(),
    electionYear,
    test: root.test === true,
  };
}

function latestIso(values: string[]): string {
  return values.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}

export function normalizeDashboardUpdate(
  archives: ParsedResultArchive[],
  previous: DashboardResult,
  checkedAt: string,
  expectedStage: ResultStage,
): DashboardResult | null {
  if (!Number.isFinite(Date.parse(checkedAt))) {
    throw new Error("Kontrolltiden är inte en giltig tidpunkt.");
  }

  if (archives.length === 0) {
    return previous.source === SOURCE_NAME
      ? { ...previous, lastCheckedAt: checkedAt }
      : null;
  }

  const normalized = archives.map((archive) => normalizeArchive(archive, expectedStage));
  const years = new Set(normalized.map(({ electionYear }) => electionYear));

  if (years.size !== 1) {
    throw new Error("Resultatfilerna gäller olika valår.");
  }

  const municipalitiesByCode = new Map<string, MunicipalityResult>();
  const canReusePrevious = previous.source === SOURCE_NAME
    && (previous.status === "test" || previous.status === expectedStage);

  if (canReusePrevious) {
    const previousYear = /(\d{4})$/.exec(previous.election)?.[1];

    if (previousYear && previousYear !== [...years][0]) {
      throw new Error("Det tidigare resultatet gäller ett annat valår.");
    }

    for (const municipality of previous.municipalities) {
      municipalitiesByCode.set(municipality.code, municipality);
    }
  }

  for (const item of normalized) {
    municipalitiesByCode.set(item.municipality.code, item.municipality);
  }

  const missingCodes = TARGET_MUNICIPALITY_CODES.filter(
    (code) => !municipalitiesByCode.has(code),
  );

  if (missingCodes.includes('1460')) {
    throw new Error(`Resultat saknas för kommunkod ${missingCodes.join(", ")}.`);
  }

  const retainsTestData = canReusePrevious
    && previous.status === "test"
    && normalized.length < TARGET_MUNICIPALITY_CODES.length;
  const status = normalized.some(({ test }) => test) || retainsTestData
    ? "test"
    : expectedStage;
  const sourceUpdates = normalized.map(({ sourceUpdatedAt }) => sourceUpdatedAt);

  if (canReusePrevious && previous.lastChangedAt) {
    sourceUpdates.push(previous.lastChangedAt);
  }

  return {
    source: SOURCE_NAME,
    election: `Kommunfullmäktige ${[...years][0]}`,
    status,
    lastCheckedAt: checkedAt,
    lastChangedAt: latestIso(sourceUpdates),
    municipalities: TARGET_MUNICIPALITY_CODES.filter(code => municipalitiesByCode.has(code)).map(
      (code) => municipalitiesByCode.get(code)!,
    ),
  };
}
