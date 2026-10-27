import { randomUUID } from "node:crypto";

import { MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";
import { asc, eq, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { COURSE_TRANSFER_STATUSES } from "src/course-transfer/course-transfer.constants";
import { CourseTransferCoordinator } from "src/course-transfer/course-transfer.coordinator";
import { CourseTransferBusyError } from "src/course-transfer/course-transfer.errors";
import { MasterCourseService } from "src/courses/master-course/master-course.service";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseTransferOperations,
  courseTransferStreams,
  masterCourseExports,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  COURSE_SHARING_TABLES,
  createCourseTransferDriver,
  createGlobalSettingsForTenants,
  createSourceCourse,
  findCourseExport,
  prepareSharingTenants,
  requestCourseExport,
  signInAsTenantAdmin,
} from "../../../test/helpers/course-sharing";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  RELATIONSHIP_CHANGES,
  UNDISPATCHABLE_RELATIONSHIP_CASES,
} from "./course-transfer-coordinator.scenarios";

import type { RelationshipChange } from "./course-transfer-coordinator.scenarios";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type {
  RunAsTenant,
  SharingTenant,
  TenantHttpClient,
} from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("Course transfer coordination (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsTenant: RunAsTenant;
  let source: SharingTenant;
  let target: SharingTenant;
  let sourceAdmin: UserWithCredentials;
  let sourceHttp: TenantHttpClient;
  let transferDriver: ReturnType<typeof createCourseTransferDriver>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        {
          provide: S3Service,
          useValue: {
            getFileExists: jest.fn().mockResolvedValue(false),
            getSignedUrl: jest.fn().mockResolvedValue("https://storage.example.com/file"),
            isConfigured: jest.fn().mockReturnValue(true),
            listFileKeysByPrefix: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: BunnyStreamService,
          useValue: {
            getMediaConfigurationSignature: jest.fn().mockResolvedValue(""),
            isConfigured: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: "CACHE_MANAGER",
          useValue: { get: jest.fn().mockResolvedValue(""), set: jest.fn() },
        },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runAsTenant = e2e.runAsTenant;
    ({ source, target } = await prepareSharingTenants(dbAdmin, e2e.defaultTenantId));
    transferDriver = createCourseTransferDriver(app, dbAdmin);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
    await createGlobalSettingsForTenants(db, runAsTenant, [source, target]);
    ({ admin: sourceAdmin, http: sourceHttp } = await signInAsTenantAdmin({
      app,
      db,
      runAsTenant,
      tenant: source,
    }));
    await signInAsTenantAdmin({ app, db, runAsTenant, tenant: target });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
  });

  const requestExportOfNewCourse = async () => {
    const { courseId } = await createSourceCourse({
      db,
      runAsTenant,
      tenant: source,
      authorId: sourceAdmin.id,
    });
    const operationId = await requestCourseExport(sourceHttp, courseId, [target.id]);
    const courseExport = await findCourseExport(dbAdmin, courseId, target.id);
    return { courseId, operationId, courseExport };
  };

  const requestSyncOfCourse = (courseId: UUIDType) =>
    runAsTenant(source.id, () =>
      app.get(MasterCourseService).queueSyncForSourceCourse(courseId, "test"),
    );

  const findStreamOperations = async (operationId: string) => {
    const [{ streamId }] = await dbAdmin
      .select({ streamId: courseTransferOperations.streamId })
      .from(courseTransferOperations)
      .where(eq(courseTransferOperations.id, operationId));

    return dbAdmin
      .select()
      .from(courseTransferOperations)
      .where(eq(courseTransferOperations.streamId, streamId))
      .orderBy(asc(courseTransferOperations.revision));
  };

  const findStreamOf = async (operationId: string) => {
    const [stream] = await dbAdmin
      .select({ stream: courseTransferStreams })
      .from(courseTransferStreams)
      .innerJoin(
        courseTransferOperations,
        eq(courseTransferOperations.streamId, courseTransferStreams.id),
      )
      .where(eq(courseTransferOperations.id, operationId));
    return stream.stream;
  };

  const changeRelationship = (change: RelationshipChange, exportId: UUIDType) =>
    match(change)
      .with(RELATIONSHIP_CHANGES.PAUSED, () =>
        dbAdmin
          .update(masterCourseExports)
          .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED })
          .where(eq(masterCourseExports.id, exportId)),
      )
      .with(RELATIONSHIP_CHANGES.DELETED, () =>
        dbAdmin.delete(masterCourseExports).where(eq(masterCourseExports.id, exportId)),
      )
      .exhaustive();

  describe("dispatching an operation", () => {
    it.each(UNDISPATCHABLE_RELATIONSHIP_CASES)(
      "stops dispatching and fails the transfer of a $change relationship",
      async ({ change, errorCode }) => {
        const { operationId, courseExport } = await requestExportOfNewCourse();
        await changeRelationship(change, courseExport.id);

        await expect(
          app.get(CourseTransferCoordinator).isOperationDispatchable(operationId),
        ).resolves.toBe(false);

        const [operation] = await findStreamOperations(operationId);
        expect(operation).toMatchObject({ status: COURSE_TRANSFER_STATUSES.FAILED, errorCode });
      },
    );
  });

  describe("claiming an operation", () => {
    it("rejects a second worker while another worker holds the lease", async () => {
      const { operationId } = await requestExportOfNewCourse();
      const stream = await findStreamOf(operationId);
      await dbAdmin
        .update(courseTransferStreams)
        .set({
          claimToken: randomUUID(),
          leaseExpiresAt: sql`clock_timestamp() + interval '1 minute'`,
        })
        .where(eq(courseTransferStreams.id, stream.id));

      await expect(transferDriver.transferOperation(operationId)).rejects.toBeInstanceOf(
        CourseTransferBusyError,
      );
      const [operation] = await findStreamOperations(operationId);
      expect(operation).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.PENDING,
        attemptCount: 0,
      });
    });

    it("applies the newest revision when an older delivery arrives, and supersedes the older one", async () => {
      const { courseId, operationId: firstOperationId } = await requestExportOfNewCourse();
      await requestSyncOfCourse(courseId);

      const targetCourseId = await transferDriver.transferOperation(firstOperationId);

      const [firstOperation, secondOperation] = await findStreamOperations(firstOperationId);
      expect(firstOperation).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.SUPERSEDED,
        targetId: targetCourseId,
      });
      expect(secondOperation).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.COMPLETED,
        targetId: targetCourseId,
        attemptCount: 1,
      });
      expect(await findStreamOf(firstOperationId)).toMatchObject({
        requestedRevision: 2,
        appliedRevision: 2,
        targetId: targetCourseId,
      });
    });

    it("returns the applied destination for a repeated delivery without another attempt", async () => {
      const { operationId } = await requestExportOfNewCourse();
      const targetCourseId = await transferDriver.transferOperation(operationId);

      await expect(transferDriver.transferOperation(operationId)).resolves.toBe(targetCourseId);

      const [operation] = await findStreamOperations(operationId);
      expect(operation.attemptCount).toBe(1);
    });
  });
});
