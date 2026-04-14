import { test as base } from "@playwright/test";

type CleanupTask = () => Promise<void> | void;

export const cleanupFixture = base.extend<{
  cleanup: {
    add: (task: CleanupTask) => void;
  };
}>({
  cleanup: async ({ baseURL }, use, testInfo) => {
    void baseURL;
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
      const message = errors
        .map((error, index) => {
          if (error instanceof Error) {
            return `${index + 1}. ${error.message}`;
          }

          return `${index + 1}. ${String(error)}`;
        })
        .join("\n");

      throw new Error(
        `Cleanup failed in "${testInfo.title}" with ${errors.length} error(s)\n${message}`,
      );
    }
  },
});
