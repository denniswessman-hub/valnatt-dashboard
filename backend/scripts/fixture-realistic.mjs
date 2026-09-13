// Realistiskt slut-till-slut-test: index.md5 -> ZIP -> normalisering -> KV -> API-svar.
// Fixturen bygger på Valmyndighetens verkliga 2022-struktur för Bengtsfors KF
// (Val_20220911_preliminar_1460_KF.zip) med de fält som 2026-specen lägger till.
import { zipSync, strToU8 } from "fflate";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { updateResults } from "../src/updateResults.ts";
import worker from "../src/index.ts";

const party = (namn, kort, kod, farg, ord, roster, andel) => ({
  partibeteckning: namn, partiforkortning: kort, partikod: kod, fargkod: farg,
  ordningsnummer: ord, antalRoster: roster, andelRoster: andel,
  deltaMandatfordelning: "ja", forandringAntalRoster: ord % 2 ? 12 : -8, forandringAndelRoster: ord % 3 === 0 ? 0 : (ord % 2 ? 1.4 : -2.3),
});
const parties = (scale) => [
  party("Moderaterna", "M", "0001", "#66BEE6", 1, Math.round(1892 * scale), 32.1),
  party("Centerpartiet", "C", "0004", "#63A91D", 2, Math.round(577 * scale), 9.8),
  party("Liberalerna", "L", "0003", "#3399FF", 3, Math.round(160 * scale), 2.7),
  party("Kristdemokraterna", "KD", "0068", "#1B5CB1", 4, Math.round(210 * scale), 3.6),
  party("Arbetarepartiet-Socialdemokraterna", "S", "0002", "#FF0000", 5, Math.round(1871 * scale), 31.7),
  party("Vänsterpartiet", "V", "0005", "#C40000", 6, Math.round(254 * scale), 4.3),
  party("Miljöpartiet de gröna", "MP", "0055", "#008000", 7, Math.round(71 * scale), 1.2),
  party("Sverigedemokraterna", "SD", "0110", "#4E83A3", 8, Math.round(856 * scale), 14.5),
];
const rostfordelning = (scale) => ({
  rosterPaverkaMandat: {
    antalRoster: Math.round(5901 * scale),
    // Verklig fil: partiRoster är INTE sorterad efter ordningsnummer i distriktsfilen.
    partiRoster: [parties(scale)[0], parties(scale)[4], ...parties(scale).slice(1, 4), ...parties(scale).slice(5)],
    rosterOvrigaPartier: { antalRoster: 10, andelRoster: 0.2, forandringAntalRoster: null, forandringAndelRoster: null },
  },
  rosterEjPaverkaMandat: { antalRoster: 143, andelRosterAvTotaltAntalRoster: 2.4 },
});

const head = (raknade, tid) => ({
  valtillfalle: "Val_2026", valklass: "Ordinarie val", rakningstillfalle: "preliminär", valtyp: "KF",
  valdatum: "2026-09-13", tidigareValdatum: "2022-09-11", test: false,
  senasteUppdateringstid: tid, antalUppdateringar: raknade,
});

function district(namn, typ, kod, reported, scale, tid) {
  return {
    namn, valdistriktstyp: typ, rapporteringsTid: reported ? tid : null,
    totaltAntalRoster: reported ? Math.round(6044 * scale) : null,
    antalRostberattigade: typ === "valdistrikt" ? 1500 : null, valdeltagandeVallokal: null,
    valdistriktskod: kod, kommunkod: "1460", lankod: "14", valomradeskod: "1460", kretskod: "146000",
    kommunvalkretsNamn: "Bengtsfors", kommunvalkretsKod: "146000",
    statusJamforelse: "kan jämföras",
    rostfordelning: reported ? rostfordelning(scale) : { rosterPaverkaMandat: { antalRoster: 0, partiRoster: [], rosterOvrigaPartier: { antalRoster: 0, andelRoster: 0 } } },
  };
}

