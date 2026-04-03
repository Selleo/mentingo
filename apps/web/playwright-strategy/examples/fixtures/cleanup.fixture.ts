import { apiFixture } from "./api.fixture";

import type { CleanupTask } from "../factories/core/cleanup-registry";

export const cleanupFixture = apiFixture.extend<{
  registerCleanup: (task: CleanupTask) => void;
}>({
  registerCleanup: async (args, use, testInfo) => {
    void args;
    const tasks: CleanupTask[] = [];

    await use((task) => {
      tasks.push(task);
    });

    const errors: string[] = [];

    for (const task of [...tasks].reverse()) {
      try {
        await task.run();
      } catch (error) {
        errors.push(`${task.label}: ${String(error)}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Cleanup failed in ${testInfo.title}: ${errors.join(" | ")}`);
    }
  },
});
