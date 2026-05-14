import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    clean: true,
    dts: true,
  },
  {
    entry: {
      main: "src/player/main.ts",
    },
    format: ["iife"],
    platform: "browser",
    globalName: "MentingoScormExportRuntime",
    clean: false,
    dts: false,
    minify: true,
    outDir: "dist/player",
  },
]);
