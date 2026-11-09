import { defineConfig, type Options } from "tsup";
import { generateEmailTemplateIndex } from "./plugin.mjs";

export default defineConfig(async (options: Options) => {
  generateEmailTemplateIndex();
  return {
    entry: ["./src/index.ts"],
    format: ["cjs", "esm"],
    clean: true,
    dts: true,
    ...options,
  };
});
