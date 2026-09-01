import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(root, "package.json");
const readme = readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.trim()) {
  throw new Error("packages/grid/README.md is empty");
}
copyFileSync(pkgPath, `${pkgPath}.prepack-backup`);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.readmeFilename = "README.md";
pkg.readme = readme;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
