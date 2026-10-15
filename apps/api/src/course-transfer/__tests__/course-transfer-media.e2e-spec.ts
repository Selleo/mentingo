import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import {
  ENTITY_TYPES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  VIDEO_PROCESSING_STATUSES,
  VIDEO_PROVIDERS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { COURSE_TRANSFER_KINDS } from "src/course-transfer/course-transfer.constants";
import { MasterCourseService } from "src/courses/master-course.service";
import { HostedVideoStatusService } from "src/file/hosted-video-status.service";
import { HOSTED_VIDEO_STATUSES } from "src/file/hosted-video.constants";
import { buildHostedVideoCopyMarker } from "src/file/hosted-video.utils";
import {
  BUNNY_API_VIDEO_STATUSES,
  BUNNY_WEBHOOK_VIDEO_STATUSES,
} from "src/file/video-metadata.constants";
import { buildBunnyVideoReference } from "src/file/video-metadata.utils";
import { S3Service } from "src/s3/s3.service";
import { dbAls } from "src/storage/db/db-als.store";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { hostedVideos } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createHostedVideoFactory } from "../../../test/factory/hosted-video.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createResourceFactory } from "../../../test/factory/resource.factory";
import {
  COURSE_SHARING_TABLES,
  createCourseTransferDriver,
  createGlobalSettingsForTenants,
  createSourceCourse,
  exportCourseToTenant,
  findCourseExport,
  findTargetLessons,
  prepareSharingTenants,
  requestCourseExport,
  signInAsTenantAdmin,
  SOURCE_TENANT_HOST,
} from "../../../test/helpers/course-sharing";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  BUNNY_LIBRARIES,
  BUNNY_WEBHOOK_SIGNATURE_HEADERS,
  LESSON_VIDEO_ROUTES,
  MINUTE_MS,
  PROVIDER_STATUS_CHECK_CASES,
  STALE_UPLOAD_CASES,
  VIDEO_COPY_OUTCOMES,
  VIDEO_STORAGES,
  WEBHOOK_REJECTION_CASES,
  WEBHOOK_STATUS_CASES,
} from "./course-transfer-media.scenarios";

import type { BunnyLibrary, VideoRoute, VideoStorage } from "./course-transfer-media.scenarios";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type {
  RunAsTenant,
  SharingTenant,
  TenantHttpClient,
} from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const bunnyLibraryByTenantId = new Map<string, string>();
const findCurrentTenantBunnyLibrary = () =>
  bunnyLibraryByTenantId.get(dbAls.getStore()?.tenantId ?? "");

const s3ServiceMock = {
  copyFile: jest.fn(),
  deleteFile: jest.fn(),
  getFileContentType: jest.fn(),
  getFileExists: jest.fn(),
  getFileStream: jest.fn(),
  getSignedUrl: jest.fn(),
  isConfigured: jest.fn(),
  listFileKeysByPrefix: jest.fn(),
  uploadStreamMultipart: jest.fn(),
};

const bunnyStreamServiceMock = {
  createVideo: jest.fn(),
  delete: jest.fn(),
  downloadMp4Fallback: jest.fn(),
  findVideosByTitle: jest.fn(),
  getMediaConfigurationSignature: jest.fn(),
  getThumbnailUrl: jest.fn(),
  getUrl: jest.fn(),
  getVideo: jest.fn(),
  isConfigured: jest.fn(),
  uploadVideoContent: jest.fn(),
  validateWebhookSignature: jest.fn(),
};

