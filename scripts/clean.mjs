import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const targets = [
  "apps/api/dist",
  "apps/web/dist",
  "packages/shared/dist",
  "apps/api/coverage",
  "apps/web/coverage",
  "packages/shared/coverage",
];

await Promise.all(
  targets.map(async (target) => {
    await rm(resolve(target), { recursive: true, force: true });
  }),
);

console.log(`Cleaned ${targets.length} build output directories.`);
