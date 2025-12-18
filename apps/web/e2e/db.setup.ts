import { execSync } from "child_process";
import path from "path";

import { test as setup } from "@playwright/test";

setup("database reset", async () => {
  const clearDbAndContainers = () => {
    const apiDir = path.resolve(process.cwd(), "../api");
    const command =
      "docker stop $(docker ps -a -q) && docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed";
    execSync(command, { cwd: apiDir, stdio: "inherit", shell: true as unknown as string });
  };

  clearDbAndContainers();
});
