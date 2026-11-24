import {
  AI_MENTOR_TTS_PRESET,
  AI_MENTOR_TYPE,
  AI_MENTOR_VOICE_MODE,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiJudgeConfigurations,
  aiMentorConfigurations,
  aiMentorLessons,
  chapters,
  courses,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createAiMentorThreadFactory } from "../../../test/factory/ai-mentor-thread.factory";
import {
  LESSON_TABLES,
  createCacheManagerMock,
  createFileServiceMock,
  createLessonHelpers,
  resetCacheManagerMock,
  resetFileServiceMock,
} from "../../../test/helpers/lesson";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  AI_MENTOR_LESSON_BODY,
  DISCOVERY_JUDGE_CONFIGURATION,
  ENGLISH_INSTRUCTIONS,
  JUDGE_CONFIGURATION_READERS,
  JUDGE_CONFIGURATION_REJECTION_CASES,
  POLISH_DISCOVERY_TRANSLATION,
  POLISH_INSTRUCTIONS,
  POLISH_TEACHER_CONFIGURATION,
  SALES_JUDGE_CONFIGURATION,
} from "./lesson-ai-mentor.scenarios";

import type { JudgeConfigurationReader } from "./lesson-ai-mentor.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

const COURSE_THUMBNAIL_REFERENCE = "course/thumbnail.png";

const fileServiceMock = createFileServiceMock();
const cacheManagerMock = createCacheManagerMock();

type CourseLessonWithAiMentor = { id: UUIDType; aiMentor: unknown };

