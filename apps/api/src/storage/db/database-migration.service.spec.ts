import { DatabaseMigrationService } from "./database-migration.service";

import type { DatabaseMigrationRepository } from "./database-migration.repository";

describe("DatabaseMigrationService", () => {
  it("uses the shared Core and Workflow migration path and propagates failures", async () => {
    const runMigrations = jest.fn().mockResolvedValue(undefined);
    const service = new DatabaseMigrationService({
      runMigrations,
    } as unknown as DatabaseMigrationRepository);
    await service.runMigrations();
    expect(runMigrations).toHaveBeenCalledTimes(1);
    const failure = new Error("Database migrations failed (42501)");
    runMigrations.mockRejectedValueOnce(failure);
    await expect(service.runMigrations()).rejects.toBe(failure);
  });
});
