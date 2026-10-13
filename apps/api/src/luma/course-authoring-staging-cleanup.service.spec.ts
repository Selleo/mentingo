import { CourseAuthoringStagingCleanupService } from "./course-authoring-staging-cleanup.service";

import type { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import type { IngestionProcessingService } from "src/ingestion/services/ingestion-processing.service";
import type { S3Service } from "src/s3/s3.service";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

const tenantId = "00000000-0000-4000-8000-000000000001";

describe("CourseAuthoringStagingCleanupService", () => {
  it("cleans only inventoried expired assets and retains inventory on storage failure", async () => {
    const abandoned = `${tenantId}/course-authoring/session/abandoned`;
    const deleteFile = jest.fn();
    const cleanExpiredStagedAsset = jest.fn(
      async (
        _tenantId: string,
        _id: string,
        _before: Date,
        deleteStorageObject: (key: string) => Promise<void>,
      ) => deleteStorageObject(abandoned),
    );
    const cleanExpiredAuthoringDocuments = jest.fn();
    const service = new CourseAuthoringStagingCleanupService(
      {
        runForEachTenant: async (run: (id: string) => Promise<void>) => run(tenantId),
        runWithTenant: async (_id: string, run: () => Promise<void>) => run(),
      } as unknown as TenantDbRunnerService,
      { cleanExpiredAuthoringDocuments } as unknown as IngestionProcessingService,
      {
        expiredStagedAssets: jest.fn().mockResolvedValue([{ id: tenantId, key: abandoned }]),
        cleanExpiredStagedAsset,
      } as unknown as CourseAuthoringApplicationRepository,
      {
        deleteFile,
      } as unknown as S3Service,
    );

    await service.cleanExpiredStaging();

    expect(cleanExpiredAuthoringDocuments).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith(abandoned);
    expect(cleanExpiredStagedAsset).toHaveBeenCalledWith(
      tenantId,
      tenantId,
      expect.any(Date),
      expect.any(Function),
    );
  });
});
