import { overrideContentModuleState } from "../utils/content-features";

import { test as base } from "./test.fixture";

import type { ContentModule } from "../utils/content-features";

/** Worker-tenant test with the given content modules switched on, restored to their original state afterwards. */
export const testWithContentModules = (...modules: ContentModule[]) =>
  base.extend<{ _contentModules: void }>({
    _contentModules: [
      async ({ cleanup, workerTenantApiClient }, use) => {
        // Each restore is registered right after its override, so a failed setup still restores what changed.
        for (const module of modules) {
          cleanup.add(
            await overrideContentModuleState(workerTenantApiClient, module, { enabled: true }),
          );
        }

        await use();
      },
      { auto: true },
    ],
  });
