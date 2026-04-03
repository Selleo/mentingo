// Example only: no real selectors/endpoints.
import { test as setup } from "@playwright/test";

const WORKER_COUNT = Number(process.env.PW_WORKERS ?? 4);

setup("prepare auth states", async ({ browser }) => {
  // 1) Shared readonly state
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    // placeholder login
    await page.goto("/auth/login");
    // await loginReadonly(page)

    await context.storageState({ path: "e2e/.auth/readonly.json" });
    await context.close();
  }

  // 2) Per-worker writer states
  for (let workerIndex = 0; workerIndex < WORKER_COUNT; workerIndex += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();

    // placeholder login
    await page.goto("/auth/login");
    // await loginWriterForWorker(page, workerIndex)

    await context.storageState({ path: `e2e/.auth/writer-worker-${workerIndex}.json` });
    await context.close();
  }
});
