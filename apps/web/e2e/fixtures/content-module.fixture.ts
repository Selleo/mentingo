import { overrideContentModuleState } from "../utils/content-features";

import { test as base } from "./test.fixture";

import type { ContentModule } from "../utils/content-features";

/** Worker-tenant test with the given content modules switched on, restored to their original state afterwards. */
export const testWithContentModules = (...modules: ContentModule[]) =>
  base.extend<{ _contentModules: void }>({
    _contentModules: [
      async ({ workerTenantApiClient }, use) => {
        const restores: Array<() => Promise<void>> = [];

        try {
          for (const module of modules) {
            restores.push(
              await overrideContentModuleState(workerTenantApiClient, module, { enabled: true }),
            );
          }

          await use();
        } finally {
          for (const restore of restores.reverse()) await restore();
        }
      },
      { auto: true },
    ],
  });
