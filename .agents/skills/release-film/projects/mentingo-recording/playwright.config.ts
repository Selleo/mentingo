import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

const servers = Array.isArray(base.webServer) ? base.webServer : [base.webServer].filter(Boolean);

export default defineConfig({
  ...base,
  workers: 1,
  projects: base.projects?.map((project) => ({
    ...project,
    ...(project.name === "setup-auth" ? { testMatch: /release-film\.auth\.setup\.ts$/ } : {}),
  })),
  webServer: servers.map((server) => {
    if (!server) throw new Error("Release-film requires the release's web servers");
    const command = server.command.replace("pnpm db:seed-e2e", "pnpm db:seed");
    if (command.includes("db:seed-e2e")) {
      throw new Error("Release-film must use the populated demo seed");
    }
    return { ...server, command };
  }),
});
