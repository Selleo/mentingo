import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { COURSE_STATUSES, PERMISSIONS } from "@repo/shared";

import { CourseAuthoringContextService } from "./course-authoring-context.service";

import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { AiJudgeConfigurationService } from "src/lesson/ai-judge-configuration/ai-judge-configuration.service";
import type { AiMentorConfigurationService } from "src/lesson/ai-mentor-configuration/services/ai-mentor-configuration.service";
import type { AdminLessonService } from "src/lesson/services/adminLesson.service";
import type { LocalizationService } from "src/localization/localization.service";
import type { PermissionsService } from "src/permissions/permissions.service";
import type { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";

describe("CourseAuthoringContextService authorization", () => {
  const validateAccess = jest.fn();
  const getUserAccess = jest.fn();
  const service = new CourseAuthoringContextService(
    {} as DatabasePg,
    { validateAccess } as unknown as AdminLessonService,
    {} as LocalizationService,
    { getUserAccess } as unknown as PermissionsService,
    {} as QuizAuthoringService,
    {} as AiMentorConfigurationService,
    {} as AiJudgeConfigurationService,
  );
  const actor: CurrentUserType = {
    userId: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
    email: "author@example.test",
    roleSlugs: [],
    permissions: [PERMISSIONS.COURSE_AI_GENERATION],
  };

  beforeEach(() => {
    validateAccess.mockReset();
    getUserAccess.mockReset().mockResolvedValue({ permissions: actor.permissions, roleSlugs: [] });
  });

  it("does not allow course editing permission alone to grant AI access", async () => {
    getUserAccess.mockResolvedValue({ permissions: [PERMISSIONS.COURSE_UPDATE], roleSlugs: [] });
    await expect(
      service.authorize(actor.userId, { ...actor, permissions: [PERMISSIONS.COURSE_UPDATE] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(validateAccess).not.toHaveBeenCalled();
  });

  it("checks current course access even when generation is permitted", async () => {
    validateAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.authorize(actor.userId, actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(validateAccess).toHaveBeenCalledWith("course", actor, actor.userId);
  });

  it("does not cache authorization between commands", async () => {
    validateAccess.mockResolvedValueOnce(true).mockRejectedValueOnce(new ForbiddenException());
    await service.authorize(actor.userId, actor);
    await expect(service.authorize(actor.userId, actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(validateAccess).toHaveBeenCalledTimes(2);
  });
});

describe("CourseAuthoringContextService legacy block preparation", () => {
  it("assigns IDs under a row lock without routing through a learner-facing mutation", async () => {
    const lock = jest.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000003",
        description: { en: "<p>Existing lesson</p>", pl: "<p>Polska treść</p>" },
      },
      { id: "00000000-0000-4000-8000-000000000004", description: { en: "Legacy plain text" } },
    ]);
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where: updateWhere });
    const transaction = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ for: lock }) }),
        }),
      }),
      update: jest.fn().mockReturnValue({ set }),
    };
    const validateAccess = jest.fn().mockResolvedValue(undefined);
    const service = new CourseAuthoringContextService(
      {
        transaction: (callback: (db: typeof transaction) => Promise<void>) => callback(transaction),
      } as unknown as DatabasePg,
      { validateAccess } as unknown as AdminLessonService,
      {} as LocalizationService,
      {
        getUserAccess: jest
          .fn()
          .mockResolvedValue({ permissions: [PERMISSIONS.COURSE_AI_GENERATION], roleSlugs: [] }),
      } as unknown as PermissionsService,
      {} as QuizAuthoringService,
      {} as AiMentorConfigurationService,
      {} as AiJudgeConfigurationService,
    );
    await service.prepareBlockIdentities("00000000-0000-4000-8000-000000000005", "en", {
      userId: "00000000-0000-4000-8000-000000000001",
      tenantId: "00000000-0000-4000-8000-000000000002",
      email: "author@example.test",
      permissions: [PERMISSIONS.COURSE_AI_GENERATION],
      roleSlugs: [],
    });
    expect(lock).toHaveBeenCalledWith("update", expect.objectContaining({ of: expect.anything() }));
    expect(set).toHaveBeenCalledTimes(1);
    expect(Object.keys(set.mock.calls[0][0])).toEqual(["description"]);
    expect(validateAccess).toHaveBeenCalledTimes(1);
  });
});

