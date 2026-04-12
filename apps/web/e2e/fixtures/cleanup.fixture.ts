import { test as base } from "@playwright/test";

type CleanupTask = () => Promise<void> | void;

export const cleanupFixture = base.extend<{
  cleanup: {
    add: (task: CleanupTask) => void;
  };
}>({
  cleanup: async (_, use, testInfo) => {
    const tasks: CleanupTask[] = [];

    await use({
      add: (task) => {
        tasks.push(task);
      },
    });

    const errors: unknown[] = [];

    for (const task of [...tasks].reverse()) {
      try {
        await task();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Cleanup failed in "${testInfo.title}" with ${errors.length} error(s)`);
    }
  },
});