describe("Course transfer media (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsTenant: RunAsTenant;
  let source: SharingTenant;
  let target: SharingTenant;
  let sourceAdmin: UserWithCredentials;
  let sourceHttp: TenantHttpClient;
  let targetHttp: TenantHttpClient;
  let transferDriver: ReturnType<typeof createCourseTransferDriver>;
  let hostedVideoFactory: ReturnType<typeof createHostedVideoFactory>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: BunnyStreamService, useValue: bunnyStreamServiceMock },
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
    hostedVideoFactory = createHostedVideoFactory(dbAdmin);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
    restoreProviderDoubles();
    bunnyLibraryByTenantId.clear();

    await createGlobalSettingsForTenants(db, runAsTenant, [source, target]);
    ({ admin: sourceAdmin, http: sourceHttp } = await signInAsTenantAdmin({
      app,
      db,
      runAsTenant,
      tenant: source,
    }));
    ({ http: targetHttp } = await signInAsTenantAdmin({ app, db, runAsTenant, tenant: target }));
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_SHARING_TABLES);
  });

  const restoreProviderDoubles = () => {
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    Object.values(bunnyStreamServiceMock).forEach((mock) => mock.mockReset());

    s3ServiceMock.isConfigured.mockReturnValue(true);
    s3ServiceMock.getFileExists.mockImplementation(
      async (key: string) => !key.includes("/master-course/"),
    );
    s3ServiceMock.getFileStream.mockImplementation(async () => ({
      stream: Readable.from(Buffer.from("s3-video")),
      contentType: "video/mp4",
    }));
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `https://storage.example.com/${key}`,
    );
    s3ServiceMock.getFileContentType.mockResolvedValue("video/mp4");
    s3ServiceMock.listFileKeysByPrefix.mockResolvedValue([]);

    bunnyStreamServiceMock.isConfigured.mockImplementation(async () =>
      Boolean(findCurrentTenantBunnyLibrary()),
    );
    bunnyStreamServiceMock.getMediaConfigurationSignature.mockImplementation(
      async () => findCurrentTenantBunnyLibrary() ?? "",
    );
    bunnyStreamServiceMock.createVideo.mockImplementation(async () => ({ guid: randomUUID() }));
    bunnyStreamServiceMock.delete.mockResolvedValue({ success: true });
    bunnyStreamServiceMock.downloadMp4Fallback.mockImplementation(async () => ({
      stream: Readable.from(Buffer.from("bunny-video")),
      contentType: "video/mp4",
      filename: "play_720p.mp4",
      resolution: 720,
    }));
    bunnyStreamServiceMock.findVideosByTitle.mockResolvedValue([]);
    bunnyStreamServiceMock.getVideo.mockImplementation(async (guid: string) => ({
      guid,
      title: "",
      length: 0,
      status: BUNNY_API_VIDEO_STATUSES.TRANSCODING,
    }));
    bunnyStreamServiceMock.getUrl.mockImplementation(
      async (guid: string) => `https://cdn.example.com/${guid}/playlist.m3u8`,
    );
    bunnyStreamServiceMock.getThumbnailUrl.mockImplementation(
      async (guid: string) => `https://cdn.example.com/${guid}/thumbnail.jpg`,
    );
    bunnyStreamServiceMock.validateWebhookSignature.mockResolvedValue(true);
  };

  const useBunnyLibraries = (libraries: { source: BunnyLibrary; target: BunnyLibrary }) => {
    if (libraries.source) bunnyLibraryByTenantId.set(source.id, libraries.source);
    if (libraries.target) bunnyLibraryByTenantId.set(target.id, libraries.target);
  };

  const buildSourceVideoReference = (storage: VideoStorage) =>
    match(storage)
      .with(VIDEO_STORAGES.S3, () => `${source.id}/lesson/${randomUUID()}.mp4`)
      .with(VIDEO_STORAGES.BUNNY, () => buildBunnyVideoReference(randomUUID()))
      .exhaustive();

  const createCourseWithLessonVideo = (sourceReference: string) =>
    createSourceCourse({
      db,
      runAsTenant,
      tenant: source,
      authorId: sourceAdmin.id,
      lesson: { fileS3Key: sourceReference, fileType: "mp4" },
    });

  const createCourseWithEmbeddedVideo = async (sourceReference: string) => {
    const resourceId = randomUUID();
    const sourceCourse = await createSourceCourse({
      db,
      runAsTenant,
      tenant: source,
      authorId: sourceAdmin.id,
      lesson: {
        description: {
          [SUPPORTED_LANGUAGES.EN]: buildVideoNodeHtml(SOURCE_TENANT_HOST, resourceId),
        },
      },
    });

    await runAsTenant(source.id, () =>
      createResourceFactory(db).create({
        id: resourceId,
        reference: sourceReference,
        contentType: "video/mp4",
      }),
    );

    return sourceCourse;
  };

  const findTargetHostedVideos = () =>
    dbAdmin.select().from(hostedVideos).where(eq(hostedVideos.tenantId, target.id));

  const findHostedVideo = async (hostedVideoId: UUIDType) => {
    const [hostedVideo] = await dbAdmin
      .select()
      .from(hostedVideos)
      .where(eq(hostedVideos.id, hostedVideoId));
    return hostedVideo;
  };

  const syncExportedCourse = async (sourceCourseId: UUIDType) => {
    await runAsTenant(source.id, () =>
      app.get(MasterCourseService).queueSyncForSourceCourse(sourceCourseId, "test"),
    );
    const courseExport = await findCourseExport(dbAdmin, sourceCourseId, target.id);
    const { operation } = await transferDriver.findLatestOperation(
      COURSE_TRANSFER_KINDS.COURSE,
      courseExport.id,
    );
    return transferDriver.transferOperation(operation.id);
  };

  const sendBunnyWebhook = (videoGuid: string, bunnyStatus: number) =>
    request(app.getHttpServer())
      .post("/api/file/bunny/webhook")
      .set(BUNNY_WEBHOOK_SIGNATURE_HEADERS)
      .send({ VideoGuid: videoGuid, Status: bunnyStatus });

  const readTargetLessonContent = async (lessonId: UUIDType) => {
    const response = await targetHttp
      .get(`/api/lesson/${lessonId}`)
      .query({ language: SUPPORTED_LANGUAGES.EN })
      .expect(200);
    return response.body.data.description as string;
  };

  const expectVideoCopyOutcome = async (
    videoRoute: VideoRoute,
    sourceReference: string,
    targetReference: string | null,
  ) => {
    const targetStorageReference = new RegExp(`^${target.id}/master-course/.+\\.mp4$`);
    const targetHostedVideos = await findTargetHostedVideos();

    await match(videoRoute.outcome)
      .with(VIDEO_COPY_OUTCOMES.COPIED_WITHIN_STORAGE, async () => {
        expect(targetReference).toMatch(targetStorageReference);
        expect(s3ServiceMock.copyFile).toHaveBeenCalledWith(
          sourceReference,
          targetReference,
          "video/mp4",
        );
        expect(targetHostedVideos).toHaveLength(0);
      })
      .with(VIDEO_COPY_OUTCOMES.STREAMED_INTO_STORAGE, async () => {
        expect(targetReference).toMatch(targetStorageReference);
        expect(bunnyStreamServiceMock.downloadMp4Fallback).toHaveBeenCalledWith(
          sourceReference.replace("bunny-", ""),
          720,
          SOURCE_TENANT_HOST,
        );
        expect(s3ServiceMock.uploadStreamMultipart).toHaveBeenCalledWith(
          expect.any(Readable),
          targetReference,
          "video/mp4",
        );
        expect(targetHostedVideos).toHaveLength(0);
      })
      .with(VIDEO_COPY_OUTCOMES.UPLOADED_TO_TARGET_LIBRARY, async () => {
        const [hostedVideo] = targetHostedVideos;
        expect(targetHostedVideos).toHaveLength(1);
        expect(hostedVideo).toMatchObject({
          provider: VIDEO_PROVIDERS.BUNNY,
          providerConfigurationSignature: videoRoute.targetLibrary,
          status: HOSTED_VIDEO_STATUSES.PROCESSING,
          copiedFromTenantId: source.id,
          copiedFromReference: sourceReference,
          reference: targetReference,
        });
        expect(bunnyStreamServiceMock.createVideo).toHaveBeenCalledWith(
          expect.stringContaining(buildHostedVideoCopyMarker(hostedVideo.id)),
        );
        expect(bunnyStreamServiceMock.uploadVideoContent).toHaveBeenCalledWith({
          videoId: hostedVideo.providerVideoId,
          stream: expect.any(Readable),
          contentType: "video/mp4",
        });
        await match(videoRoute.sourceStorage)
          .with(VIDEO_STORAGES.S3, async () =>
            expect(s3ServiceMock.getFileStream).toHaveBeenCalledWith(sourceReference),
          )
          .with(VIDEO_STORAGES.BUNNY, async () =>
            expect(bunnyStreamServiceMock.downloadMp4Fallback).toHaveBeenCalled(),
          )
          .exhaustive();
      })
      .with(VIDEO_COPY_OUTCOMES.REUSED_SOURCE_VIDEO, async () => {
        expect(targetReference).toBe(sourceReference);
        expect(bunnyStreamServiceMock.createVideo).not.toHaveBeenCalled();
        expect(bunnyStreamServiceMock.downloadMp4Fallback).not.toHaveBeenCalled();
        expect(targetHostedVideos).toHaveLength(0);
      })
      .exhaustive();
  };

  describe("sharing a lesson video", () => {
    it.each(LESSON_VIDEO_ROUTES)("$route: $outcome", async (videoRoute) => {
      useBunnyLibraries({ source: videoRoute.sourceLibrary, target: videoRoute.targetLibrary });
      const sourceReference = buildSourceVideoReference(videoRoute.sourceStorage);
      const { courseId } = await createCourseWithLessonVideo(sourceReference);

      const { targetCourseId } = await exportCourseToTenant(app, sourceHttp, courseId, target);

      const [targetLesson] = await findTargetLessons(db, runAsTenant, target, targetCourseId!);
      await expectVideoCopyOutcome(videoRoute, sourceReference, targetLesson.fileS3Key);
    });
  });

  describe("a copy in the recipient's Bunny library", () => {
    beforeEach(() => {
      useBunnyLibraries({ source: BUNNY_LIBRARIES.SOURCE, target: BUNNY_LIBRARIES.TARGET });
    });

    it("shows a processing placeholder on the shared lesson until Bunny reports the copy ready", async () => {
      const { courseId } = await createCourseWithEmbeddedVideo(
        buildSourceVideoReference(VIDEO_STORAGES.BUNNY),
      );
      const { targetCourseId } = await exportCourseToTenant(app, sourceHttp, courseId, target);
      const [targetLesson] = await findTargetLessons(db, runAsTenant, target, targetCourseId!);
      const [hostedVideo] = await findTargetHostedVideos();

      expect(await readTargetLessonContent(targetLesson.id)).toContain(
        `data-processing-status="${VIDEO_PROCESSING_STATUSES.PROCESSING}"`,
      );

      await sendBunnyWebhook(
        hostedVideo.providerVideoId!,
        BUNNY_WEBHOOK_VIDEO_STATUSES.FINISHED,
      ).expect(201);

      expect(await readTargetLessonContent(targetLesson.id)).not.toContain(
        "data-processing-status",
      );
    });

    it("reuses the copy when the course is synchronized again", async () => {
      const sourceReference = buildSourceVideoReference(VIDEO_STORAGES.BUNNY);
      const { courseId } = await createCourseWithLessonVideo(sourceReference);
      const { targetCourseId } = await exportCourseToTenant(app, sourceHttp, courseId, target);
      const [firstLesson] = await findTargetLessons(db, runAsTenant, target, targetCourseId!);

      await syncExportedCourse(courseId);

      const [syncedLesson] = await findTargetLessons(db, runAsTenant, target, targetCourseId!);
      expect(syncedLesson.fileS3Key).toBe(firstLesson.fileS3Key);
      expect(bunnyStreamServiceMock.createVideo).toHaveBeenCalledTimes(1);
      expect(await findTargetHostedVideos()).toHaveLength(1);
    });

    it("uploads a failed copy again on the next sync and deletes its broken provider video", async () => {
      const { courseId } = await createCourseWithLessonVideo(
        buildSourceVideoReference(VIDEO_STORAGES.BUNNY),
      );
      const { targetCourseId } = await exportCourseToTenant(app, sourceHttp, courseId, target);
      const [failedCopy] = await findTargetHostedVideos();
      await dbAdmin
        .update(hostedVideos)
        .set({ status: HOSTED_VIDEO_STATUSES.FAILED })
        .where(eq(hostedVideos.id, failedCopy.id));

      await syncExportedCourse(courseId);

      const reuploadedCopy = await findHostedVideo(failedCopy.id);
      const [syncedLesson] = await findTargetLessons(db, runAsTenant, target, targetCourseId!);
      expect(bunnyStreamServiceMock.delete).toHaveBeenCalledWith(failedCopy.providerVideoId);
      expect(reuploadedCopy.status).toBe(HOSTED_VIDEO_STATUSES.PROCESSING);
      expect(reuploadedCopy.providerVideoId).not.toBe(failedCopy.providerVideoId);
      expect(syncedLesson.fileS3Key).toBe(reuploadedCopy.reference);
      expect(await findTargetHostedVideos()).toHaveLength(1);
    });

    it("adopts the provider video when the create response is lost", async () => {
      const adoptedVideoGuid = randomUUID();
      bunnyStreamServiceMock.createVideo.mockRejectedValueOnce(new Error("socket hang up"));
      bunnyStreamServiceMock.findVideosByTitle.mockImplementation(async (marker: string) => [
        { guid: adoptedVideoGuid, title: `play_720p.mp4 · ${marker}`, length: 0, status: 0 },
      ]);
      const { courseId } = await createCourseWithLessonVideo(
        buildSourceVideoReference(VIDEO_STORAGES.BUNNY),
      );

      const { targetCourseId } = await exportCourseToTenant(app, sourceHttp, courseId, target);

      const [hostedVideo] = await findTargetHostedVideos();
      const [targetLesson] = await findTargetLessons(db, runAsTenant, target, targetCourseId!);
      expect(bunnyStreamServiceMock.createVideo).toHaveBeenCalledTimes(1);
      expect(bunnyStreamServiceMock.uploadVideoContent).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: adoptedVideoGuid }),
      );
      expect(hostedVideo.providerVideoId).toBe(adoptedVideoGuid);
      expect(targetLesson.fileS3Key).toBe(buildBunnyVideoReference(adoptedVideoGuid));
    });

    it("fails the copy when a create never reached Bunny, and the next attempt reuses its record", async () => {
      bunnyStreamServiceMock.createVideo.mockRejectedValueOnce(new Error("connection refused"));
      const { courseId } = await createCourseWithLessonVideo(
        buildSourceVideoReference(VIDEO_STORAGES.BUNNY),
      );
      const operationId = await requestCourseExport(sourceHttp, courseId, [target.id]);

      await expect(transferDriver.transferOperation(operationId)).rejects.toThrow(
        "connection refused",
      );
      const [failedCopy] = await findTargetHostedVideos();
      expect(failedCopy.status).toBe(HOSTED_VIDEO_STATUSES.FAILED);

      await transferDriver.transferOperation(operationId);

      const [retriedCopy, ...otherCopies] = await findTargetHostedVideos();
      expect(otherCopies).toHaveLength(0);
      expect(retriedCopy).toMatchObject({
        id: failedCopy.id,
        status: HOSTED_VIDEO_STATUSES.PROCESSING,
      });
    });
  });

  describe("Bunny webhooks about a copy", () => {
    const createTargetLessonWithProcessingCopy = async () => {
      const hostedVideo = await hostedVideoFactory.create({
        tenantId: target.id,
        copiedFromTenantId: source.id,
      });

      const lessonId = await runAsTenant(target.id, async () => {
        const course = await createCourseFactory(db).create({ thumbnailS3Key: null });
        const chapter = await createChapterFactory(db).create({ courseId: course.id });
        const resourceId = randomUUID();
        const lesson = await createLessonFactory(db).create({
          chapterId: chapter.id,
          type: LESSON_TYPES.CONTENT,
          description: { [SUPPORTED_LANGUAGES.EN]: buildVideoNodeHtml(target.host, resourceId) },
        });
        await createResourceFactory(db)
          .linkedTo({ entityId: lesson.id, entityType: ENTITY_TYPES.LESSON })
          .create({ id: resourceId, reference: hostedVideo.reference!, contentType: "video/mp4" });
        return lesson.id;
      });

      return { hostedVideo, lessonId };
    };

    it.each(WEBHOOK_STATUS_CASES)(
      "the $webhook webhook leaves the copy $hostedStatus",
      async ({ bunnyStatus, hostedStatus, placeholder }) => {
        const { hostedVideo, lessonId } = await createTargetLessonWithProcessingCopy();

        await sendBunnyWebhook(hostedVideo.providerVideoId!, bunnyStatus).expect(201);

        expect((await findHostedVideo(hostedVideo.id)).status).toBe(hostedStatus);
        const lessonContent = await readTargetLessonContent(lessonId);
        if (placeholder) {
          expect(lessonContent).toContain(`data-processing-status="${placeholder}"`);
        } else {
          expect(lessonContent).not.toContain("data-processing-status");
        }
      },
    );

    it.each(WEBHOOK_REJECTION_CASES)(
      "$scenario",
      async ({ isSignatureValid, isVideoKnown, httpStatus }) => {
        bunnyStreamServiceMock.validateWebhookSignature.mockResolvedValue(isSignatureValid);
        const hostedVideo = await hostedVideoFactory.create({
          tenantId: target.id,
          copiedFromTenantId: source.id,
        });
        const videoGuid = isVideoKnown ? hostedVideo.providerVideoId! : randomUUID();

        await sendBunnyWebhook(videoGuid, BUNNY_WEBHOOK_VIDEO_STATUSES.FINISHED).expect(httpStatus);

        expect((await findHostedVideo(hostedVideo.id)).status).toBe(
          HOSTED_VIDEO_STATUSES.PROCESSING,
        );
      },
    );

    it("validates the signature with the configuration of the tenant that owns the copy", async () => {
      const hostedVideo = await hostedVideoFactory.create({
        tenantId: target.id,
        copiedFromTenantId: source.id,
      });
      const validatingTenantIds: Array<string | undefined> = [];
      bunnyStreamServiceMock.validateWebhookSignature.mockImplementation(async () => {
        validatingTenantIds.push(dbAls.getStore()?.tenantId);
        return true;
      });

      await sendBunnyWebhook(
        hostedVideo.providerVideoId!,
        BUNNY_WEBHOOK_VIDEO_STATUSES.FINISHED,
      ).expect(201);

      expect(validatingTenantIds).toEqual([target.id]);
    });
  });

  describe("checking unfinished copies with Bunny", () => {
    const checkUnfinishedVideoStatuses = () =>
      app.get(HostedVideoStatusService).checkUnfinishedVideoStatuses();

    it.each(PROVIDER_STATUS_CHECK_CASES)(
      "Bunny API status $bunnyApiStatus leaves a processing copy $hostedStatus",
      async ({ bunnyApiStatus, hostedStatus }) => {
        const hostedVideo = await hostedVideoFactory.create({
          tenantId: target.id,
          copiedFromTenantId: source.id,
        });
        bunnyStreamServiceMock.getVideo.mockResolvedValue({
          guid: hostedVideo.providerVideoId,
          title: "",
          length: 0,
          status: bunnyApiStatus,
        });

        await checkUnfinishedVideoStatuses();

        expect(bunnyStreamServiceMock.getVideo).toHaveBeenCalledWith(hostedVideo.providerVideoId);
        expect((await findHostedVideo(hostedVideo.id)).status).toBe(hostedStatus);
      },
    );

    it("fails a copy that stays processing past the timeout without asking Bunny", async () => {
      const hostedVideo = await hostedVideoFactory.create({
        tenantId: target.id,
        copiedFromTenantId: source.id,
        statusChangedAt: new Date(Date.now() - 3 * 60 * MINUTE_MS).toISOString(),
      });

      await checkUnfinishedVideoStatuses();

      expect(bunnyStreamServiceMock.getVideo).not.toHaveBeenCalledWith(hostedVideo.providerVideoId);
      expect((await findHostedVideo(hostedVideo.id)).status).toBe(HOSTED_VIDEO_STATUSES.FAILED);
    });

    it.each(STALE_UPLOAD_CASES)(
      "$scenario",
      async ({
        uploadAgeMinutes,
        hasProviderVideoId,
        isFoundByTitleMarker,
        bunnyApiStatus,
        hostedStatus,
        adoptsProviderVideo,
      }) => {
        const existingProviderVideoId = randomUUID();
        const adoptedProviderVideoId = randomUUID();
        const uploadingCopy = await hostedVideoFactory.create({
          tenantId: target.id,
          copiedFromTenantId: source.id,
          status: HOSTED_VIDEO_STATUSES.UPLOADING,
          statusChangedAt: new Date(Date.now() - uploadAgeMinutes * MINUTE_MS).toISOString(),
          providerVideoId: hasProviderVideoId ? existingProviderVideoId : null,
          reference: hasProviderVideoId ? buildBunnyVideoReference(existingProviderVideoId) : null,
        });
        bunnyStreamServiceMock.findVideosByTitle.mockImplementation(async (marker: string) =>
          isFoundByTitleMarker
            ? [
                {
                  guid: adoptedProviderVideoId,
                  title: `clip.mp4 · ${marker}`,
                  length: 0,
                  status: 0,
                },
              ]
            : [],
        );
        bunnyStreamServiceMock.getVideo.mockImplementation(async (guid: string) => ({
          guid,
          title: "",
          length: 0,
          status: bunnyApiStatus,
        }));

        await checkUnfinishedVideoStatuses();

        const reconciledCopy = await findHostedVideo(uploadingCopy.id);
        expect(reconciledCopy.status).toBe(hostedStatus);
        if (adoptsProviderVideo) {
          expect(bunnyStreamServiceMock.findVideosByTitle).toHaveBeenCalledWith(
            buildHostedVideoCopyMarker(uploadingCopy.id),
          );
          expect(reconciledCopy).toMatchObject({
            providerVideoId: adoptedProviderVideoId,
            reference: buildBunnyVideoReference(adoptedProviderVideoId),
          });
        } else {
          expect(reconciledCopy.providerVideoId).toBe(uploadingCopy.providerVideoId);
        }
      },
    );
  });
});

function buildVideoNodeHtml(host: string, resourceId: UUIDType) {
  return `<div data-node-type="video" data-src="${host}/api/lesson/lesson-resource/${resourceId}"></div>`;
}