function buildZip(raknade, tid, code = "1460", namn = "Bengtsfors") {
  const mandat = {
    ...head(raknade, tid),
    valomrade: {
      namn, kod: code, rapporteringsTid: tid,
      antalValdistriktRaknade: raknade, antalValdistriktSomSkaRaknas: 6,
      totaltAntalRoster: Math.round(6044 * raknade / 6), antalRostberattigade: 7642, valdeltagande: 79.1,
      valomradessparrProcent: 2, meddelandetext: "",
      rostfordelning: rostfordelning(raknade / 6),
      mandatfordelning: { partiLista: [] },
    },
  };
  const rost = {
    ...head(raknade, tid), antalValdistriktRaknade: raknade, antalValdistriktSomSkaRaknas: 6,
    valdistrikt: [
      district("Uppsamlingsdistrikt 00", "uppsamlingsdistrikt", "146000", raknade >= 6, 0.05, tid),
      district("Nordvästra", "valdistrikt", "14600101", raknade >= 1, 0.22, tid),
      district("Norra", "valdistrikt", "14600102", raknade >= 2, 0.21, tid),
      district("Nordöstra", "valdistrikt", "14600613", raknade >= 3, 0.18, tid),
      district("Sydöstra", "valdistrikt", "14600616", raknade >= 4, 0.17, tid),
      district("Sydvästra", "valdistrikt", "14600919", raknade >= 5, 0.17, tid),
    ],
  };
  if (code !== "1460") for (const d of rost.valdistrikt) { d.kommunkod = code; d.valomradeskod = code; d.valdistriktskod = code + d.valdistriktskod.slice(4); }
  return zipSync({
    [`Val_2026_preliminar_rostfordelning_${code}_KF.json`]: strToU8(JSON.stringify(rost)),
    [`Val_2026_preliminar_mandatfordelning_${code}_KF.json`]: strToU8(JSON.stringify(mandat)),
    [`Val_2026_preliminar_rostfordelning_${code}_KF_sign.sha256`]: strToU8("x".repeat(256)),
    [`Val_2026_preliminar_mandatfordelning_${code}_KF_sign.sha256`]: strToU8("y".repeat(256)),
  });
}

// --- Fejkad KV och fetch ---
const kv = new Map();
const kvWrites = [];
const env = {
  VAL_RESULTS_INDEX_URL: "https://resultat.val.se/resultatfiler/val2026/index.md5",
  VAL_RESULT_STAGE: "preliminar",
  VALNATT_CACHE: {
    async get(key, type) { const v = kv.get(key) ?? null; return type === "json" && v !== null ? JSON.parse(v) : v; },
    async put(key, value) { kvWrites.push(key); kv.set(key, value); },
    async delete(key) { kvWrites.push("del:" + key); kv.delete(key); },
  },
};

let currentZip = null;
const zips = {};
export function setZipFor(code, zip) { zips[code] = zip; }
let indexText = "d41d8cd98f00b204e9800998ecf8427e  -\n";
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.endsWith("index.md5")) return new Response(indexText, { status: 200, headers: { "content-type": "text/plain" } });
  const mm = /_(\d{4})_KF\.zip$/.exec(u);
  if (mm && zips[mm[1]]) return new Response(zips[mm[1]], { status: 200, headers: { "content-type": "application/zip" } });
  if (u.endsWith("Val_2026_preliminar_1460_KF.zip")) return new Response(currentZip, { status: 200, headers: { "content-type": "application/zip" } });
  return new Response("nope", { status: 404 });
};
const cacheStore = new Map();
globalThis.caches = { default: { async match(req) { const s = cacheStore.get(req.url); return s ? s.clone() : undefined; }, async put(req, res) { cacheStore.set(req.url, res); } } };

export function setSource(zip) { currentZip = zip; indexText = `${bytesToHex(md5(zip))}  ./p/kf/Val_2026_preliminar_1460_KF.zip\n`; }
export function setIndexText(t) { indexText = t; }
export function clearEdgeCache() { cacheStore.clear(); }
export { buildZip, env, kvWrites, updateResults, worker };
export async function api() {
  const res = await worker.fetch(new Request("https://valnatt-backend.valnatt-backend.workers.dev/api/results"), env, { waitUntil() {} });
  return { status: res.status, body: await res.json() };
}