describe("AI mentor lessons (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createLessonHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: FileService, useValue: fileServiceMock },
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createLessonHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, LESSON_TABLES);
    resetFileServiceMock(fileServiceMock);
    resetCacheManagerMock(cacheManagerMock);
    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, LESSON_TABLES);
  });

  const arrangeAdminChapter = async (
    availableLocales: SupportedLanguages[] = [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
  ) => {
    const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const course = await helpers.arrangeCourse({
      authorId: admin.user.id,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales,
      thumbnailS3Key: COURSE_THUMBNAIL_REFERENCE,
    });
    const chapter = await helpers.arrangeChapter(course.id, { authorId: admin.user.id });

    return { admin, courseId: course.id, chapterId: chapter.id };
  };

  const createAiMentorLesson = (admin: SignedInUser, body: object, expectedStatus = 201) =>
    request(app.getHttpServer())
      .post("/api/lesson/beta-create-lesson/ai")
      .set("Cookie", admin.cookies)
      .send(body)
      .expect(expectedStatus);

  const arrangeAiMentorLesson = async (availableLocales?: SupportedLanguages[]) => {
    const { admin, courseId, chapterId } = await arrangeAdminChapter(availableLocales);
    const response = await createAiMentorLesson(admin, { ...AI_MENTOR_LESSON_BODY, chapterId });

    return { admin, courseId, chapterId, lessonId: response.body.data.id as UUIDType };
  };

  const updateAiMentorLesson = (
    admin: SignedInUser,
    lessonId: UUIDType,
    body: object,
    expectedStatus = 200,
  ) =>
    request(app.getHttpServer())
      .patch("/api/lesson/beta-update-lesson/ai")
      .query({ id: lessonId })
      .set("Cookie", admin.cookies)
      .send(body)
      .expect(expectedStatus);

  const translateTeacherConfiguration = (admin: SignedInUser, lessonId: UUIDType) =>
    request(app.getHttpServer())
      .patch(
        `/api/lesson/${lessonId}/ai-mentor-configuration/translations/${SUPPORTED_LANGUAGES.PL}`,
      )
      .set("Cookie", admin.cookies)
      .send(POLISH_TEACHER_CONFIGURATION)
      .expect(200);

  const getJudgeConfiguration = (
    lessonId: UUIDType,
    reader: SignedInUser | undefined,
    expectedStatus = 200,
  ) => {
    const judgeRequest = request(app.getHttpServer()).get(
      `/api/lesson/${lessonId}/ai-judge-configuration`,
    );

    return (reader ? judgeRequest.set("Cookie", reader.cookies) : judgeRequest).expect(
      expectedStatus,
    );
  };

  const translateJudgeConfiguration = (
    admin: SignedInUser,
    lessonId: UUIDType,
    language: SupportedLanguages,
    body: object,
    expectedStatus = 200,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/lesson/${lessonId}/ai-judge-configuration/translations/${language}`)
      .set("Cookie", admin.cookies)
      .send(body)
      .expect(expectedStatus);

  const getMentorConfiguration = async (
    admin: SignedInUser,
    lessonId: UUIDType,
    language: SupportedLanguages,
  ) => {
    const response = await request(app.getHttpServer())
      .get(`/api/lesson/${lessonId}/ai-mentor-configuration`)
      .query({ language })
      .set("Cookie", admin.cookies)
      .expect(200);

    return response.body.data;
  };

  const getAiMentorFromCourse = async (
    admin: SignedInUser,
    courseId: UUIDType,
    lessonId: UUIDType,
    language: SupportedLanguages,
  ) => {
    const response = await request(app.getHttpServer())
      .get("/api/course/beta-course-by-id")
      .query({ id: courseId, language })
      .set("Cookie", admin.cookies)
      .expect(200);
    const courseLessons: CourseLessonWithAiMentor[] = response.body.data.chapters.flatMap(
      (chapter: { lessons: CourseLessonWithAiMentor[] }) => chapter.lessons,
    );

    return courseLessons.find(({ id }) => id === lessonId)?.aiMentor;
  };

  const hasMissingTranslations = async (admin: SignedInUser, courseId: UUIDType) => {
    const response = await request(app.getHttpServer())
      .get("/api/course/beta-course-missing-translations")
      .query({ id: courseId, language: SUPPORTED_LANGUAGES.PL })
      .set("Cookie", admin.cookies)
      .expect(200);

    return response.body.data.hasMissingTranslations;
  };

  const findAiMentorLesson = (lessonId: UUIDType) =>
    runInTenant(async () => {
      const [aiMentorLesson] = await db
        .select()
        .from(aiMentorLessons)
        .where(eq(aiMentorLessons.lessonId, lessonId));

      return aiMentorLesson;
    });

  describe("POST /api/lesson/beta-create-lesson/ai", () => {
    it("creates the lesson together with its Judge configuration", async () => {
      const { admin, chapterId } = await arrangeAdminChapter();
      const { name: _defaultedName, ...bodyWithoutMentorName } = AI_MENTOR_LESSON_BODY;

      const created = await createAiMentorLesson(admin, {
        ...bodyWithoutMentorName,
        chapterId,
        aiJudgeConfiguration: SALES_JUDGE_CONFIGURATION,
      });
      const response = await getJudgeConfiguration(created.body.data.id, admin);

      expect(response.body.data).toMatchObject({
        taskGoal: SALES_JUDGE_CONFIGURATION.taskGoal,
        passingThresholdPercent: 70,
        totalMaxScore: 3,
        language: SUPPORTED_LANGUAGES.EN,
        criteria: [{ title: "Discovery" }, { title: "Response" }, { title: "Next step" }],
        blockingErrors: SALES_JUDGE_CONFIGURATION.blockingErrors,
      });
      expect(await findAiMentorLesson(created.body.data.id)).toMatchObject({
        name: { en: "AI Mentor" },
      });
    });

    it("rejects a lesson without a Judge configuration", async () => {
      const { admin, chapterId } = await arrangeAdminChapter();
      const { aiJudgeConfiguration: _omitted, ...bodyWithoutJudge } = AI_MENTOR_LESSON_BODY;

      await createAiMentorLesson(admin, { ...bodyWithoutJudge, chapterId }, 400);
    });
  });

  describe("GET /api/lesson/:id/ai-judge-configuration", () => {
    const arrangeReader = (reader: JudgeConfigurationReader) =>
      match(reader)
        .with(JUDGE_CONFIGURATION_READERS.ANONYMOUS, async () => undefined)
        .with(JUDGE_CONFIGURATION_READERS.STUDENT, () => helpers.arrangeSignedInStudent())
        .exhaustive();

    it("falls back to the base language for a language the course does not offer", async () => {
      const { admin, lessonId } = await arrangeAiMentorLesson();

      const response = await request(app.getHttpServer())
        .get(`/api/lesson/${lessonId}/ai-judge-configuration`)
        .query({ language: SUPPORTED_LANGUAGES.DE })
        .set("Cookie", admin.cookies)
        .expect(200);

      expect(response.body.data).toMatchObject({ language: SUPPORTED_LANGUAGES.EN });
    });

    it.each(JUDGE_CONFIGURATION_REJECTION_CASES)(
      "rejects $reader with $expectedStatus",
      async ({ reader, expectedStatus }) => {
        const { lessonId } = await arrangeAiMentorLesson();

        await getJudgeConfiguration(lessonId, await arrangeReader(reader), expectedStatus);
      },
    );
  });

  describe("PATCH /api/lesson/:id/ai-judge-configuration/translations/:language", () => {
    const arrangeDiscoveryJudge = async () => {
      const { admin, lessonId } = await arrangeAiMentorLesson();

      await request(app.getHttpServer())
        .put(`/api/lesson/${lessonId}/ai-judge-configuration`)
        .set("Cookie", admin.cookies)
        .send(DISCOVERY_JUDGE_CONFIGURATION)
        .expect(200);
      const englishResponse = await getJudgeConfiguration(lessonId, admin);
      const [criterion] = englishResponse.body.data.criteria;
      const [zeroScoreGuidance, fullScoreGuidance] = criterion.scoreGuidance;
      const [blockingError] = englishResponse.body.data.blockingErrors;

      return { admin, lessonId, criterion, zeroScoreGuidance, fullScoreGuidance, blockingError };
    };

    it("translates the text while keeping the base-language structure", async () => {
      const { admin, lessonId, criterion, zeroScoreGuidance, fullScoreGuidance, blockingError } =
        await arrangeDiscoveryJudge();
      const translation = POLISH_DISCOVERY_TRANSLATION;

      const response = await translateJudgeConfiguration(admin, lessonId, SUPPORTED_LANGUAGES.PL, {
        taskGoal: translation.taskGoal,
        criteria: [{ id: criterion.id, ...translation.criterion }],
        scoreGuidance: [
          { id: zeroScoreGuidance.id, ...translation.zeroScoreGuidance },
          { id: fullScoreGuidance.id, ...translation.fullScoreGuidance },
        ],
        blockingErrors: [{ id: blockingError.id, ...translation.blockingError }],
      });

      expect(response.body.data).toMatchObject({
        taskGoal: translation.taskGoal,
        passingThresholdPercent: 50,
        totalMaxScore: 1,
        language: SUPPORTED_LANGUAGES.PL,
        criteria: [
          {
            id: criterion.id,
            ...translation.criterion,
            maxScore: 1,
            scoreGuidance: [
              { id: zeroScoreGuidance.id, score: 0, ...translation.zeroScoreGuidance },
              { id: fullScoreGuidance.id, score: 1, ...translation.fullScoreGuidance },
            ],
          },
        ],
        blockingErrors: [{ id: blockingError.id, ...translation.blockingError }],
      });
      expect((await getJudgeConfiguration(lessonId, admin)).body.data).toMatchObject({
        taskGoal: DISCOVERY_JUDGE_CONFIGURATION.taskGoal,
        passingThresholdPercent: 50,
        criteria: [
          {
            title: "Discovery",
            expectedBehavior: "Asks at least one relevant discovery question",
          },
        ],
        blockingErrors: DISCOVERY_JUDGE_CONFIGURATION.blockingErrors,
      });
    });

    it("rejects translating into the base language", async () => {
      const { admin, lessonId } = await arrangeDiscoveryJudge();

      const response = await translateJudgeConfiguration(
        admin,
        lessonId,
        SUPPORTED_LANGUAGES.EN,
        { taskGoal: "A different goal" },
        400,
      );

      expect(response.body).toMatchObject({
        message: "aiJudgeConfiguration.errors.translationRequiresNonBaseLanguage",
      });
    });

    it("rejects structural changes in a translation", async () => {
      const { admin, lessonId } = await arrangeDiscoveryJudge();

      await translateJudgeConfiguration(
        admin,
        lessonId,
        SUPPORTED_LANGUAGES.PL,
        { passingThresholdPercent: 80 },
        400,
      );
    });
  });

  describe("PATCH /api/lesson/beta-update-lesson/ai", () => {
    it("updates only the selected language and returns localized mentor settings", async () => {
      const { admin, courseId, lessonId } = await arrangeAiMentorLesson();
      const voiceSettings = {
        voiceMode: AI_MENTOR_VOICE_MODE.CUSTOM,
        ttsPreset: AI_MENTOR_TTS_PRESET.MALE,
      };

      await updateAiMentorLesson(admin, lessonId, {
        title: "Negotiation practice",
        description: "<p>Practice a sales call.</p>",
        aiMentorInstructions: ENGLISH_INSTRUCTIONS,
        type: AI_MENTOR_TYPE.TEACHER,
        name: "AI Mentor",
        ...voiceSettings,
        customTtsReference: "voice-reference-en",
        language: SUPPORTED_LANGUAGES.EN,
      });
      await updateAiMentorLesson(admin, lessonId, {
        title: "Polish negotiation practice",
        description: "<p>Practice a Polish sales call.</p>",
        name: "Mentor PL",
        ...voiceSettings,
        customTtsReference: "voice-reference-pl",
        language: SUPPORTED_LANGUAGES.PL,
      });
      await translateTeacherConfiguration(admin, lessonId);

      expect(await findAiMentorLesson(lessonId)).toMatchObject({
        customTtsReference: { en: "voice-reference-en", pl: "voice-reference-pl" },
      });
      expect(
        await getAiMentorFromCourse(admin, courseId, lessonId, SUPPORTED_LANGUAGES.EN),
      ).toMatchObject({ name: "AI Mentor", customTtsReference: "voice-reference-en" });
      expect(
        await getAiMentorFromCourse(admin, courseId, lessonId, SUPPORTED_LANGUAGES.PL),
      ).toMatchObject({ name: "Mentor PL", customTtsReference: "voice-reference-pl" });
      expect(await getMentorConfiguration(admin, lessonId, SUPPORTED_LANGUAGES.EN)).toMatchObject({
        additionalInstructions: ENGLISH_INSTRUCTIONS,
      });
      expect(await getMentorConfiguration(admin, lessonId, SUPPORTED_LANGUAGES.PL)).toMatchObject({
        additionalInstructions: POLISH_INSTRUCTIONS,
      });
    });

    it("rejects a language the course does not offer", async () => {
      const { admin, lessonId } = await arrangeAiMentorLesson();

      const response = await updateAiMentorLesson(
        admin,
        lessonId,
        {
          title: "German negotiation practice",
          description: "<p>Practice a German sales call.</p>",
          name: "AI Mentor",
          language: SUPPORTED_LANGUAGES.DE,
        },
        400,
      );

      expect(response.body).toMatchObject({
        message: "adminCourseView.toast.languageNotSupported",
      });
    });
  });

  describe("GET /api/lesson/:id", () => {
    it("falls back to the base-language mentor for a learner in an untranslated language", async () => {
      const { admin, lessonId } = await arrangeAiMentorLesson([
        SUPPORTED_LANGUAGES.EN,
        SUPPORTED_LANGUAGES.DE,
      ]);
      const aiMentorLesson = await findAiMentorLesson(lessonId);
      const thread = await runInTenant(() =>
        createAiMentorThreadFactory(db).withMentorMessage("Welcome to the lesson").create({
          userId: admin.user.id,
          aiMentorLessonId: aiMentorLesson.id,
          userLanguage: SUPPORTED_LANGUAGES.DE,
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/api/lesson/${lessonId}`)
        .query({ language: SUPPORTED_LANGUAGES.DE })
        .set("Cookie", admin.cookies)
        .expect(200);

      expect(response.body.data).toMatchObject({
        threadId: thread.id,
        aiMentor: { name: "AI Mentor" },
      });
    });
  });

  describe("GET /api/course/beta-course-missing-translations", () => {
    it("reports a missing translation while only the mentor name is untranslated", async () => {
      const { admin, chapterId, courseId, lessonId } = await arrangeAiMentorLesson();
      const aiMentorLesson = await findAiMentorLesson(lessonId);
      await runInTenant(async () => {
        await db
          .update(aiJudgeConfigurations)
          .set({
            taskGoal: setJsonbField(
              aiJudgeConfigurations.taskGoal,
              SUPPORTED_LANGUAGES.PL,
              "Complete the negotiation practice",
            ),
          })
          .where(eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLesson.id));
        await db
          .update(courses)
          .set({
            title: setJsonbField(courses.title, SUPPORTED_LANGUAGES.PL, "Polish course"),
            description: setJsonbField(
              courses.description,
              SUPPORTED_LANGUAGES.PL,
              "Polish course description",
            ),
          })
          .where(eq(courses.id, courseId));
        await db
          .update(chapters)
          .set({ title: setJsonbField(chapters.title, SUPPORTED_LANGUAGES.PL, "Polish chapter") })
          .where(eq(chapters.id, chapterId));
      });
      await updateAiMentorLesson(admin, lessonId, {
        title: "Polish negotiation practice",
        description: "<p>Practice a Polish sales call.</p>",
        language: SUPPORTED_LANGUAGES.PL,
      });
      await translateTeacherConfiguration(admin, lessonId);

      expect(await hasMissingTranslations(admin, courseId)).toBe(true);

      await runInTenant(() =>
        db
          .update(aiMentorLessons)
          .set({ name: setJsonbField(aiMentorLessons.name, SUPPORTED_LANGUAGES.PL, "Mentor PL") })
          .where(eq(aiMentorLessons.lessonId, lessonId)),
      );

      expect(await hasMissingTranslations(admin, courseId)).toBe(false);
    });
  });

  describe("DELETE /api/course/language/:courseId", () => {
    it("removes the localized mentor fields of the deleted language", async () => {
      const { admin, courseId, lessonId } = await arrangeAiMentorLesson();
      await updateAiMentorLesson(admin, lessonId, {
        title: "Polish negotiation practice",
        description: "<p>Practice a Polish sales call.</p>",
        name: "Mentor PL",
        language: SUPPORTED_LANGUAGES.PL,
      });
      await translateTeacherConfiguration(admin, lessonId);

      await request(app.getHttpServer())
        .delete(`/api/course/language/${courseId}`)
        .query({ language: SUPPORTED_LANGUAGES.PL })
        .set("Cookie", admin.cookies)
        .expect(200);

      const aiMentorLesson = await findAiMentorLesson(lessonId);
      const [configuration] = await runInTenant(() =>
        db
          .select({ additionalInstructions: aiMentorConfigurations.additionalInstructions })
          .from(aiMentorConfigurations)
          .where(eq(aiMentorConfigurations.aiMentorLessonId, aiMentorLesson.id)),
      );

      expect(aiMentorLesson.name).toEqual({ en: "AI Mentor" });
      expect(configuration.additionalInstructions).toEqual({ en: ENGLISH_INSTRUCTIONS });
    });
  });
});
