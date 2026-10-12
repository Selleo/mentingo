import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { eq } from "drizzle-orm";

import { CourseAuthoringApplyService } from "src/luma/course-authoring-apply.service";
import { CourseAuthoringContextService } from "src/luma/course-authoring-context.service";
import { authoringOperationSchema } from "src/luma/schema/course-authoring-operations.schema";
import * as outboxConstants from "src/outbox/outbox.constants";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB, DB_APP } from "src/storage/db/db.providers";
import { createTenantAwareDb } from "src/storage/db/tenant-aware-session";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import {
  aiJudgeConfigurations,
  aiMentorConfigurations,
  aiMentorLessons,
  assessments,
  assessmentQuestions,
  chapters,
  courseAuthoringApplications,
  lessons,
  outboxEvents,
  resourceEntity,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { PreparedCourseAuthoringApplication } from "src/luma/course-authoring.types";
import type { AuthoringOperation } from "src/luma/schema/course-authoring-operations.schema";

const enabled = Boolean(process.env.AUTHORING_TEST_DATABASE_URL);
(enabled ? describe : describe.skip)("course authoring native lesson and quiz apply", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let runner: TenantDbRunnerService;
  let actor: CurrentUserType;
  let apply: CourseAuthoringApplyService;
  let courseId: string;
  let chapterId: string;
  let quizFixture: AuthoringOperation;

  beforeAll(async () => {
    const url = process.env.AUTHORING_TEST_DATABASE_URL;
    if (
      !url ||
      !/^\/authoring_probe_[a-f0-9]+$/.test(new URL(url).pathname) ||
      process.env.DATABASE_TEST_URL !== url
    )
      throw new Error("Explicit matching authoring_probe_<hex> scratch database URLs required");
    const test = await createE2ETest([
      {
        provide: DB,
        useFactory: (base: DatabasePg, tenantRunner: TenantDbRunnerService) =>
          createTenantAwareDb(base, tenantRunner),
        inject: [DB_APP, TenantDbRunnerService],
      },
    ]);
    app = test.app;
    db = app.get(DB);
    runner = app.get(TenantDbRunnerService);
    apply = app.get(CourseAuthoringApplyService);
    const publisher = app.get(OutboxPublisher);
    // The Jest profile suppresses the dispatcher. Keep real durable persistence
    // for native domain calls without delivering background effects during assertions.
    jest
      .spyOn(publisher, "publish")
      .mockImplementation((event, transaction) =>
        publisher.publishDurable(event, transaction ?? db),
      );
    jest.spyOn(outboxConstants, "isOutboxProcessingEnabled").mockReturnValue(true);
    await runner.runWithTenant(test.defaultTenantId, async () => {
      await createSettingsFactory(db).create();
      const user = await createUserFactory(db).withAdminRole().create();
      actor = {
        userId: user.id,
        tenantId: test.defaultTenantId,
        email: user.email,
        permissions: SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.ADMIN],
        roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      };
      const course = await createCourseFactory(db).create({ authorId: user.id });
      courseId = course.id;
      chapterId = (
        await createChapterFactory(db).create({
          courseId,
          authorId: user.id,
          lessonCount: 0,
          displayOrder: 1,
        })
      ).id;
    });
    const raw: unknown = JSON.parse(
      await readFile(
        resolve(__dirname, "../../../../../docs/contracts/course-authoring/quiz-operation.json"),
        "utf8",
      ),
    );
    if (!Value.Check(authoringOperationSchema, raw))
      throw new Error("Invalid producer quiz fixture");
    quizFixture = raw;
  }, 120000);

  afterAll(async () => {
    jest.restoreAllMocks();
    if (app) await app.close();
  });

  function input(validQuiz: boolean): PreparedCourseAuthoringApplication {
    if (quizFixture.type !== "lesson.update" || quizFixture.payload.lessonType !== "quiz")
      throw new Error("Quiz fixture expected");
    const content: AuthoringOperation = {
      type: "lesson.create",
      operationId: randomUUID(),
      targetId: randomUUID(),
      chapterId,
      language: "en",
      baselineHash: null,
      dependencies: [],
      displayOrder: 0,
      payload: {
        lessonType: "content",
        title: "Source inspection",
        description:
          '<h2>Inspect the sender</h2><p>Compare the destination before opening a link.</p><img data-authoring-asset-id="lesson-image" alt="A message preview">',
      },
    };
    const quiz: AuthoringOperation = {
      type: "lesson.create",
      operationId: randomUUID(),
      targetId: randomUUID(),
      chapterId,
      language: "en",
      baselineHash: null,
      dependencies: [content.operationId],
      displayOrder: 1,
      payload: {
        ...quizFixture.payload,
        questions: quizFixture.payload.questions.map((question, index) => ({
          ...question,
          photoS3Key: question.photoS3Key ? "authoring-asset:quiz-image" : null,
          options: question.options.map((option) => ({
            ...option,
            isCorrect: validQuiz || index !== 0 ? option.isCorrect : false,
          })),
        })),
      },
    };
    const mentor: AuthoringOperation = {
      type: "lesson.create",
      operationId: randomUUID(),
      targetId: randomUUID(),
      chapterId,
      language: "en",
      baselineHash: null,
      dependencies: [],
      displayOrder: 2,
      payload: {
        lessonType: "ai_mentor",
        title: "Practice verification",
        description: "Practice assessing an unexpected request.",
        name: "Practice coach",
        configurationType: "teacher",
        configuration: {
          taskGoal: "Explain safe verification.",
          expertise: "Security awareness",
          contentScope: "Phishing requests",
          teachingStyle: "guided_discovery",
          feedbackGuidance: null,
          openingInstruction: null,
          additionalInstructions: null,
        },
        judgeConfiguration: {
          taskGoal: "Assess safe verification.",
          passingThresholdPercent: 70,
          criteria: [
            {
              ref: "C1",
              title: "Verifies the request",
              expectedBehavior: "Checks the sender and destination.",
              maxScore: 5,
              scoreGuidance: [{ score: 5, description: "Verifies both details.", example: null }],
            },
          ],
          blockingErrors: [{ ref: "B1", description: "Shares credentials." }],
        },
        sourceVersionIds: [],
        avatarAssetId: "mentor-avatar",
        voiceMode: "preset",
        ttsPreset: "female",
        customTtsReference: null,
        preparedResourceIds: [],
      },
    };
    return {
      courseId,
      sessionId: randomUUID(),
      exportId: randomUUID(),
      exportHash: "a".repeat(64),
      operations: [content, quiz, mentor],
      assetMappings: {
        "quiz-image": `${actor.tenantId}/course-authoring/quiz-image.png`,
        "mentor-avatar": `${actor.tenantId}/course-authoring/mentor-avatar.png`,
        "lesson-image": `${actor.tenantId}/course-authoring/lesson-image.png`,
      },
      assetMimeTypes: {
        "quiz-image": "image/png",
        "mentor-avatar": "image/png",
        "lesson-image": "image/png",
      },
      preparedDocumentIds: {},
    };
  }

  it("rolls back real content, resource/search effects, chapter counts and durable events when a later quiz is invalid", async () => {
    const prepared = input(false);
    await runner.runWithTenant(actor.tenantId, async () => {
      const eventsBefore = await db.select({ id: outboxEvents.id }).from(outboxEvents);
      await expect(apply.applyPreparedExport(prepared, actor)).rejects.toThrow();
      expect(await db.select().from(lessons).where(eq(lessons.chapterId, chapterId))).toHaveLength(
        0,
      );
      expect(await db.select().from(assessments)).toHaveLength(0);
      expect(await db.select().from(courseAuthoringApplications)).toHaveLength(0);
      expect(await db.select({ id: outboxEvents.id }).from(outboxEvents)).toHaveLength(
        eventsBefore.length,
      );
      expect(
        (await db.select().from(chapters).where(eq(chapters.id, chapterId)))[0].lessonCount,
      ).toBe(0);
    });
  });

  it("persists canonical quiz children, stable content blocks and exact ordering through native services, then deduplicates retry", async () => {
    const prepared = input(true);
    await runner.runWithTenant(actor.tenantId, async () => {
      const result = await apply.applyPreparedExport(prepared, actor);
      const stored = await db
        .select()
        .from(lessons)
        .where(eq(lessons.chapterId, chapterId))
        .orderBy(lessons.displayOrder);
      expect(stored.map((lesson) => lesson.type)).toEqual(["content", "quiz", "ai_mentor"]);
      expect(stored.map((lesson) => lesson.displayOrder)).toEqual([1, 2, 3]);
      expect(stored[0]?.description?.en ?? "").toContain("data-authoring-block-id");
      expect(stored[0]?.description?.en ?? "").toContain("/api/lesson/lesson-resource/");
      expect(
        await db.select().from(resourceEntity).where(eq(resourceEntity.entityId, stored[0]!.id)),
      ).toHaveLength(1);
      expect(await db.select().from(assessments)).toHaveLength(1);
      expect(await db.select().from(assessmentQuestions)).toHaveLength(10);
      expect(
        (await db.select().from(chapters).where(eq(chapters.id, chapterId)))[0].lessonCount,
      ).toBe(3);
      expect(await db.select().from(aiMentorConfigurations)).toHaveLength(1);
      expect(await db.select().from(aiJudgeConfigurations)).toHaveLength(1);
      const [savedMentor] = await db
        .select({ avatarReference: aiMentorLessons.avatarReference })
        .from(aiMentorLessons);
      expect(savedMentor?.avatarReference).toBe(
        `${actor.tenantId}/course-authoring/mentor-avatar.png`,
      );
      expect(await apply.applyPreparedExport(prepared, actor)).toEqual(result);
      expect(await db.select().from(courseAuthoringApplications)).toHaveLength(1);
      expect(await db.select().from(lessons).where(eq(lessons.chapterId, chapterId))).toHaveLength(
        2,
      );
      const contextService = app.get(CourseAuthoringContextService);
      const overview = await contextService.getContext(
        courseId,
        { language: SUPPORTED_LANGUAGES.EN },
        actor,
      );
      expect(
        overview.chapters[0]?.lessons.find((lesson) => lesson.lessonType === "quiz")?.quiz,
      ).toBeUndefined();
      const chapterContext = await contextService.getContext(
        courseId,
        { language: SUPPORTED_LANGUAGES.EN },
        actor,
        [chapterId],
      );
      const quiz = chapterContext.chapters[0]?.lessons.find(
        (lesson) => lesson.lessonType === "quiz",
      )?.quiz;
      expect(quiz?.questions.map((question) => question.questionType)).toEqual([
        "single_choice",
        "multiple_choice",
        "true_or_false",
        "photo_question_single_choice",
        "photo_question_multiple_choice",
        "fill_in_the_blanks_text",
        "fill_in_the_blanks_dnd",
        "brief_response",
        "detailed_response",
        "scale_1_5",
      ]);
      expect(quiz?.questions[3]?.photoS3Key).toBe(
        `${actor.tenantId}/course-authoring/quiz-image.png`,
      );
      expect(quiz?.questions[5]?.blanks[0]?.answerSets[0]?.acceptedAnswers).toEqual([
        "verify",
        "check",
      ]);
      expect(quiz?.questions[6]?.dragAndDropOptions[0]?.targetBlankId).toBe(
        quiz?.questions[6]?.blanks[0]?.id,
      );
      expect(quiz?.questions[7]?.openTextSettings?.reviewerInstructions).toBe(
        "Check for verification before action.",
      );
      const mentor = chapterContext.chapters[0]?.lessons.find(
        (lesson) => lesson.lessonType === "ai_mentor",
      );
      expect(mentor?.mentorConfiguration?.type).toBe("teacher");
      if (mentor?.mentorConfiguration?.type === "teacher")
        expect(mentor.mentorConfiguration.taskGoal).toBe("Explain safe verification.");
      expect(mentor?.judgeConfiguration?.criteria[0]?.title).toBe("Verifies the request");
      await expect(
        contextService.getContext(courseId, { language: SUPPORTED_LANGUAGES.EN }, actor, [
          randomUUID(),
        ]),
      ).rejects.toThrow("courseAuthoring.errors.targetOutsideCourse");
    });
  });
});
