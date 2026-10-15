import { MASTER_COURSE_EXPORT_SYNC_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { asc, eq } from "drizzle-orm";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import {
  COURSE_TRANSFER_ERROR_CODES,
  COURSE_TRANSFER_KINDS,
  COURSE_TRANSFER_MAX_ATTEMPTS,
  COURSE_TRANSFER_STATUSES,
} from "src/course-transfer/course-transfer.constants";
import { CourseTransferCoordinator } from "src/course-transfer/course-transfer.coordinator";
import { CourseTransferFailedError } from "src/course-transfer/course-transfer.errors";
import { CourseTransferRequestedEvent } from "src/course-transfer/events/course-transfer-requested.event";
import { LEARNING_PATH_ERRORS } from "src/learning-path/constants/learning-path.errors";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseTransferDependencies,
  courseTransferOperations,
  learningPathCourses,
  learningPathExports,
  outboxEvents,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createLearningPathFactory } from "../../../test/factory/learningPath.factory";
import {
  COURSE_SHARING_TABLES,
  createCourseTransferDriver,
  createGlobalSettingsForTenants,
  createSourceCourse,
  exportCourseToTenant,
  findCourseExport,
  prepareSharingTenants,
  signInAsTenantAdmin,
  waitForTransferJobToComplete,
} from "../../../test/helpers/course-sharing";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type {
  RunAsTenant,
  SharingTenant,
  TenantHttpClient,
} from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("Learning path sharing through course dependencies (e2e)", () => {
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
    // Shared paths are authored by an admin of the recipient tenant.
    await signInAsTenantAdmin({ app, db, runAsTenant, tenant: target });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
  });

  const createSourceCourses = async (count: number) => {
    const courseIds: UUIDType[] = [];
    for (let index = 0; index < count; index++) {
      const { courseId } = await createSourceCourse({
        db,
        runAsTenant,
        tenant: source,
        authorId: sourceAdmin.id,
      });
      courseIds.push(courseId);
    }
    return courseIds;
  };

  const addCoursesToPath = (learningPathId: UUIDType, courseIds: UUIDType[]) =>
    sourceHttp.post(`/api/learning-path/${learningPathId}/courses`).send({ courseIds }).expect(201);

  const createSourcePath = async (courseIds: UUIDType[]) => {
    const learningPath = await runAsTenant(source.id, () =>
      createLearningPathFactory(db).create({
        authorId: sourceAdmin.id,
        title: { [SUPPORTED_LANGUAGES.EN]: "Shared path" },
        description: { [SUPPORTED_LANGUAGES.EN]: "Shared path description" },
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [SUPPORTED_LANGUAGES.EN],
      }),
    );
    await addCoursesToPath(learningPath.id, courseIds);
    return learningPath.id;
  };

  const requestPathExport = async (learningPathId: UUIDType) => {
    const response = await sourceHttp
      .post(`/api/learning-path/master/${learningPathId}/export`)
      .send({ targetTenantIds: [target.id] })
      .expect(201);
    return response.body.data.jobs[0] as { exportId: UUIDType; queued: boolean; reason: string };
  };

  const readPathJobStatus = async (operationId: string) => {
    const response = await sourceHttp
      .get(`/api/learning-path/master/export-jobs/${operationId}`)
      .expect(200);
    return response.body.data as { state: string; failedReason: string | null };
  };

  const findPathExport = async (learningPathId: UUIDType) => {
    const [pathExport] = await dbAdmin
      .select()
      .from(learningPathExports)
      .where(eq(learningPathExports.sourceLearningPathId, learningPathId));
    return pathExport;
  };

  const findOperation = async (operationId: string) => {
    const [operation] = await dbAdmin
      .select()
      .from(courseTransferOperations)
      .where(eq(courseTransferOperations.id, operationId));
    return operation;
  };

  const findLatestPathOperation = async (learningPathId: UUIDType) => {
    const pathExport = await findPathExport(learningPathId);
    const { operation } = await transferDriver.findLatestOperation(
      COURSE_TRANSFER_KINDS.LEARNING_PATH,
      pathExport.id,
    );
    return operation;
  };

  const findCourseTransfer = async (sourceCourseId: UUIDType) => {
    const courseExport = await findCourseExport(dbAdmin, sourceCourseId, target.id);
    const record = await transferDriver.findLatestOperation(
      COURSE_TRANSFER_KINDS.COURSE,
      courseExport.id,
    );
    const operations = await dbAdmin
      .select({ id: courseTransferOperations.id })
      .from(courseTransferOperations)
      .where(eq(courseTransferOperations.streamId, record.stream.id));

    return { courseExport, ...record, operationCount: operations.length };
  };

  const findDependencies = (operationId: string) =>
    dbAdmin
      .select()
      .from(courseTransferDependencies)
      .where(eq(courseTransferDependencies.operationId, operationId));

  const findTargetPathCourseIds = async (learningPathId: UUIDType) => {
    const { targetLearningPathId } = await findPathExport(learningPathId);
    const links = await dbAdmin
      .select({ courseId: learningPathCourses.courseId })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, targetLearningPathId!))
      .orderBy(asc(learningPathCourses.displayOrder));
    return links.map(({ courseId }) => courseId);
  };

  const countDispatchRequests = async (operationId: string) => {
    const events = await dbAdmin
      .select({ payload: outboxEvents.payload })
      .from(outboxEvents)
      .where(eq(outboxEvents.eventType, CourseTransferRequestedEvent.name));
    return events.filter(({ payload }) => payload.operationId === operationId).length;
  };

  const transferCourses = async (sourceCourseIds: UUIDType[]) => {
    for (const sourceCourseId of sourceCourseIds) {
      const { operation } = await findCourseTransfer(sourceCourseId);
      await transferDriver.transferOperation(operation.id);
    }
  };

  const findTargetCourseIds = async (sourceCourseIds: UUIDType[]) => {
    const targetCourseIds: Array<UUIDType | null> = [];
    for (const sourceCourseId of sourceCourseIds) {
      const { courseExport } = await findCourseTransfer(sourceCourseId);
      targetCourseIds.push(courseExport.targetCourseId);
    }
    return targetCourseIds;
  };

  /** Shares a two-course path, then adds a third course whose transfer has run out of attempts. */
  const arrangeSharedPathWithFailedCourse = async () => {
    const courseIds = await createSourceCourses(3);
    const sharedCourseIds = courseIds.slice(0, 2);
    const failingCourseId = courseIds[2];
    const learningPathId = await createSourcePath(sharedCourseIds);
    const { reason: firstOperationId } = await requestPathExport(learningPathId);
    await transferDriver.transferOperation(firstOperationId);
    await transferCourses(sharedCourseIds);
    await transferDriver.transferOperation(firstOperationId);

    await addCoursesToPath(learningPathId, [failingCourseId]);
    const syncOperation = await findLatestPathOperation(learningPathId);
    await expect(transferDriver.transferOperation(syncOperation.id)).resolves.toBeNull();

    const { operation: failingCourseOperation } = await findCourseTransfer(failingCourseId);
    await dbAdmin
      .update(courseTransferOperations)
      .set({ attemptCount: COURSE_TRANSFER_MAX_ATTEMPTS })
      .where(eq(courseTransferOperations.id, failingCourseOperation.id));
    await expect(
      transferDriver.transferOperation(failingCourseOperation.id),
    ).rejects.toBeInstanceOf(CourseTransferFailedError);

    return { learningPathId, sharedCourseIds, failingCourseId, syncOperationId: syncOperation.id };
  };

  describe("sharing a path", () => {
    it("shares a path and each of its courses through the outbox and queue", async () => {
      const courseIds = await createSourceCourses(2);
      const learningPathId = await createSourcePath(courseIds);

      const { reason: operationId } = await requestPathExport(learningPathId);
      await waitForTransferJobToComplete(app, () => readPathJobStatus(operationId), 30_000);

      expect(await findTargetPathCourseIds(learningPathId)).toEqual(
        await findTargetCourseIds(courseIds),
      );
      expect(await findOperation(operationId)).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.COMPLETED,
        attemptCount: 2,
      });
      expect(await findDependencies(operationId)).toHaveLength(courseIds.length);
    }, 60_000);

    it("waits for its courses without spending attempts and links them once all are applied", async () => {
      const courseIds = await createSourceCourses(2);
      const learningPathId = await createSourcePath(courseIds);
      const { reason: operationId } = await requestPathExport(learningPathId);

      await expect(transferDriver.transferOperation(operationId)).resolves.toBeNull();

      expect(await findOperation(operationId)).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.WAITING_FOR_DEPENDENCIES,
        attemptCount: 1,
      });
      expect(await readPathJobStatus(operationId)).toMatchObject({ state: "waiting" });
      expect(await findDependencies(operationId)).toEqual(
        expect.arrayContaining(
          courseIds.map((sourceId) => expect.objectContaining({ sourceId, requiredRevision: 1 })),
        ),
      );

      await expect(transferDriver.transferOperation(operationId)).resolves.toBeNull();
      expect((await findOperation(operationId)).attemptCount).toBe(1);

      const dispatchRequestsBeforeCourse = await countDispatchRequests(operationId);
      await transferCourses([courseIds[0]]);
      expect(await countDispatchRequests(operationId)).toBe(dispatchRequestsBeforeCourse + 1);
      await expect(transferDriver.transferOperation(operationId)).resolves.toBeNull();

      await transferCourses([courseIds[1]]);
      const targetLearningPathId = await transferDriver.transferOperation(operationId);

      expect(targetLearningPathId).toEqual(
        (await findPathExport(learningPathId)).targetLearningPathId,
      );
      expect(await findOperation(operationId)).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.COMPLETED,
        attemptCount: 2,
      });
      expect(await findTargetPathCourseIds(learningPathId)).toEqual(
        await findTargetCourseIds(courseIds),
      );
    });

    it("links a course that is already shared without transferring it again", async () => {
      const [sharedCourseId, newCourseId] = await createSourceCourses(2);
      await exportCourseToTenant(app, sourceHttp, sharedCourseId, target);
      const learningPathId = await createSourcePath([sharedCourseId, newCourseId]);
      const { reason: operationId } = await requestPathExport(learningPathId);

      await expect(transferDriver.transferOperation(operationId)).resolves.toBeNull();

      expect(await findDependencies(operationId)).toEqual([
        expect.objectContaining({ sourceId: newCourseId }),
      ]);
      expect((await findCourseTransfer(sharedCourseId)).operationCount).toBe(1);
    });

    it("links every course in its first pass when all of them are already shared", async () => {
      const courseIds = await createSourceCourses(2);
      for (const courseId of courseIds) {
        await exportCourseToTenant(app, sourceHttp, courseId, target);
      }
      const learningPathId = await createSourcePath(courseIds);
      const { reason: operationId } = await requestPathExport(learningPathId);

      await expect(transferDriver.transferOperation(operationId)).resolves.toEqual(
        expect.any(String),
      );

      expect(await findDependencies(operationId)).toHaveLength(0);
      expect(await findOperation(operationId)).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.COMPLETED,
        attemptCount: 1,
      });
      expect(await findTargetPathCourseIds(learningPathId)).toEqual(
        await findTargetCourseIds(courseIds),
      );
    });
  });

  describe("when one of its courses fails", () => {
    it("fails the path and keeps the courses the recipient already has", async () => {
      const { learningPathId, sharedCourseIds, syncOperationId } =
        await arrangeSharedPathWithFailedCourse();

      await expect(app.get(CourseTransferCoordinator).redispatchStalledTransfers()).resolves.toBe(
        1,
      );
      await expect(transferDriver.transferOperation(syncOperationId)).rejects.toBeInstanceOf(
        CourseTransferFailedError,
      );

      expect(await findOperation(syncOperationId)).toMatchObject({
        status: COURSE_TRANSFER_STATUSES.FAILED,
        errorCode: COURSE_TRANSFER_ERROR_CODES.DEPENDENCY_FAILED,
      });
      expect(await readPathJobStatus(syncOperationId)).toEqual(
        expect.objectContaining({
          state: "failed",
          failedReason: LEARNING_PATH_ERRORS.EXPORT_COURSE_FAILED,
        }),
      );
      expect((await findPathExport(learningPathId)).syncStatus).toBe(
        MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED,
      );
      expect(await findTargetPathCourseIds(learningPathId)).toEqual(
        await findTargetCourseIds(sharedCourseIds),
      );
    });

    it("requests only that course again when the path is shared again", async () => {
      const { learningPathId, sharedCourseIds, failingCourseId, syncOperationId } =
        await arrangeSharedPathWithFailedCourse();
      await expect(transferDriver.transferOperation(syncOperationId)).rejects.toBeInstanceOf(
        CourseTransferFailedError,
      );

      const retry = await requestPathExport(learningPathId);
      expect(retry.queued).toBe(true);
      await expect(transferDriver.transferOperation(retry.reason)).resolves.toBeNull();

      expect(await findDependencies(retry.reason)).toEqual([
        expect.objectContaining({ sourceId: failingCourseId }),
      ]);
      for (const sharedCourseId of sharedCourseIds) {
        expect((await findCourseTransfer(sharedCourseId)).operationCount).toBe(1);
      }

      await transferCourses([failingCourseId]);
      await transferDriver.transferOperation(retry.reason);

      expect((await findPathExport(learningPathId)).syncStatus).toBe(
        MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
      );
      expect(await findTargetPathCourseIds(learningPathId)).toEqual(
        await findTargetCourseIds([...sharedCourseIds, failingCourseId]),
      );
    });
  });
});
