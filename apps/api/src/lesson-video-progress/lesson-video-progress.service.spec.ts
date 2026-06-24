import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { LESSON_TYPES } from "src/lesson/lesson.type";

import { VIDEO_COMPLETION_COVERAGE_THRESHOLD } from "./lesson-video-progress.constants";
import { LessonVideoProgressService } from "./lesson-video-progress.service";
import { LESSON_VIDEO_PROGRESS_ERROR_KEYS } from "./lesson-video-progress.types";

import type { LessonVideoContext, LessonVideoProgressRow } from "./lesson-video-progress.types";
import type { UpsertLessonVideoProgress } from "./schemas/lesson-video-progress.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

const STUDENT_ID = "00000000-0000-0000-0000-000000000001";
const LESSON_ID = "00000000-0000-0000-0000-000000000002";
const RESOURCE_ENTITY_ID = "00000000-0000-0000-0000-000000000003";
const COURSE_ID = "00000000-0000-0000-0000-000000000004";
const CHAPTER_ID = "00000000-0000-0000-0000-000000000005";
const SECOND_RESOURCE_ENTITY_ID = "00000000-0000-0000-0000-000000000006";

const currentUser = {
  userId: STUDENT_ID,
  permissions: [],
} as unknown as CurrentUserType;

const context: LessonVideoContext = {
  lessonId: LESSON_ID,
  lessonType: LESSON_TYPES.CONTENT,
  chapterId: CHAPTER_ID,
  courseId: COURSE_ID,
  lessonCompleted: false,
  videoCompletionTrackingEnabled: true,
  resourceEntityId: RESOURCE_ENTITY_ID,
  resourceContentType: "video/mp4",
};

const progressRow = (overrides: Partial<LessonVideoProgressRow> = {}): LessonVideoProgressRow => ({
  lessonId: LESSON_ID,
  resourceEntityId: RESOURCE_ENTITY_ID,
  durationSeconds: 100,
  bucketSizeSeconds: 1,
  watchedRanges: [],
  coveredBucketCount: 0,
  coveragePercent: 0,
  isWatched: false,
  watchedAt: null,
  ...overrides,
});

const body = (overrides: Partial<UpsertLessonVideoProgress> = {}): UpsertLessonVideoProgress => ({
  lessonId: LESSON_ID,
  resourceEntityId: RESOURCE_ENTITY_ID,
  durationSeconds: 100,
  bucketSize: 1,
  watchedRanges: [[0, 10]],
  activeWatchSecondsDelta: 10,
  language: SUPPORTED_LANGUAGES.PL,
  ...overrides,
});

const createService = () => {
  const trx = { transaction: "trx" };
  const repository = {
    getLessonVideoContext: jest.fn().mockResolvedValue(context),
    ensureProgressRow: jest.fn().mockResolvedValue(progressRow()),
    mergeWatchedRanges: jest.fn().mockResolvedValue(progressRow({ watchedRanges: [[0, 10]] })),
    markWatched: jest.fn(),
    getRequiredVideoProgressForLesson: jest.fn().mockResolvedValue([]),
    getProgressForResourceIds: jest.fn(),
  };
  const watchSessionService = {
    getAllowedNewBucketCount: jest.fn().mockResolvedValue(100),
    addAcceptedWatchSeconds: jest.fn().mockResolvedValue(undefined),
  };
  const studentLessonProgressService = {
    getLessonProgressAccess: jest.fn().mockResolvedValue({
      canTrackProgress: true,
      isFreemium: false,
    }),
    markLessonAsCompleted: jest.fn().mockResolvedValue(undefined),
  };
  const db = {
    transaction: jest.fn(async (callback: (tx: typeof trx) => Promise<unknown>) => callback(trx)),
  };
  const service = new LessonVideoProgressService(
    repository as never,
    watchSessionService as never,
    studentLessonProgressService as never,
    db as never,
  );

  return {
    service,
    repository,
    watchSessionService,
    studentLessonProgressService,
    db,
    trx,
  };
};

