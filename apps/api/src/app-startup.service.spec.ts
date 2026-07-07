import { AppStartupService } from "./app-startup.service";

import type { PermissionsBackfillService } from "./permissions/permissions-backfill.service";
import type { DatabaseMigrationService } from "./storage/db/database-migration.service";

describe("AppStartupService", () => {
  const originalJestWorkerId = process.env.JEST_WORKER_ID;
  const originalBuildVerification = process.env.BUILD_VERIFICATION;

  const databaseMigrationService = {
    runMigrations: jest.fn(),
  } as unknown as jest.Mocked<DatabaseMigrationService>;

  const permissionsBackfillService = {
    backfillMissingPermissionsForAllTenants: jest.fn(),
  } as unknown as jest.Mocked<PermissionsBackfillService>;

  const service = new AppStartupService(databaseMigrationService, permissionsBackfillService);

  beforeEach(() => {
    delete process.env.JEST_WORKER_ID;
    delete process.env.BUILD_VERIFICATION;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.JEST_WORKER_ID = originalJestWorkerId;
    process.env.BUILD_VERIFICATION = originalBuildVerification;
  });

  it("skips startup maintenance in Jest", async () => {
    process.env.JEST_WORKER_ID = "1";

    await service.onModuleInit();

    expect(databaseMigrationService.runMigrations).not.toHaveBeenCalled();
    expect(
      permissionsBackfillService.backfillMissingPermissionsForAllTenants,
    ).not.toHaveBeenCalled();
  });

  it("skips startup maintenance during build verification", async () => {
    process.env.BUILD_VERIFICATION = "true";

    await service.onModuleInit();

    expect(databaseMigrationService.runMigrations).not.toHaveBeenCalled();
    expect(
      permissionsBackfillService.backfillMissingPermissionsForAllTenants,
    ).not.toHaveBeenCalled();
  });

  it("runs migrations before permission backfill", async () => {
    const calls: string[] = [];

    databaseMigrationService.runMigrations.mockImplementation(async () => {
      calls.push("migrations");
    });
    permissionsBackfillService.backfillMissingPermissionsForAllTenants.mockImplementation(
      async () => {
        calls.push("backfill");
        return { insertedCount: 0, tenantCount: 2 };
      },
    );

    await service.onModuleInit();

    expect(calls).toEqual(["migrations", "backfill"]);
  });

  it("does not run permission backfill when migrations fail", async () => {
    const error = new Error("Migration failed");

    databaseMigrationService.runMigrations.mockRejectedValue(error);

    await expect(service.onModuleInit()).rejects.toThrow(error);
    expect(
      permissionsBackfillService.backfillMissingPermissionsForAllTenants,
    ).not.toHaveBeenCalled();
  });
});
