import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(root, "../dist/index.js");
const max = 30 * 1024;
const gz = gzipSync(readFileSync(file)).byteLength;
if (gz > max) {
  console.error(`ESM gzip ${gz} bytes exceeds budget of ${max} bytes`);
  process.exit(1);
}
console.log(`ESM gzip ${gz} / ${max} bytes`);
