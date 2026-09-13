import assert from "node:assert/strict";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { buildZip, env, kvWrites, updateResults, api, setSource, setIndexText, clearEdgeCache, setZipFor, worker } from "./fixture-realistic.mjs";
let currentZip; let indexText;
// 1) Tomt index -> vänteläge
kvWrites.length = 0;
await updateResults(env, "2026-09-13T18:00:00Z");
let r = await api();
assert.equal(r.body.health.status, "waiting");
assert.equal(r.body.municipalities[0].districts.length, 5);
assert.equal(kvWrites.filter(k => !k.startsWith("del:")).length, 1, "tomt index ska ge en KV-skrivning");
console.log("1. Tomt index -> waiting, 5 distrikt, 1 KV-skrivning. OK");
clearEdgeCache();

// 2) Första filen: 2 av 6 räknade
const t1 = "2026-09-13T20:41:12";
currentZip = buildZip(2, t1); setSource(currentZip);
kvWrites.length = 0;
const s2 = await updateResults(env, "2026-09-13T18:50:00Z");
assert.equal(s2.downloadedArchiveCount, 1);
r = await api();
assert.equal(r.body.health.status, "ok");
assert.equal(r.body.source, "Valmyndigheten");
assert.equal(r.body.status, "preliminar");
const m = r.body.municipalities[0];
assert.equal(m.districtsReported, 2);
assert.equal(m.districtsTotal, 6);
assert.equal(m.districts.length, 6, "5 ordinarie + uppsamlingsdistrikt");
assert.deepEqual(m.districts.map(d => d.code), ["0101", "0102", "0613", "0616", "0919", "00"]);
assert.equal(r.body.lastChangedAt, "2026-09-13T18:41:12.000Z", "20:41 svensk tid = 18:41Z");
assert.deepEqual(m.districts.map(d => d.reported), [true, true, false, false, false, false]);
assert.deepEqual(m.districts[0].parties.map(p => p.code), ["M", "C", "L", "KD", "S", "V", "MP", "SD", "ÖVR"], "sorterat efter ordningsnummer");
assert.equal(m.districts[0].votesTotal, Math.round(6044 * 0.22));
assert.equal(m.districts[2].parties.length, 0);
assert.equal(m.parties[0].code, "M");
assert.equal(m.parties[0].color, "#66BEE6");
assert.equal(kvWrites.filter(k => !k.startsWith("del:")).length, 3, "ny fil ska ge 3 KV-skrivningar");
console.log("2. Första resultatfilen: ok, 2/6, uppsamlingsdistrikt med, partier sorterade, 3 KV-skrivningar. lastChangedAt =", r.body.lastChangedAt);
clearEdgeCache();

// 3) Oförändrat index -> ingen ny nedladdning, bara lastSuccessfulUpdate
kvWrites.length = 0;
const s3 = await updateResults(env, "2026-09-13T19:00:00Z");
assert.equal(s3.downloadedArchiveCount, 0);
assert.equal(kvWrites.length, 1);
console.log("3. Oförändrat index: ingen nedladdning, 1 KV-skrivning. OK");

// 4) Alla räknade
currentZip = buildZip(6, "2026-09-13T23:12:00"); setSource(currentZip);
await updateResults(env, "2026-09-13T21:20:00Z");
r = await api();
assert.equal(r.body.municipalities[0].districtsReported, 6);
assert.ok(r.body.municipalities[0].districts.every(d => d.reported));
console.log("4. Alla 6 räknade. OK. lastChangedAt =", r.body.lastChangedAt);

// 5) Källfel efteråt -> senast kända resultat behålls, health=error
clearEdgeCache();
setIndexText("trasig rad");
let threw = false;
try { await updateResults(env, "2026-09-13T21:30:00Z"); } catch (e) { threw = true; const { recordUpdateError } = await import("../src/operationalStatus.ts"); await recordUpdateError(env, "2026-09-13T21:30:00Z", e); }
assert.ok(threw);
r = await api();
assert.equal(r.body.health.status, "error");
assert.equal(r.body.municipalities[0].districtsReported, 6, "gamla resultat behålls vid fel");
console.log("5. Källfel: resultat behålls, health=error, lastError.code =", r.body.health.lastError.code);

// 6) Återhämtning
setSource(currentZip);
clearEdgeCache();
await updateResults(env, "2026-09-13T21:40:00Z");
r = await api();
assert.equal(r.body.health.status, "ok");
assert.equal(r.body.health.lastError, null);
console.log("6. Återhämtning: ok, felet rensat. OK");

// 7) Grannkommun med trasig fil ska inte stoppa Bengtsfors
clearEdgeCache();
kvWrites.length = 0;
const goodZip = buildZip(6, "2026-09-13T23:30:00");
setIndexText(`${bytesToHex(md5(goodZip))}  ./p/kf/Val_2026_preliminar_1460_KF.zip\n${"a".repeat(32)}  ./p/kf/Val_2026_preliminar_1492_KF.zip\n`);
setZipFor("1460", goodZip);
setZipFor("1492", new Uint8Array([1, 2, 3])); // fel checksumma/trasig zip
const s7 = await updateResults(env, "2026-09-13T21:50:00Z");
assert.equal(s7.downloadedArchiveCount, 1);
r = await api();
assert.equal(r.body.health.status, "ok");
assert.equal(r.body.municipalities.length, 1, "Åmål hoppas över, Bengtsfors kvar");
const storedChecksums = JSON.parse(await env.VALNATT_CACHE.get("latest-checksums"));
assert.ok(!("p/kf/Val_2026_preliminar_1492_KF.zip" in storedChecksums), "den trasiga filen ska försökas igen");
console.log("7. Trasig grannfil hoppas över, Bengtsfors uppdateras, filen försöks igen. OK");

// 8) Grannkommun publiceras före Bengtsfors -> fortsatt vänteläge, inget fel
const kvFresh = new Map();
const env2 = { ...env, VALNATT_CACHE: { async get(k, t) { const v = kvFresh.get(k) ?? null; return t === "json" && v !== null ? JSON.parse(v) : v; }, async put(k, v) { kvFresh.set(k, v); }, async delete(k) { kvFresh.delete(k); } } };
const amalZip = buildZip(3, "2026-09-13T20:10:00", "1492", "Åmål");
setIndexText(`${bytesToHex(md5(amalZip))}  ./p/kf/Val_2026_preliminar_1492_KF.zip\n`);
setZipFor("1492", amalZip);
const s8 = await updateResults(env2, "2026-09-13T18:20:00Z");
assert.equal(s8.dashboardUpdated, false);
assert.equal(kvFresh.has("latest-checksums"), false, "inga checksummor sparas i vänteläge");
clearEdgeCache();
const res8 = await worker.fetch(new Request("https://x/api/results"), env2, { waitUntil() {} });
const body8 = await res8.json();
assert.equal(body8.health.status, "waiting");
assert.equal(body8.municipalities[0].districts.length, 5);
console.log("8. Åmål före Bengtsfors: vänteläge utan fel. OK");

// 9) Skrivningar per dygn (worst case)
console.log("Worst case KV-skrivningar/dygn vid 144 körningar och ny fil varje gång: 144*3 =", 144 * 3);
