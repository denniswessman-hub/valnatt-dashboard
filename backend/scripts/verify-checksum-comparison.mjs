import assert from "node:assert/strict";
import {
  compareIndexChecksums,
  getLatestChecksums,
  saveLatestChecksums,
} from "../src/checksums.ts";

const firstEntries = [
  {
    checksum: "11111111111111111111111111111111",
    path: "p/rd/Val_2026_preliminar_00_RD.zip",
    url: "https://resultat.val.se/resultatfiler/val2026/p/rd/Val_2026_preliminar_00_RD.zip",
  },
  {
    checksum: "22222222222222222222222222222222",
    path: "s/rd/Val_2026_slutlig_00_RD.zip",
    url: "https://resultat.val.se/resultatfiler/val2026/s/rd/Val_2026_slutlig_00_RD.zip",
  },
];

const firstComparison = compareIndexChecksums(firstEntries, {});
assert.equal(firstComparison.changedEntries.length, 2);
assert.equal(firstComparison.unchangedCount, 0);
assert.deepEqual(firstComparison.removedPaths, []);

const repeatedComparison = compareIndexChecksums(
  firstEntries,
  firstComparison.currentChecksums,
);
assert.equal(repeatedComparison.changedEntries.length, 0);
assert.equal(repeatedComparison.unchangedCount, 2);
assert.deepEqual(repeatedComparison.removedPaths, []);

const changedEntries = [
  {
    ...firstEntries[0],
    checksum: "33333333333333333333333333333333",
  },
];
const changedComparison = compareIndexChecksums(
  changedEntries,
  firstComparison.currentChecksums,
);
assert.deepEqual(
  changedComparison.changedEntries.map(({ path }) => path),
  [firstEntries[0].path],
);
assert.deepEqual(changedComparison.removedPaths, [firstEntries[1].path]);

const memory = new Map();
const fakeKv = {
  async get(key, type) {
    const value = memory.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  },
  async put(key, value) {
    memory.set(key, value);
  },
};

await saveLatestChecksums(fakeKv, changedComparison.currentChecksums);
assert.deepEqual(
  await getLatestChecksums(fakeKv),
  changedComparison.currentChecksums,
);

memory.set("latest-checksums", JSON.stringify({ fil: "felaktig" }));
await assert.rejects(
  () => getLatestChecksums(fakeKv),
  /ogiltigt format/,
);

console.log("Checksumjämförelsen hittar nya, ändrade, oförändrade och borttagna filer.");
