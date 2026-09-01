import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoReadmePath = path.resolve(pkgRoot, "../../README.md");
const pkgReadmePath = path.join(pkgRoot, "README.md");
const pkgPath = path.join(pkgRoot, "package.json");

let readme = readFileSync(repoReadmePath, "utf8");
if (!readme.trim()) {
  throw new Error("README.md at the repo root is empty");
}

readme = readme
  .replaceAll('src="docs/logo.png"', 'src="https://raw.githubusercontent.com/fityp/TitanGrid/main/docs/logo.png"')
  .replaceAll("(docs/data.md)", "(https://github.com/fityp/TitanGrid/blob/main/docs/data.md)")
  .replaceAll("(docs/columns.md)", "(https://github.com/fityp/TitanGrid/blob/main/docs/columns.md)");

writeFileSync(pkgReadmePath, readme);
copyFileSync(pkgPath, `${pkgPath}.prepack-backup`);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.readmeFilename = "README.md";
pkg.readme = readme;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
