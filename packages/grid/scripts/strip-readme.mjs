import { existsSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(pkgRoot, "package.json");
const backup = `${pkgPath}.prepack-backup`;
const pkgReadme = path.join(pkgRoot, "README.md");

if (existsSync(backup)) renameSync(backup, pkgPath);
if (existsSync(pkgReadme)) unlinkSync(pkgReadme);
