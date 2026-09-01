import { existsSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json");
const backup = `${pkgPath}.prepack-backup`;
if (existsSync(backup)) renameSync(backup, pkgPath);
