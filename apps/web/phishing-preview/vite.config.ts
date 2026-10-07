import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hooks = [
  "queries/usePhishingConfiguration",
  "queries/usePhishingOptions",
  "queries/usePhishingScenarios",
  "queries/usePhishingCampaigns",
  "queries/usePhishingReport",
  "queries/useCurrentUser",
  "mutations/useCreatePhishingCampaign",
  "mutations/useCancelPhishingCampaign",
];

export default defineConfig({
  root: path.join(web, "phishing-preview"),
  plugins: [react(), svgr({ include: "**/*.svg?react" })],
  resolve: {
    alias: [
      ...hooks.map((hook) => ({
        find: `~/api/${hook}`,
        replacement: path.join(web, "phishing-preview/fixtures.ts"),
      })),
      { find: "~", replacement: path.join(web, "app") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5198,
    strictPort: true,
    fs: { allow: [web, path.resolve(web, "../..")] },
  },
});
