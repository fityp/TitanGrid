import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

const repo = process.env.GITHUB_REPOSITORY ?? "fityp/TitanGrid";
const repoName = repo.split("/")[1] || "TitanGrid";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? `/${repoName}/` : "/",
  resolve: {
    alias: [
      {
        find: "titangrid/styles.css",
        replacement: path.resolve(root, "../../packages/grid/src/styles.css"),
      },
      {
        find: "titangrid",
        replacement: path.resolve(root, "../../packages/grid/src/index.ts"),
      },
      {
        find: "@titangrid/core",
        replacement: path.resolve(root, "../../packages/core/src/index.ts"),
      },
    ],
  },
  server: {
    port: 5173,
    host: true,
  },
});
