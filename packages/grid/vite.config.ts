import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: path.resolve(root, "tsconfig.build.json"),
      rollupTypes: true,
      bundledPackages: ["@titangrid/core"],
    }),
  ],
  resolve: {
    alias: {
      "@titangrid/core": path.resolve(root, "../core/src/index.ts"),
    },
  },
  build: {
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    lib: {
      entry: path.resolve(root, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [],
    },
  },
});
