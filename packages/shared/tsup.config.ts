import { defineConfig, type Options } from "tsup";
import tsupBarrelPlugin from "./plugin.mjs";

export default defineConfig(async (options: Options) => {
  return {
    entry: ["./src/index.ts"],
    format: ["cjs", "esm"],
    plugins: [tsupBarrelPlugin()],
    clean: true,
    dts: true,
    ...options,
  };
});
