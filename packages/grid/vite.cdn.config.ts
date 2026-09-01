import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@titangrid/core": path.resolve(root, "../core/src/index.ts"),
    },
  },
  build: {
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(root, "src/cdn.ts"),
      formats: ["es"],
      fileName: () => "titangrid.js",
    },
    rollupOptions: {
      external: [],
    },
  },
});