describe("LessonVideoProgressService", () => {
  it("merges only new unique watched ranges and keeps the lesson incomplete below threshold", async () => {
    const { service, repository, watchSessionService, studentLessonProgressService, trx } =
      createService();

    repository.ensureProgressRow.mockResolvedValue(
      progressRow({
        watchedRanges: [[0, 10]],
        coveredBucketCount: 10,
        coveragePercent: 0.1,
      }),
    );
    repository.mergeWatchedRanges.mockResolvedValue(
      progressRow({
        watchedRanges: [[0, 20]],
        coveredBucketCount: 20,
        coveragePercent: 0.2,
      }),
    );
    repository.getRequiredVideoProgressForLesson.mockResolvedValue([
      progressRow({
        watchedRanges: [[0, 20]],
        coveredBucketCount: 20,
        coveragePercent: 0.2,
      }),
    ]);

    const result = await service.upsertProgress(
      body({
        watchedRanges: [
          [5, 10],
          [10, 20],
        ],
      }),
      currentUser,
    );

    expect(repository.mergeWatchedRanges).toHaveBeenCalledWith(
      expect.objectContaining({
        ranges: [[5, 20]],
        activeWatchSecondsDelta: 10,
      }),
      trx,
    );
    expect(watchSessionService.addAcceptedWatchSeconds).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedBucketCount: 10 }),
    );
    expect(repository.markWatched).not.toHaveBeenCalled();
    expect(studentLessonProgressService.markLessonAsCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      coveragePercent: 0.2,
      isWatched: false,
      lessonCompleted: false,
    });
  });

  it("ignores an implausible flush instead of merging posted ranges", async () => {
    const { service, repository, watchSessionService } = createService();

    repository.ensureProgressRow.mockResolvedValue(progressRow({ watchedRanges: [[0, 10]] }));
    watchSessionService.getAllowedNewBucketCount.mockResolvedValue(5);

    const result = await service.upsertProgress(
      body({
        watchedRanges: [[10, 40]],
        activeWatchSecondsDelta: 30,
      }),
      currentUser,
    );

    expect(repository.mergeWatchedRanges).not.toHaveBeenCalled();
    expect(watchSessionService.addAcceptedWatchSeconds).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      coveragePercent: 0,
      isWatched: false,
      lessonCompleted: false,
    });
  });

  it("marks the video watched at the fixed threshold without completing a multi-video lesson early", async () => {
    const { service, repository, studentLessonProgressService } = createService();
    const thresholdProgress = progressRow({
      watchedRanges: [[0, 90]],
      coveredBucketCount: 90,
      coveragePercent: VIDEO_COMPLETION_COVERAGE_THRESHOLD,
    });
    const watchedProgress = progressRow({
      ...thresholdProgress,
      isWatched: true,
      watchedAt: "2026-06-16T13:00:00.000Z",
    });

    repository.mergeWatchedRanges.mockResolvedValue(thresholdProgress);
    repository.markWatched.mockResolvedValue(watchedProgress);
    repository.getRequiredVideoProgressForLesson.mockResolvedValue([
      watchedProgress,
      progressRow({
        resourceEntityId: SECOND_RESOURCE_ENTITY_ID,
        watchedRanges: [[0, 50]],
        coveredBucketCount: 50,
        coveragePercent: 0.5,
      }),
    ]);

    const result = await service.upsertProgress(body({ watchedRanges: [[0, 90]] }), currentUser);

    expect(repository.markWatched).toHaveBeenCalledWith(
      {
        studentId: STUDENT_ID,
        lessonId: LESSON_ID,
        resourceEntityId: RESOURCE_ENTITY_ID,
      },
      expect.anything(),
    );
    expect(studentLessonProgressService.markLessonAsCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      isWatched: true,
      lessonCompleted: false,
    });
  });

  it("stores progress without watched or lesson completion side effects when tracking is disabled", async () => {
    const { service, repository, studentLessonProgressService } = createService();
    const thresholdProgress = progressRow({
      watchedRanges: [[0, 90]],
      coveredBucketCount: 90,
      coveragePercent: VIDEO_COMPLETION_COVERAGE_THRESHOLD,
    });

    repository.getLessonVideoContext.mockResolvedValue({
      ...context,
      videoCompletionTrackingEnabled: false,
    });
    repository.mergeWatchedRanges.mockResolvedValue(thresholdProgress);

    const result = await service.upsertProgress(body({ watchedRanges: [[0, 90]] }), currentUser);

    expect(repository.mergeWatchedRanges).toHaveBeenCalled();
    expect(repository.markWatched).not.toHaveBeenCalled();
    expect(repository.getRequiredVideoProgressForLesson).not.toHaveBeenCalled();
    expect(studentLessonProgressService.markLessonAsCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      watchedRanges: [[0, 90]],
      coveragePercent: VIDEO_COMPLETION_COVERAGE_THRESHOLD,
      isWatched: false,
      lessonCompleted: false,
    });
  });

  it("completes the lesson when every required video is watched", async () => {
    const { service, repository, studentLessonProgressService, trx } = createService();
    const watchedProgress = progressRow({
      watchedRanges: [[0, 90]],
      coveredBucketCount: 90,
      coveragePercent: VIDEO_COMPLETION_COVERAGE_THRESHOLD,
      isWatched: true,
      watchedAt: "2026-06-16T13:00:00.000Z",
    });

    repository.mergeWatchedRanges.mockResolvedValue(watchedProgress);
    repository.getRequiredVideoProgressForLesson.mockResolvedValue([
      watchedProgress,
      progressRow({
        resourceEntityId: SECOND_RESOURCE_ENTITY_ID,
        watchedRanges: [[0, 100]],
        coveredBucketCount: 100,
        coveragePercent: 1,
        isWatched: true,
        watchedAt: "2026-06-16T13:00:00.000Z",
      }),
    ]);

    const result = await service.upsertProgress(body({ watchedRanges: [[0, 90]] }), currentUser);

    expect(studentLessonProgressService.markLessonAsCompleted).toHaveBeenCalledWith({
      id: LESSON_ID,
      studentId: STUDENT_ID,
      userPermissions: currentUser.permissions,
      actor: currentUser,
      dbInstance: trx,
      language: SUPPORTED_LANGUAGES.PL,
    });
    expect(result.lessonCompleted).toBe(true);
  });

  it("rejects unsupported access and resource states with translation keys", async () => {
    const { service, repository, studentLessonProgressService } = createService();

    await expect(service.upsertProgress(body({ bucketSize: 5 }), currentUser)).rejects.toThrow(
      BadRequestException,
    );

    repository.getLessonVideoContext.mockResolvedValue(null);
    await expect(service.upsertProgress(body(), currentUser)).rejects.toMatchObject({
      response: { message: LESSON_VIDEO_PROGRESS_ERROR_KEYS.RESOURCE_NOT_FOUND },
    });

    repository.getLessonVideoContext.mockResolvedValue({
      ...context,
      resourceContentType: "application/pdf",
    });
    await expect(service.upsertProgress(body(), currentUser)).rejects.toThrow(BadRequestException);

    repository.getLessonVideoContext.mockResolvedValue(context);
    studentLessonProgressService.getLessonProgressAccess.mockResolvedValue({
      canTrackProgress: false,
      isFreemium: false,
    });

    await expect(service.upsertProgress(body(), currentUser)).rejects.toThrow(ForbiddenException);
  });
});
