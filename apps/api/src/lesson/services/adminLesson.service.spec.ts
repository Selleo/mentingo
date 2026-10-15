import { BadRequestException } from "@nestjs/common";

import { AdminLessonService } from "./adminLesson.service";

import type { CreateAiMentorLessonBody } from "../lesson.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

const chapterId = "00000000-0000-4000-8000-000000000002";
const lessonId = "00000000-0000-4000-8000-000000000003";
const mentorId = "00000000-0000-4000-8000-000000000004";
const actor: CurrentUserType = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000005",
  email: "author@example.test",
  permissions: [],
  roleSlugs: [],
};

function createService(availableLocales: string[] = ["en", "pl"]) {
  const transaction = jest.fn(async (callback: (trx: object) => Promise<unknown>) => callback({}));
  const db = { transaction };
  const localizationService = {
    getBaseLanguage: jest.fn().mockImplementation((_type, _id, requestedLanguage) => ({
      baseLanguage: "en",
      language:
        requestedLanguage && availableLocales.includes(requestedLanguage)
          ? requestedLanguage
          : "en",
      availableLocales,
    })),
  };
  const adminLessonRepository = {
    getMaxDisplayOrder: jest.fn().mockResolvedValue(4),
    createLessonForChapter: jest.fn().mockResolvedValue({ id: lessonId, chapterId }),
    createAiMentorLesson: jest.fn().mockResolvedValue({ id: lessonId, chapterId }),
    createAiMentorLessonData: jest.fn().mockResolvedValue([{ id: mentorId }]),
    updateLessonCountForChapter: jest.fn().mockResolvedValue(undefined),
  };
  const resourceLibraryService = {
    syncLessonAssetRelations: jest.fn().mockResolvedValue(undefined),
  };
  const searchIndexService = { refreshLesson: jest.fn().mockResolvedValue(undefined) };
  const aiMentorConfigurationGraphService = {
    createConfigurationInTransaction: jest.fn().mockResolvedValue(mentorId),
  };
  const aiJudgeConfigurationGraphService = {
    createConfigurationInTransaction: jest.fn().mockResolvedValue(mentorId),
  };
  const outboxPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = Object.create(AdminLessonService.prototype) as AdminLessonService;
  Object.assign(service as unknown as Record<string, unknown>, {
    db,
    localizationService,
    adminLessonRepository,
    resourceLibraryService,
    searchIndexService,
    aiMentorConfigurationGraphService,
    aiJudgeConfigurationGraphService,
    outboxPublisher,
    masterCourseService: {
      assertCourseContentEditableByChapterId: jest.fn().mockResolvedValue(undefined),
    },
    courseFeaturePolicyService: {
      assertCourseFeatureEnabledByChapterId: jest.fn().mockResolvedValue(undefined),
    },
    validateAccess: jest.fn().mockResolvedValue(undefined),
    publishCreateLessonEvent: jest.fn().mockResolvedValue(undefined),
    buildLessonActivitySnapshot: jest
      .fn()
      .mockResolvedValue({ id: lessonId, title: "Prowadź ćwiczenie", description: "Opis" }),
  });
  return {
    service,
    localizationService,
    adminLessonRepository,
    resourceLibraryService,
    searchIndexService,
    aiMentorConfigurationGraphService,
    aiJudgeConfigurationGraphService,
    outboxPublisher,
  };
}

describe("AdminLessonService course-authoring locale", () => {
  it("persists content lessons in the requested locale and emits a matching snapshot", async () => {
    const test = createService();

    await test.service.createLessonForChapter(
      { chapterId, type: "content", title: "Prowadź ćwiczenie", description: "" },
      actor,
      "pl",
    );

    expect(test.adminLessonRepository.createLessonForChapter).toHaveBeenCalledWith(
      expect.objectContaining({ chapterId, title: "Prowadź ćwiczenie" }),
      "pl",
      expect.any(Object),
    );
    expect(test.service.publishCreateLessonEvent).toHaveBeenCalledWith(lessonId, "pl", actor);
  });

  it("rejects an unavailable explicit content locale before lesson insertion", async () => {
    const test = createService(["en"]);

    await expect(
      test.service.createLessonForChapter(
        { chapterId, type: "content", title: "Lesson", description: "" },
        actor,
        "pl",
      ),
    ).rejects.toThrow(new BadRequestException("adminCourseView.toast.languageNotSupported"));

    expect(test.adminLessonRepository.createLessonForChapter).not.toHaveBeenCalled();
    expect(test.service.publishCreateLessonEvent).not.toHaveBeenCalled();
  });

  it("creates Mentor text and configurations in the requested locale and emits its snapshot", async () => {
    const test = createService();
    const data = {
      chapterId,
      title: "Prowadź ćwiczenie",
      description: "Ćwicz materiał.",
      name: "Mentor",
      aiMentorConfiguration: {
        type: "teacher",
        taskGoal: "Practice course skills.",
        expertise: "Course content",
        contentScope: "Current course",
        teachingStyle: "guided_discovery",
      },
      aiJudgeConfiguration: {
        taskGoal: "Assess the learner",
        passingThresholdPercent: 70,
        criteria: [],
        blockingErrors: [],
      },
    } as CreateAiMentorLessonBody;

    await test.service.createAiMentorLesson(data, actor, "pl");

    expect(test.adminLessonRepository.createAiMentorLesson).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Prowadź ćwiczenie" }),
      5,
      "pl",
      expect.any(Object),
    );
    expect(test.adminLessonRepository.createAiMentorLessonData).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId, language: "pl", name: "Mentor" }),
      expect.any(Object),
    );
    expect(
      test.aiMentorConfigurationGraphService.createConfigurationInTransaction,
    ).toHaveBeenCalledWith(mentorId, data.aiMentorConfiguration, "pl", expect.any(Object));
    expect(
      test.aiJudgeConfigurationGraphService.createConfigurationInTransaction,
    ).toHaveBeenCalledWith(mentorId, data.aiJudgeConfiguration, "pl", expect.any(Object));
    expect(
      (test.service as unknown as { buildLessonActivitySnapshot: jest.Mock })
        .buildLessonActivitySnapshot,
    ).toHaveBeenCalledWith(lessonId, "pl");
    const event = test.outboxPublisher.publish.mock.calls[0][0];
    expect(event.lessonCreationData.createdLesson.title).toBe("Prowadź ćwiczenie");
  });

  it("rejects an unavailable explicit Mentor locale before lesson insertion", async () => {
    const test = createService(["en"]);
    const data = {
      chapterId,
      title: "Mentor",
      name: "Mentor",
      aiMentorConfiguration: {
        type: "teacher",
        taskGoal: "Practice course skills.",
        expertise: "Course content",
        contentScope: "Current course",
        teachingStyle: "guided_discovery",
      },
      aiJudgeConfiguration: {
        taskGoal: "Assess the learner",
        passingThresholdPercent: 70,
        criteria: [],
        blockingErrors: [],
      },
    } as CreateAiMentorLessonBody;

    await expect(test.service.createAiMentorLesson(data, actor, "pl")).rejects.toThrow(
      new BadRequestException("adminCourseView.toast.languageNotSupported"),
    );

    expect(test.adminLessonRepository.createAiMentorLesson).not.toHaveBeenCalled();
    expect(test.outboxPublisher.publish).not.toHaveBeenCalled();
  });
});
