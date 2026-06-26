import { join } from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { DatabaseMigrationService } from "./database-migration.service";

import type { DatabasePg } from "src/common";

jest.mock("drizzle-orm/postgres-js/migrator", () => ({
  migrate: jest.fn(),
}));

describe("DatabaseMigrationService", () => {
  const dbAdmin = {} as DatabasePg;
  const service = new DatabaseMigrationService(dbAdmin);
  const migrateMock = jest.mocked(migrate);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs Drizzle migrations from the API migrations folder", async () => {
    migrateMock.mockResolvedValue();

    await service.runMigrations();

    expect(migrateMock).toHaveBeenCalledWith(dbAdmin, {
      migrationsFolder: join(__dirname, "../migrations"),
    });
  });
});
