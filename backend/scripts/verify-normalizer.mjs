import assert from "node:assert/strict";
import { normalizeDashboardUpdate } from "../src/normalizer.ts";
import { mockResults } from "../src/mockData.ts";

const municipalities = [
  ["1460", "Bengtsfors"],
  ["1492", "Åmål"],
  ["1461", "Mellerud"],
  ["1438", "Dals-Ed"],
];

function buildArchive(code, name, options = {}) {
  const votes = options.votes ?? 100;
  const sourceUpdatedAt = options.sourceUpdatedAt ?? "2026-09-13T19:15:00Z";
  const isTest = options.test ?? true;

  return {
    source: {
      checksum: "1".repeat(32),
      path: `p/kf/Val_2026_preliminar_${code}_KF.zip`,
      url: `https://resultat.val.se/resultatfiler/val2026/p/kf/Val_2026_preliminar_${code}_KF.zip`,
    },
    files: [
      {
        name: `Val_2026_preliminar_mandatfordelning_${code}_KF.json`,
        data: {
          valtillfalle: "Val 2026",
          rakningstillfalle: "preliminär",
          valtyp: "KF",
          valdatum: "2026-09-13",
          senasteUppdateringstid: sourceUpdatedAt,
          test: isTest,
          valomrade: {
            namn: name,
            kod: code,
            antalValdistriktRaknade: 2,
            antalValdistriktSomSkaRaknas: 4,
            totaltAntalRoster: votes + 5,
            rostfordelning: {
              rosterPaverkaMandat: {
                partiRoster: [
                  {
                    partibeteckning: "Testpartiet",
                    partiforkortning: "TP",
                    partikod: "1001",
                    fargkod: "C8102E",
                    ordningsnummer: 1,
                    antalRoster: votes,
                    andelRoster: 95.2,
                    forandringAntalRoster: 10,
                    forandringAndelRoster: 1.2,
                  },
                ],
                rosterOvrigaPartier: {
                  antalRoster: 5,
                  andelRoster: 4.8,
                  forandringAntalRoster: null,
                  forandringAndelRoster: null,
                },
              },
            },
          },
        },
      },
      {
        name: `Val_2026_preliminar_rostfordelning_${code}_KF.json`,
        data: { valdistrikt: [] },
      },
    ],
  };
}

const archives = municipalities.map(([code, name], index) =>
  buildArchive(code, name, {
    sourceUpdatedAt: `2026-09-13T19:${15 + index}:00Z`,
  }),
);

const normalized = normalizeDashboardUpdate(
  archives,
  mockResults,
  "2026-09-13T19:20:00Z",
  "preliminar",
);

assert.ok(normalized);
assert.equal(normalized.source, "Valmyndigheten");
assert.equal(normalized.election, "Kommunfullmäktige 2026");
assert.equal(normalized.status, "test");
assert.equal(normalized.lastChangedAt, "2026-09-13T19:18:00.000Z");
assert.deepEqual(
  normalized.municipalities.map(({ code }) => code),
  ["1460", "1492", "1461", "1438"],
);
assert.deepEqual(normalized.municipalities[0].parties, [
  {
    code: "TP",
    name: "Testpartiet",
    votes: 100,
    percent: 95.2,
    color: "#C8102E",
    changeVotes: 10,
    changePercent: 1.2,
  },
  {
    code: "ÖVR",
    name: "Övriga partier",
    votes: 5,
    percent: 4.8,
    color: "#667085",
    changeVotes: undefined,
    changePercent: undefined,
  },
]);

assert.throws(
  () => normalizeDashboardUpdate(
    archives.slice(0, 3),
    mockResults,
    "2026-09-13T19:20:00Z",
    "preliminar",
  ),
  /Resultat saknas för kommunkod 1438/,
);

const changedBengtsfors = buildArchive("1460", "Bengtsfors", {
  votes: 125,
  sourceUpdatedAt: "2026-09-13T19:25:00Z",
  test: false,
});
const merged = normalizeDashboardUpdate(
  [changedBengtsfors],
  normalized,
  "2026-09-13T19:26:00Z",
  "preliminar",
);

assert.ok(merged);
assert.equal(merged.municipalities[0].parties[0].votes, 125);
assert.equal(merged.municipalities[1].name, "Åmål");
assert.equal(merged.status, "test");

const checkedOnly = normalizeDashboardUpdate(
  [],
  normalized,
  "2026-09-13T19:30:00Z",
  "preliminar",
);
assert.equal(checkedOnly?.lastCheckedAt, "2026-09-13T19:30:00Z");
assert.equal(
  normalizeDashboardUpdate([], mockResults, "2026-09-13T19:30:00Z", "preliminar"),
  null,
);

console.log("Normaliseringen validerar, sammanfogar och ordnar fyra kommunresultat.");
