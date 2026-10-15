import { BadRequestException } from "@nestjs/common";

import { AdminChapterService } from "./adminChapter.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

const courseId = "00000000-0000-4000-8000-000000000001";
const chapterId = "00000000-0000-4000-8000-000000000002";
const actor: CurrentUserType = {
  userId: courseId,
  tenantId: courseId,
  email: "author@example.test",
  permissions: [],
  roleSlugs: [],
};

function createService(availableLocales: string[] = ["en", "pl"]) {
  const transaction = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([{ displayOrder: 2 }]),
  };
  const db = {
    transaction: jest.fn(async (callback: (trx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const chapterSnapshot = {
    id: chapterId,
    title: "Rozdział",
    courseId,
    authorId: actor.userId,
    displayOrder: 3,
    isFreemium: false,
    lessonCount: 0,
  };
  const adminChapterRepository = {
    createChapterForCourse: jest.fn().mockResolvedValue(chapterSnapshot),
    updateChapterDisplayOrder: jest.fn().mockResolvedValue(undefined),
    updateChapterCountForCourse: jest.fn().mockResolvedValue(undefined),
    getChapterById: jest.fn().mockResolvedValue([chapterSnapshot]),
  };
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
  const outboxPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminChapterService(
    db as never,
    adminChapterRepository as never,
    { validateAccess: jest.fn().mockResolvedValue(undefined) } as never,
    { assertCourseContentEditable: jest.fn().mockResolvedValue(undefined) } as never,
    { assertCourseFeatureEnabled: jest.fn().mockResolvedValue(undefined) } as never,
    localizationService as never,
    outboxPublisher as never,
  );
  return { service, adminChapterRepository, localizationService, outboxPublisher, db };
}

describe("AdminChapterService course-authoring locale", () => {
  it("persists and emits the requested available locale", async () => {
    const test = createService();

    await test.service.createChapterForCourse({ courseId, title: "Rozdział" }, actor, "pl");

    expect(test.adminChapterRepository.createChapterForCourse).toHaveBeenCalledWith(
      expect.objectContaining({ courseId, title: "Rozdział", language: "pl" }),
      expect.any(Object),
    );
    expect(test.adminChapterRepository.getChapterById).toHaveBeenCalledWith(chapterId, "pl");
    const event = test.outboxPublisher.publish.mock.calls[0][0];
    expect(event.chapterCreationData.createdChapter.title).toBe("Rozdział");
  });

  it("rejects an unavailable explicit locale before inserting a chapter", async () => {
    const test = createService(["en"]);

    await expect(
      test.service.createChapterForCourse({ courseId, title: "Rozdział" }, actor, "pl"),
    ).rejects.toThrow(new BadRequestException("adminCourseView.toast.languageNotSupported"));

    expect(test.adminChapterRepository.createChapterForCourse).not.toHaveBeenCalled();
    expect(test.outboxPublisher.publish).not.toHaveBeenCalled();
  });
});
