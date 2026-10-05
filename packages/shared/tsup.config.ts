import { defineConfig, type Options } from "tsup";
import tsupBarrelPlugin from "./plugin.mjs";

export default defineConfig(async (options: Options) => {
  const common = {
    entry: ["./src/index.ts"],
    plugins: [tsupBarrelPlugin()],
    clean: true,
    dts: true,
    ...options,
  };
  return [
    { ...common, format: ["cjs" as const], noExternal: ["sanitize-html"] },
    { ...common, format: ["esm" as const], clean: false },
  ];
});
