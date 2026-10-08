import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FormatRegistry } from "@sinclair/typebox";
import { load as loadHtml } from "cheerio";
import { validate } from "uuid";

import { CourseAuthoringApplyService } from "./course-authoring-apply.service";
import {
  mentorCourseContextKey,
  mentorTargetedContextKey,
} from "./course-authoring-mentor-context";

import type { PreparedCourseAuthoringApplication } from "./course-authoring.types";
import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

jest.mock("src/outbox/outbox.constants", () => ({
  isOutboxProcessingEnabled: jest.fn(() => true),
}));

const courseId = "00000000-0000-4000-8000-000000000001";
const chapterId = "00000000-0000-4000-8000-000000000002";
const lessonId = "00000000-0000-4000-8000-000000000003";
const operationId = "00000000-0000-4000-8000-000000000004";
const sourceVersionId = "00000000-0000-4000-8000-000000000006";
const actor: CurrentUserType = {
  userId: courseId,
  tenantId: chapterId,
  email: "author@example.test",
  permissions: [],
  roleSlugs: [],
};

const createMentorOperation = (sourceVersionIds: string[]): AuthoringOperation => ({
  type: "lesson.create",
  operationId,
  targetId: operationId,
  chapterId,
  displayOrder: 0,
  baselineHash: null,
  language: "en",
  dependencies: [],
  payload: {
    lessonType: "ai_mentor",
    title: "Course coach",
    description: "Practice the course skills.",
    name: "Course coach",
    configurationType: "teacher",
    configuration: {
      taskGoal: "Apply course skills.",
      openingInstruction: null,
      additionalInstructions: null,
      expertise: "Course content",
      contentScope: "The current course",
      teachingStyle: "guided_discovery",
      feedbackGuidance: null,
    },
    judgeConfiguration: {
      taskGoal: "Assess application of course skills.",
      passingThresholdPercent: 70,
      criteria: [
        {
          ref: "C1",
          title: "Applies the material",
          expectedBehavior: "Uses the course lesson content.",
          maxScore: 5,
          scoreGuidance: [
            { score: 5, description: "Applies the lesson accurately.", example: null },
          ],
        },
      ],
      blockingErrors: [],
    },
    sourceVersionIds,
    avatarAssetId: null,
    preparedResourceIds: [],
  },
});

