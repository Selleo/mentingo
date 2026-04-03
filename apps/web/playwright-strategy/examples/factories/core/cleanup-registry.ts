export type CleanupTask = {
  label: string;
  run: () => Promise<void> | void;
};

export class CleanupRegistry {
  private readonly tasks: CleanupTask[] = [];

  register(task: CleanupTask): void {
    this.tasks.push(task);
  }

  async runAll(): Promise<void> {
    const errors: string[] = [];

    for (const task of [...this.tasks].reverse()) {
      try {
        await task.run();
      } catch (error) {
        errors.push(`${task.label}: ${String(error)}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Cleanup failed: ${errors.join(" | ")}`);
    }
  }
}
