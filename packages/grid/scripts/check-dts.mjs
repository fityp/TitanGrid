import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(root, "../dist/index.d.ts");
const dts = readFileSync(file, "utf8");

const leaks = [
  /private readonly vectors/,
  /this\.rowCount\s*=/,
  /this\.fields\s*=/,
  /uniqueCache\s*=/,
];

for (const re of leaks) {
  if (re.test(dts)) {
    console.error(`index.d.ts leaked implementation (${re})`);
    process.exit(1);
  }
}

if (!/\binterface ColumnStore\b/.test(dts) && !/\btype ColumnStore\b/.test(dts)) {
  console.error("index.d.ts is missing a ColumnStore type");
  process.exit(1);
}

console.log("index.d.ts has no ColumnStore implementation leak");