describe("CourseAuthoringApplyService reviewed assessment guard", () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));
  function setup() {
    const query = {
      from: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
      for: jest.fn().mockResolvedValue([]),
      *[Symbol.iterator]() {
        yield { id: chapterId, description: "" };
      },
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const persistedLessonCount = jest.fn().mockReturnValue(100);
    const countQuery = { from: jest.fn(), where: jest.fn() };
    countQuery.from.mockReturnValue(countQuery);
    countQuery.where.mockImplementation(async () => [{ value: persistedLessonCount() }]);
    const transaction = {
      execute: jest.fn(),
      select: jest
        .fn()
        .mockImplementation((fields: Record<string, unknown>) =>
          "value" in fields ? countQuery : query,
        ),
    };
    const context = {
      authorize: jest.fn(),
      getContext: jest.fn().mockResolvedValue({
        baselineHash: "course",
        fieldHashes: {},
        chapters: [
          {
            id: chapterId,
            baselineHash: "chapter",
            deletionBaselineHash: "c".repeat(64),
            lessons: [
              {
                id: lessonId,
                baselineHash: "b".repeat(64),
                lessonType: "quiz",
                assessmentAttemptCount: 2,
              },
            ],
          },
        ],
      }),
    };
    const removeLesson = jest.fn();
    const removeChapter = jest.fn();
    const createChapterForCourse = jest.fn();
    const updateChapterDisplayOrder = jest.fn();
    const createLessonForChapter = jest.fn().mockResolvedValue(operationId);
    const createAiMentorLesson = jest.fn().mockResolvedValue(operationId);
    const updateLesson = jest.fn();
    const updateLessonDisplayOrder = jest.fn();
    const saveQuizFromAuthoring = jest.fn().mockResolvedValue(operationId);
    const createLessonResources = jest.fn().mockResolvedValue([{ id: lessonId }]);
    const assignDocumentToAiMentorLesson = jest.fn().mockResolvedValue(undefined);
    const replaceCourseAuthoringMentorContext = jest.fn().mockResolvedValue(undefined);
    const lessonService = {
      removeLesson,
      createLessonForChapter,
      createAiMentorLesson,
      updateLesson,
      updateLessonDisplayOrder,
      saveQuizFromAuthoring,
    };
    const applyOnce = jest.fn().mockImplementation(async (_claim, execute) => execute(transaction));
    type Dependencies = ConstructorParameters<typeof CourseAuthoringApplyService>;
    const service = new CourseAuthoringApplyService(
      transaction as unknown as Dependencies[0],
      context as unknown as Dependencies[1],
      { applyOnce } as unknown as Dependencies[2],
      {
        removeChapter,
        createChapterForCourse,
        updateChapterDisplayOrder,
      } as unknown as Dependencies[3],
      lessonService as unknown as Dependencies[4],
      {} as Dependencies[5],
      {} as Dependencies[6],
      {} as Dependencies[7],
      {
        assignDocumentToAiMentorLesson,
        replaceCourseAuthoringMentorContext,
      } as unknown as Dependencies[8],
      { createLessonResources } as unknown as Dependencies[9],
    );
    const input: PreparedCourseAuthoringApplication = {
      courseId,
      sessionId: chapterId,
      exportId: operationId,
      exportHash: "a".repeat(64),
      assetMappings: {},
      assetMimeTypes: {},
      preparedDocumentIds: {},
      operations: [
        {
          type: "lesson.delete",
          operationId,
          targetId: lessonId,
          baselineHash: "b".repeat(64),
          language: "en",
          dependencies: [],
        },
      ],
    };
    return {
      service,
      persistedLessonCount,
      input,
      context,
      removeLesson,
      removeChapter,
      createChapterForCourse,
      updateChapterDisplayOrder,
      updateLessonDisplayOrder,
      createLessonForChapter,
      createAiMentorLesson,
      updateLesson,
      saveQuizFromAuthoring,
      createLessonResources,
      assignDocumentToAiMentorLesson,
      replaceCourseAuthoringMentorContext,
    };
  }
  it.each([
    [2, 1, 0],
    [2, 0],
  ])(
    "persists approved positions for full and partial out-of-order sibling selections (%j)",
    async (...arrivalOrder) => {
      const test = setup();
      const chapterIds = [7, 8, 9].map(
        (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
      );
      const lessonIds = [10, 11, 12].map(
        (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
      );
      const chapters: string[] = [];
      const lessons: string[] = [];
      const move = (ids: string[], id: string, oneBasedIndex: number) => {
        const from = ids.indexOf(id);
        ids.splice(from, 1);
        ids.splice(oneBasedIndex - 1, 0, id);
      };
      test.context.getContext.mockResolvedValue({
        baselineHash: "course",
        fieldHashes: {},
        chapters: [],
      });
      test.createChapterForCourse.mockImplementation(async ({ title }: { title: string }) => {
        chapters.push(title);
        return { id: title };
      });
      test.updateChapterDisplayOrder.mockImplementation(
        async ({ chapterId: id, displayOrder }: { chapterId: string; displayOrder: number }) => {
          expect(chapters).toHaveLength(arrivalOrder.length);
          move(chapters, id, displayOrder);
        },
      );
      test.createLessonForChapter.mockImplementation(async ({ title }: { title: string }) => {
        lessons.push(title);
        return title;
      });
      test.updateLessonDisplayOrder.mockImplementation(
        async ({ lessonId: id, displayOrder }: { lessonId: string; displayOrder: number }) => {
          expect(lessons).toHaveLength(arrivalOrder.length);
          expect(displayOrder).toBeLessThanOrEqual(lessons.length);
          move(lessons, id, displayOrder);
        },
      );
      test.persistedLessonCount.mockImplementation(() => lessons.length);
      test.input.operations = arrivalOrder.flatMap((index) => [
        {
          type: "chapter.create" as const,
          operationId: chapterIds[index],
          targetId: chapterIds[index],
          baselineHash: null,
          language: "en" as const,
          dependencies: [],
          payload: { title: chapterIds[index], displayOrder: index },
        },
        {
          type: "lesson.create" as const,
          operationId: lessonIds[index],
          targetId: lessonIds[index],
          chapterId: chapterIds[0],
          displayOrder: index,
          baselineHash: null,
          language: "en" as const,
          dependencies: [chapterIds[0]],
          payload: {
            lessonType: "content" as const,
            title: lessonIds[index],
            description: "<p>Example</p>",
          },
        },
      ]);
      await test.service.applyPreparedExport(test.input, actor);
      expect(chapters).toEqual(chapterIds.filter((_, index) => arrivalOrder.includes(index)));
      expect(lessons).toEqual(lessonIds.filter((_, index) => arrivalOrder.includes(index)));
      expect(test.persistedLessonCount).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects attempted quiz deletion before a native mutation when acknowledgement is absent", async () => {
    const test = setup();
    await expect(test.service.applyPreparedExport(test.input, actor)).rejects.toThrow(
      "courseAuthoring.errors.assessmentAttemptsAcknowledgementRequired",
    );
    expect(test.removeLesson).not.toHaveBeenCalled();
    expect(test.context.authorize).toHaveBeenCalledTimes(2);
  });
  it("uses the native removal path after acknowledgement without introducing learner policy", async () => {
    const test = setup();
    test.input.acknowledgeAssessmentChanges = true;
    const result = await test.service.applyPreparedExport(test.input, actor);
    expect(test.removeLesson).toHaveBeenCalledWith(lessonId, actor);
    expect(result.appliedOperationIds).toEqual([operationId]);
  });
  it("also requires acknowledgement for a parent chapter containing attempted quizzes", async () => {
    const test = setup();
    test.input.operations = [
      {
        type: "chapter.delete",
        operationId,
        targetId: chapterId,
        baselineHash: "c".repeat(64),
        language: "en",
        dependencies: [],
      },
    ];
    await expect(test.service.applyPreparedExport(test.input, actor)).rejects.toThrow(
      "courseAuthoring.errors.assessmentAttemptsAcknowledgementRequired",
    );
    expect(test.removeLesson).not.toHaveBeenCalled();
  });

  it("loads one locked course context for a multi-operation selection in the same language", async () => {
    const test = setup();
    test.input.acknowledgeAssessmentChanges = true;
    const chapterOperationId = "00000000-0000-4000-8000-000000000005";
    test.input.operations.push({
      type: "chapter.delete",
      operationId: chapterOperationId,
      targetId: chapterId,
      baselineHash: "c".repeat(64),
      language: "en",
      dependencies: [operationId],
    });

    await test.service.applyPreparedExport(test.input, actor);

    expect(test.context.getContext).toHaveBeenCalledTimes(1);
    expect(test.removeLesson).toHaveBeenCalledWith(lessonId, actor);
    expect(test.removeChapter).toHaveBeenCalledWith(chapterId, actor);
  });

  it("creates an asset-bearing content lesson before assigning its image resource", async () => {
    const test = setup();
    test.input.operations = [
      {
        type: "lesson.create",
        operationId,
        targetId: operationId,
        chapterId,
        displayOrder: 0,
        baselineHash: null,
        language: "en",
        dependencies: [],
        payload: {
          lessonType: "content",
          title: "Asset lesson",
          description:
            '<p>Review the image.</p><img data-authoring-asset-id="asset-1" alt="proof">',
        },
      },
    ];
    test.input.assetMappings = {
      "asset-1": `${chapterId}/asset.png`,
      "unselected-asset": `${chapterId}/unused.png`,
    };
    test.input.assetMimeTypes = {
      "asset-1": "image/png",
      "unselected-asset": "image/png",
    };

    await test.service.applyPreparedExport(test.input, actor);

    expect(test.createLessonForChapter).toHaveBeenCalledWith(
      { chapterId, type: "content", title: "Asset lesson", description: "" },
      actor,
    );
    expect(test.createLessonForChapter.mock.invocationCallOrder[0]).toBeLessThan(
      test.createLessonResources.mock.invocationCallOrder[0],
    );
    expect(test.createLessonResources).toHaveBeenCalledTimes(1);
    expect(test.createLessonResources).toHaveBeenCalledWith(operationId, [
      expect.objectContaining({
        reference: `${chapterId}/asset.png`,
        contentType: "image/png",
      }),
    ]);
    expect(test.updateLesson).toHaveBeenCalledWith(
      operationId,
      expect.objectContaining({
        language: "en",
        description: expect.stringContaining(`/api/lesson/lesson-resource/${lessonId}`),
      }),
      actor,
    );
    const savedDescription = test.updateLesson.mock.calls[0][1].description as string;
    const $ = loadHtml(savedDescription);
    const savedImage = $('div[data-node-type="image"]');

    expect($('img[data-authoring-asset-id="asset-1"]')).toHaveLength(0);
    expect(savedImage).toHaveLength(1);
    expect(savedImage.attr("data-src")).toBe(`/api/lesson/lesson-resource/${lessonId}`);
    expect(savedImage.attr("data-resource-id")).toBe(lessonId);
    expect(validate(savedImage.attr("data-authoring-block-id") ?? "")).toBe(true);
  });

  it("applies an exported zero-hour quiz cooldown as no native cooldown", async () => {
    const test = setup();
    const fixture = JSON.parse(
      readFileSync(
        resolve(__dirname, "../../../../docs/contracts/course-authoring/quiz-operation.json"),
        "utf8",
      ),
    ) as AuthoringOperation;
    if (fixture.type !== "lesson.update" || fixture.payload.lessonType !== "quiz")
      throw new Error("Quiz fixture expected");
    test.input.operations = [
      {
        ...fixture,
        type: "lesson.create",
        operationId,
        targetId: operationId,
        chapterId,
        displayOrder: 0,
        baselineHash: null,
        payload: {
          ...fixture.payload,
          attemptsLimit: 3,
          quizCooldownInHours: 0,
          questions: fixture.payload.questions.map((question) => ({
            ...question,
            photoS3Key: null,
          })),
        },
      },
    ];

    await test.service.applyPreparedExport(test.input, actor);

    expect(test.saveQuizFromAuthoring).toHaveBeenCalledWith(
      expect.objectContaining({ attemptsLimit: 3, quizCooldownInHours: null }),
      actor,
      undefined,
    );
  });

  it("attaches prepared course context to the saved Mentor and replaces generated context links", async () => {
    const test = setup();
    const generatedMentorOperation: AuthoringOperation = {
      type: "lesson.create",
      operationId,
      targetId: operationId,
      chapterId,
      displayOrder: 0,
      baselineHash: null,
      language: "en",
      dependencies: [],
      payload: {
        lessonType: "ai_mentor",
        title: "Course coach",
        description: "Practice the course skills.",
        name: "Course coach",
        configurationType: "teacher",
        configuration: {
          taskGoal: "Apply course skills.",
          openingInstruction: null,
          additionalInstructions: null,
          expertise: "Course content",
          contentScope: "The current course",
          teachingStyle: "guided_discovery",
          feedbackGuidance: null,
        },
        judgeConfiguration: {
          taskGoal: "Assess application of course skills.",
          passingThresholdPercent: 70,
          criteria: [
            {
              ref: "C1",
              title: "Applies the material",
              expectedBehavior: "Uses the course lesson content.",
              maxScore: 5,
              scoreGuidance: [
                { score: 5, description: "Applies the lesson accurately.", example: null },
              ],
            },
          ],
          blockingErrors: [],
        },
        sourceVersionIds: [],
        avatarAssetId: null,
        preparedResourceIds: [],
      },
    };
    const preparedContextId = "00000000-0000-4000-8000-000000000005";
    test.input.operations = [generatedMentorOperation];
    test.input.preparedDocumentIds = { [`${operationId}:course-context`]: [preparedContextId] };

    await test.service.applyPreparedExport(test.input, actor);

    expect(test.createAiMentorLesson).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Course coach" }),
      actor,
    );
    expect(test.replaceCourseAuthoringMentorContext).toHaveBeenCalledWith(
      [preparedContextId],
      chapterId,
      actor.tenantId,
    );
  });

  it("keeps per-source preparation required when no targeted context was prepared", async () => {
    const test = setup();
    test.input.operations = [createMentorOperation([sourceVersionId])];

    await expect(test.service.applyPreparedExport(test.input, actor)).rejects.toThrow(
      "courseAuthoring.errors.mentorPreparationRequired",
    );

    expect(test.createAiMentorLesson).not.toHaveBeenCalled();
    expect(test.assignDocumentToAiMentorLesson).not.toHaveBeenCalled();
  });

  it("attaches a prepared targeted context once and skips raw source assignments", async () => {
    const test = setup();
    const targetedContextId = "00000000-0000-4000-8000-000000000007";
    const courseContextId = "00000000-0000-4000-8000-000000000008";
    test.input.operations = [createMentorOperation([sourceVersionId])];
    test.input.preparedDocumentIds = {
      [mentorTargetedContextKey(operationId)]: [targetedContextId, targetedContextId],
      [mentorCourseContextKey(operationId)]: [courseContextId, targetedContextId],
    };

    await test.service.applyPreparedExport(test.input, actor);

    expect(test.assignDocumentToAiMentorLesson).not.toHaveBeenCalled();
    expect(test.replaceCourseAuthoringMentorContext).toHaveBeenCalledWith(
      [targetedContextId, courseContextId],
      chapterId,
      actor.tenantId,
    );
  });

  it("preserves legacy source attachments while clearing replaced generated context", async () => {
    const test = setup();
    const sourceDocumentId = "00000000-0000-4000-8000-000000000009";
    test.input.operations = [createMentorOperation([sourceVersionId])];
    test.input.preparedDocumentIds = {
      [`${operationId}:${sourceVersionId}`]: [sourceDocumentId],
    };

    await test.service.applyPreparedExport(test.input, actor);

    expect(test.assignDocumentToAiMentorLesson).toHaveBeenCalledWith(sourceDocumentId, chapterId);
    expect(test.replaceCourseAuthoringMentorContext).toHaveBeenCalledWith(
      [],
      chapterId,
      actor.tenantId,
    );
  });
});
