import { access } from "node:fs/promises";

const requiredPaths = [
  "package.json",
  "pnpm-workspace.yaml",
  "frontend/package.json",
  "frontend/src",
  "frontend/src/api",
  "frontend/src/components",
  "frontend/public",
  "backend/package.json",
  "backend/src",
  "backend/wrangler.toml",
];

const missingPaths = [];

for (const path of requiredPaths) {
  try {
    await access(path);
  } catch {
    missingPaths.push(path);
  }
}

if (missingPaths.length > 0) {
  console.error(`Saknade projektvagar:\n- ${missingPaths.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Projektstrukturen ar komplett for del 1.");
}
