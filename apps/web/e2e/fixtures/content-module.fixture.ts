import { enableContentModules } from "../utils/content-features";

import { test as base } from "./test.fixture";

import type { ContentModule } from "../utils/content-features";

/** Worker-tenant test with the given content modules switched on before each test. */
export const testWithContentModules = (...modules: ContentModule[]) =>
  base.extend<{ _contentModules: void }>({
    _contentModules: [
      async ({ workerTenantApiClient }, use) => {
        await enableContentModules(workerTenantApiClient, modules);

        await use();
      },
      { auto: true },
    ],
  });
