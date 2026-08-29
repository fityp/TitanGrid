import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@megagrid/grid": path.resolve(root, "../../packages/grid/src/index.ts"),
      "@megagrid/core": path.resolve(root, "../../packages/core/src/index.ts"),
      "@megagrid/grid/styles.css": path.resolve(root, "../../packages/grid/src/styles.css"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
