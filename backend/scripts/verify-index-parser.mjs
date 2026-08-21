import assert from "node:assert/strict";
import { parseIndexMd5 } from "../src/valmyndigheten.ts";

const productionIndexUrl = "https://resultat.val.se/resultatfiler/val2026/index.md5";
const documentedSample = [
  "721fbd8bea159b87dc4857d737e34f14 ./p/rd/Val_2026_preliminar_00_RD.zip",
  "7167df1b70dc7a015e8d9621f8150e76 ./s/rd/Val_2026_slutlig_00_RD.zip",
].join("\n");

const entries = parseIndexMd5(documentedSample, productionIndexUrl);

assert.equal(entries.length, 2);
assert.deepEqual(entries[0], {
  checksum: "721fbd8bea159b87dc4857d737e34f14",
  path: "p/rd/Val_2026_preliminar_00_RD.zip",
  url: "https://resultat.val.se/resultatfiler/val2026/p/rd/Val_2026_preliminar_00_RD.zip",
});

assert.deepEqual(
  parseIndexMd5("d41d8cd98f00b204e9800998ecf8427e  -\n", productionIndexUrl),
  [],
);

assert.throws(
  () => parseIndexMd5("721fbd8bea159b87dc4857d737e34f14 ../hemlig.zip", productionIndexUrl),
  /Otillåten filsökväg/,
);

assert.throws(
  () => parseIndexMd5("inte-en-checksumma ./p/fil.zip", productionIndexUrl),
  /Ogiltig rad/,
);

assert.throws(
  () => parseIndexMd5(`${documentedSample.split("\n")[0]}\n${documentedSample.split("\n")[0]}`, productionIndexUrl),
  /Dubblett/,
);

console.log("Indexparsern godkänner dokumenterat format och stoppar ogiltiga sökvägar.");
