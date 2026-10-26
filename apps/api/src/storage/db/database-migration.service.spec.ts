import { ConfigService } from "@nestjs/config";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

import { DatabaseMigrationService } from "./database-migration.service";

jest.mock("postgres", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("drizzle-orm/migrator", () => ({
  ...jest.requireActual("drizzle-orm/migrator"),
  readMigrationFiles: jest.fn(jest.requireActual("drizzle-orm/migrator").readMigrationFiles),
}));

describe("DatabaseMigrationService", () => {
  const postgresMock = jest.mocked(postgres);
  const migrationsMock = jest.mocked(readMigrationFiles);
  const config = new ConfigService({
    database: {
      urlAdmin: "postgres://migration-secret@local/core",
      urlApp: "postgres://app-secret@local/core",
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a mismatched SDK payload before opening database connections", async () => {
    migrationsMock.mockReturnValueOnce([]);
    await expect(new DatabaseMigrationService(config).runMigrations()).rejects.toThrow(
      "pinned Workflow baseline",
    );
    expect(postgresMock).not.toHaveBeenCalled();
  });

  it("aborts the dedicated lock connection on loss and reports no credentials", async () => {
    const end = jest.fn().mockResolvedValue(undefined);
    const sql = jest.fn(async () => {
      const options = postgresMock.mock.calls[0][1];
      options?.onclose?.(1);
      throw new Error("postgres://migration-secret@local/core failed");
    });
    postgresMock.mockReturnValue(Object.assign(sql, { end }) as never);
    const service = new DatabaseMigrationService(config);
    const errors = jest
      .spyOn((service as unknown as { logger: { error(message: string): void } }).logger, "error")
      .mockImplementation(() => undefined);
    await expect(service.runMigrations()).rejects.toThrow("Database migrations failed");
    expect(postgresMock).toHaveBeenCalledWith(
      config.get("database.urlAdmin"),
      expect.objectContaining({ max: 1, idle_timeout: 0, max_lifetime: 0 }),
    );
    expect(end).toHaveBeenCalledWith({ timeout: 0 });
    expect(errors).toHaveBeenCalledWith(expect.not.stringContaining("secret"));
  });
});
