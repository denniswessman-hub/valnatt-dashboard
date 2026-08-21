import assert from "node:assert/strict";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { zipSync } from "fflate";
import {
  downloadResultArchive,
  readJsonFilesFromZip,
  selectRelevantMunicipalityFiles,
} from "../src/resultArchives.ts";

const zipBytes = zipSync({
  "Val_20260913_preliminar_rostfordelning_1460_KF.json": utf8ToBytes(
    JSON.stringify({ test: true, kommun: "Bengtsfors" }),
  ),
  "Val_20260913_preliminar_rostfordelning_1460_KF_sign.sha256": utf8ToBytes("signatur"),
});

const source = {
  checksum: bytesToHex(md5(zipBytes)),
  path: "p/kf/Val_20260913_preliminar_1460_KF.zip",
  url: "https://resultat.val.se/resultatfiler/val2026/p/kf/Val_20260913_preliminar_1460_KF.zip",
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(zipBytes, {
  status: 200,
  headers: { "content-length": String(zipBytes.byteLength) },
});

try {
  const archive = await downloadResultArchive(source);
  assert.equal(archive.files.length, 1);
  assert.deepEqual(archive.files[0].data, { test: true, kommun: "Bengtsfors" });

  await assert.rejects(
    () => downloadResultArchive({ ...source, checksum: "0".repeat(32) }),
    /Checksumkontrollen misslyckades/,
  );
} finally {
  globalThis.fetch = originalFetch;
}

const selected = selectRelevantMunicipalityFiles([
  source,
  { ...source, path: "p/kf/Val_20260913_preliminar_1492_KF.zip" },
  { ...source, path: "p/kf/Val_20260913_preliminar_1480_KF.zip" },
  { ...source, path: "p/rd/Val_20260913_preliminar_00_RD.zip" },
]);
assert.deepEqual(selected.map(({ path }) => path), [
  "p/kf/Val_20260913_preliminar_1460_KF.zip",
  "p/kf/Val_20260913_preliminar_1492_KF.zip",
]);

const invalidJsonZip = zipSync({ "fel.json": utf8ToBytes("inte json") });
assert.throws(
  () => readJsonFilesFromZip(invalidJsonZip, "fel.zip"),
  /kunde inte tolkas/,
);

const unsafeZip = zipSync({ "../otillaten.json": utf8ToBytes("{}") });
assert.throws(
  () => readJsonFilesFromZip(unsafeZip, "otillaten.zip"),
  /otillåten filsökväg/,
);

console.log("ZIP-hämtning, MD5-kontroll, urval och JSON-tolkning fungerar.");