describe("CourseAuthoringContextService selected lesson details", () => {
  const courseId = "00000000-0000-4000-8000-000000000005";
  const chapterId = "00000000-0000-4000-8000-000000000006";
  const otherChapterId = "00000000-0000-4000-8000-000000000009";
  const selectedLessonId = "00000000-0000-4000-8000-000000000007";
  const unrelatedLessonId = "00000000-0000-4000-8000-000000000008";
  const actor: CurrentUserType = {
    userId: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
    email: "author@example.test",
    roleSlugs: [],
    permissions: [PERMISSIONS.COURSE_AI_GENERATION],
  };

  const makeQuery = <T>(rows: T[]) => {
    const builder: Record<string, jest.Mock | ((resolve: (value: T[]) => unknown) => unknown)> = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      leftJoin: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn(),
      groupBy: jest.fn(),
    };
    for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy"])
      (builder[method] as jest.Mock).mockReturnValue(builder);
    builder.then = (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve);
    return builder;
  };

  const createService = (rows: unknown[], access = actor.permissions) => {
    const select = jest.fn();
    for (const result of rows) select.mockReturnValueOnce(makeQuery(result as never[]));
    const quizAuthoring = {
      getQuizLessonForAuthoring: jest.fn().mockResolvedValue(null),
    } as unknown as QuizAuthoringService;
    const mentorConfigurations = { getConfiguration: jest.fn() };
    const judgeConfigurations = { getConfiguration: jest.fn() };
    const service = new CourseAuthoringContextService(
      { select } as unknown as DatabasePg,
      { validateAccess: jest.fn().mockResolvedValue(undefined) } as unknown as AdminLessonService,
      {
        getLocalizedSqlField: jest.fn().mockReturnValue("localized"),
      } as unknown as LocalizationService,
      {
        getUserAccess: jest.fn().mockResolvedValue({ permissions: access, roleSlugs: [] }),
      } as unknown as PermissionsService,
      quizAuthoring,
      mentorConfigurations as unknown as AiMentorConfigurationService,
      judgeConfigurations as unknown as AiJudgeConfigurationService,
    );
    return { service, select, quizAuthoring, mentorConfigurations, judgeConfigurations };
  };

  const selectedLesson = {
    id: selectedLessonId,
    chapterId,
    title: "Selected lesson",
    description: "<p>Selected content</p>",
    lessonType: "content",
    displayOrder: 1,
    updatedAt: "2026-09-17T00:00:00.000Z",
  };
  const parentChapter = { id: chapterId, title: "Parent chapter", displayOrder: 1 };

  it("reads only localized content lesson bodies for Mentor context", async () => {
    const contentLesson = {
      id: selectedLessonId,
      chapterId,
      chapterTitle: "Parent chapter",
      title: "Selected lesson",
      description: "<p>Selected content</p>",
    };
    const { service, select } = createService([[contentLesson]]);

    await expect(service.getMentorContextLessons(courseId, "en", actor)).resolves.toEqual([
      contentLesson,
    ]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("rechecks course AI permission before reading Mentor context", async () => {
    const { service, select } = createService([], [PERMISSIONS.COURSE_UPDATE]);

    await expect(service.getMentorContextLessons(courseId, "en", actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(select).not.toHaveBeenCalled();
  });

  it("returns only selected lesson detail and its parent identity", async () => {
    const { service, select } = createService([
      [{ id: courseId, availableLocales: ["en"] }],
      [selectedLesson],
      [parentChapter],
      [],
      [],
    ]);

    const result = await service.getSelectedLessonDetails(
      courseId,
      "en",
      [selectedLessonId],
      actor,
    );

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]).toMatchObject({ id: chapterId, title: "Parent chapter" });
    expect(result.chapters[0]?.lessons).toHaveLength(1);
    expect(result.chapters[0]?.lessons[0]).toMatchObject({
      id: selectedLessonId,
      description: "<p>Selected content</p>",
      lessonType: "content",
    });
    expect(result.chapters[0]?.lessons[0]?.baselineHash).toMatch(/^[0-9a-f]{64}$/);
    expect(select).toHaveBeenCalledTimes(5);
  });

  it("rejects a lesson that is outside the authorized course", async () => {
    const { service, select } = createService([[{ id: courseId, availableLocales: ["en"] }], []]);

    await expect(
      service.getSelectedLessonDetails(courseId, "en", [selectedLessonId], actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("hydrates quiz and Mentor/Judge detail only for selected lessons", async () => {
    const quizLessonId = "00000000-0000-4000-8000-000000000010";
    const mentorLessonId = "00000000-0000-4000-8000-000000000011";
    const quizLesson = { ...selectedLesson, id: quizLessonId, lessonType: "quiz" };
    const mentorLesson = { ...selectedLesson, id: mentorLessonId, lessonType: "ai_mentor" };
    const { service, quizAuthoring, mentorConfigurations, judgeConfigurations } = createService([
      [{ id: courseId, availableLocales: ["en"] }],
      [quizLesson, mentorLesson],
      [parentChapter],
      [{ lessonId: quizLessonId, attemptCount: 2, cooldownHours: 4 }],
      [{ lessonId: mentorLessonId, configurationUpdatedAt: null, judgeUpdatedAt: null }],
    ]);
    quizAuthoring.getQuizLessonForAuthoring = jest.fn().mockResolvedValue({
      assessment: { passingScorePercentage: "80", maximumAttempts: 3 },
      questions: [{ id: "question" }],
    });
    mentorConfigurations.getConfiguration.mockResolvedValue({ type: "teacher" });
    judgeConfigurations.getConfiguration.mockResolvedValue(null);

    const result = await service.getSelectedLessonDetails(
      courseId,
      "en",
      [quizLessonId, mentorLessonId],
      actor,
    );

    expect(result.chapters[0]?.lessons[0]?.quiz).toMatchObject({
      thresholdScore: 80,
      attemptsLimit: 3,
      quizCooldownInHours: 4,
    });
    expect(result.chapters[0]?.lessons[1]?.mentorConfiguration).toEqual({ type: "teacher" });
    expect(result.chapters[0]?.lessons[1]?.judgeConfiguration).toBeNull();
    expect(quizAuthoring.getQuizLessonForAuthoring).toHaveBeenCalledTimes(1);
    expect(mentorConfigurations.getConfiguration).toHaveBeenCalledWith(mentorLessonId, actor, "en");
    expect(judgeConfigurations.getConfiguration).toHaveBeenCalledWith(mentorLessonId, actor, "en");
  });

  it("rechecks current AI generation access before reading selected detail", async () => {
    const { service, select } = createService([], [PERMISSIONS.COURSE_UPDATE]);

    await expect(
      service.getSelectedLessonDetails(courseId, "en", [selectedLessonId], actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(select).not.toHaveBeenCalled();
  });

  it("uses the same selected lesson baseline and detail shape as full context", async () => {
    const course = {
      id: courseId,
      status: COURSE_STATUSES.PRIVATE,
      title: "Course",
      description: "Description",
      availableLocales: ["en"],
      settings: {
        lessonSequenceEnabled: true,
        quizFeedbackEnabled: false,
        videoCompletionTrackingEnabled: true,
        certificateSignature: "internal/s3/key",
        certificateFontColor: "#123456",
        certificateValidity: null,
      },
      learningOutcomes: {},
      thumbnailS3Key: null,
    };
    const chapters = [parentChapter, { id: otherChapterId, title: "Other", displayOrder: 2 }];
    const lessons = [
      selectedLesson,
      {
        ...selectedLesson,
        id: unrelatedLessonId,
        chapterId: otherChapterId,
        title: "Other lesson",
      },
    ];
    const assessments: unknown[] = [];
    const mentorVersions: unknown[] = [];
    const full = createService([[course], chapters, lessons, assessments, mentorVersions]);
    const fullContext = await full.service.getContext(
      courseId,
      { language: "en", lessonIds: [selectedLessonId] },
      actor,
    );
    expect(fullContext.course).toMatchObject({
      id: courseId,
      status: COURSE_STATUSES.PRIVATE,
      title: "Course",
      description: "Description",
      settings: {
        lessonSequenceEnabled: true,
        quizFeedbackEnabled: false,
        videoCompletionTrackingEnabled: true,
        certificateFontColor: "#123456",
        certificateValidity: null,
      },
    });
    expect(fullContext.course.settings).not.toHaveProperty("certificateSignature");
    expect(fullContext.course.allowedFields).toEqual(
      expect.arrayContaining([
        "lessonSequenceEnabled",
        "quizFeedbackEnabled",
        "certificateValidity",
      ]),
    );
    const selected = createService([
      [{ id: courseId, availableLocales: ["en"] }],
      [selectedLesson],
      [parentChapter],
      [],
      [],
    ]);
    const selectedContext = await selected.service.getSelectedLessonDetails(
      courseId,
      "en",
      [selectedLessonId],
      actor,
    );

    expect(selectedContext.chapters[0]?.lessons[0]).toEqual(
      fullContext.chapters[0]?.lessons.find((lesson) => lesson.id === selectedLessonId),
    );
  });
});
