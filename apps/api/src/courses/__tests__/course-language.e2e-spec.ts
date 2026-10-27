import { COURSE_ORIGIN_TYPES, LESSON_TYPES } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
  assessmentQuestionChoiceOptions,
  assessmentQuestions,
  chapters,
  courses,
  lessons,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createConfiguredAiMentorLessonFactory } from "../../../test/factory/ai-mentor-lesson.factory";
import { createAssessmentQuestionFactory } from "../../../test/factory/assessment-question.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  COURSE_AUTHORS,
  COURSE_EDIT_ACCESS_CASES,
  COURSE_EDITORS,
} from "./course-editing.scenarios";
import {
  BASE_TEXT,
  BASE_TEXT_ONLY,
  COURSE_LANGUAGES,
  INVALID_LANGUAGE_DELETIONS,
  TRANSLATED_TEXT,
  TRANSLATED_TEXT_BY_LANGUAGE,
} from "./course-language.scenarios";

import type { CourseAuthor, CourseEditor } from "./course-editing.scenarios";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

const PASSWORD = "password123";
const COURSE_LANGUAGE_TABLES = ["users", "categories", "courses", "settings"] as const;

const s3ServiceMock = { getSignedUrl: jest.fn(), getFileExists: jest.fn() };
const cacheManagerMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

describe("Course language deletion (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let inTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let lessonFactory: ReturnType<typeof createLessonFactory>;
  let assessmentQuestionFactory: ReturnType<typeof createAssessmentQuestionFactory>;
  let aiMentorLessonFactory: ReturnType<typeof createConfiguredAiMentorLessonFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    inTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);

    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    lessonFactory = createLessonFactory(db);
    assessmentQuestionFactory = createAssessmentQuestionFactory(db);
    aiMentorLessonFactory = createConfiguredAiMentorLessonFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_LANGUAGE_TABLES]);
    restoreProviderDoubles();

    await inTenant(() => settingsFactory.create({ userId: null }));
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_LANGUAGE_TABLES]);
  });

  const restoreProviderDoubles = () => {
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());

    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `https://storage.example.com/${key}`,
    );
    s3ServiceMock.getFileExists.mockResolvedValue(true);
    cacheManagerMock.get.mockResolvedValue(undefined);
    cacheManagerMock.set.mockResolvedValue(undefined);
    cacheManagerMock.del.mockResolvedValue(undefined);
  };

  const arrangeEditor = (editor: CourseEditor): Promise<UserWithCredentials> =>
    inTenant(() =>
      match(editor)
        .with(COURSE_EDITORS.ADMIN, () =>
          userFactory.withCredentials({ password: PASSWORD }).withAdminSettings(db).create(),
        )
        .with(COURSE_EDITORS.CONTENT_CREATOR, () =>
          userFactory
            .withCredentials({ password: PASSWORD })
            .withContentCreatorSettings(db)
            .create(),
        )
        .with(COURSE_EDITORS.STUDENT, () =>
          userFactory.withCredentials({ password: PASSWORD }).withUserSettings(db).create(),
        )
        .exhaustive(),
    );

  const arrangeAuthorId = async (author: CourseAuthor, editor: UserWithCredentials) =>
    match(author)
      .with(COURSE_AUTHORS.EDITOR, async () => editor.id)
      .with(COURSE_AUTHORS.ANOTHER_USER, async () => {
        const anotherUser = await inTenant(() =>
          userFactory.withContentCreatorSettings(db).create(),
        );
        return anotherUser.id;
      })
      .exhaustive();

  const arrangeSignedInAdmin = async () => {
    const admin = await arrangeEditor(COURSE_EDITORS.ADMIN);
    return { admin, cookie: await cookieFor(admin, app) };
  };

  const arrangeBilingualCourse = (
    authorId: UUIDType,
    overrides: Parameters<typeof courseFactory.create>[0] = {},
  ) =>
    inTenant(async () => {
      const course = await courseFactory.create({
        authorId,
        thumbnailS3Key: null,
        availableLocales: [COURSE_LANGUAGES.BASE, COURSE_LANGUAGES.TRANSLATION],
        ...overrides,
      });

      await db
        .update(courses)
        .set({
          title: buildJsonbFieldWithMultipleEntries(TRANSLATED_TEXT_BY_LANGUAGE),
          description: buildJsonbFieldWithMultipleEntries(TRANSLATED_TEXT_BY_LANGUAGE),
          learningOutcomes: buildJsonbFieldWithMultipleEntries({
            [COURSE_LANGUAGES.BASE]: [BASE_TEXT],
            [COURSE_LANGUAGES.TRANSLATION]: [TRANSLATED_TEXT],
          }),
        })
        .where(eq(courses.id, course.id));

      return course;
    });

  const arrangeBilingualCourseContent = (courseId: UUIDType, authorId: UUIDType) =>
    inTenant(async () => {
      const chapter = await chapterFactory.create({ courseId, authorId });
      await db
        .update(chapters)
        .set({ title: buildJsonbFieldWithMultipleEntries(TRANSLATED_TEXT_BY_LANGUAGE) })
        .where(eq(chapters.id, chapter.id));

      const quizLesson = await lessonFactory.create({
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 50,
        title: TRANSLATED_TEXT_BY_LANGUAGE,
        description: TRANSLATED_TEXT_BY_LANGUAGE,
        displayOrder: 1,
      });
      const aiMentorLesson = await lessonFactory.create({
        chapterId: chapter.id,
        type: LESSON_TYPES.AI_MENTOR,
        title: TRANSLATED_TEXT_BY_LANGUAGE,
        description: TRANSLATED_TEXT_BY_LANGUAGE,
        displayOrder: 2,
      });

      const question = await assessmentQuestionFactory.create({
        lessonId: quizLesson.id,
        title: TRANSLATED_TEXT_BY_LANGUAGE,
        description: TRANSLATED_TEXT_BY_LANGUAGE,
        choiceOptionLabels: TRANSLATED_TEXT_BY_LANGUAGE,
      });
      const aiMentor = await aiMentorLessonFactory.create({
        lessonId: aiMentorLesson.id,
        localizedText: TRANSLATED_TEXT_BY_LANGUAGE,
      });

      return { chapter, lessonIds: [quizLesson.id, aiMentorLesson.id], question, aiMentor };
    });

  const deleteLanguage = (courseId: UUIDType, language: SupportedLanguages, cookie: string) =>
    request(app.getHttpServer())
      .delete(`/api/course/language/${courseId}`)
      .query({ language })
      .set("Cookie", cookie);

  describe("DELETE /api/course/language/:courseId", () => {
    it("removes the translation from the course and its available languages", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeBilingualCourse(admin.id);

      await deleteLanguage(course.id, COURSE_LANGUAGES.TRANSLATION, cookie).expect(200);

      const [updatedCourse] = await inTenant(() =>
        db
          .select({
            title: courses.title,
            description: courses.description,
            learningOutcomes: courses.learningOutcomes,
            baseLanguage: courses.baseLanguage,
            availableLocales: courses.availableLocales,
          })
          .from(courses)
          .where(eq(courses.id, course.id)),
      );

      expect(updatedCourse).toEqual({
        title: BASE_TEXT_ONLY,
        description: BASE_TEXT_ONLY,
        learningOutcomes: { [COURSE_LANGUAGES.BASE]: [BASE_TEXT] },
        baseLanguage: COURSE_LANGUAGES.BASE,
        availableLocales: [COURSE_LANGUAGES.BASE],
      });
    });

    it("removes the translation from chapters and lessons", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeBilingualCourse(admin.id);
      const { chapter, lessonIds } = await arrangeBilingualCourseContent(course.id, admin.id);

      await deleteLanguage(course.id, COURSE_LANGUAGES.TRANSLATION, cookie).expect(200);

      const [updatedChapter] = await inTenant(() =>
        db.select({ title: chapters.title }).from(chapters).where(eq(chapters.id, chapter.id)),
      );
      const updatedLessons = await inTenant(() =>
        db
          .select({ title: lessons.title, description: lessons.description })
          .from(lessons)
          .where(eq(lessons.chapterId, chapter.id)),
      );

      expect(updatedChapter).toEqual({ title: BASE_TEXT_ONLY });
      expect(updatedLessons).toEqual(
        lessonIds.map(() => ({ title: BASE_TEXT_ONLY, description: BASE_TEXT_ONLY })),
      );
    });

    it("removes the translation from quiz questions and drops its answer options", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeBilingualCourse(admin.id);
      const { question } = await arrangeBilingualCourseContent(course.id, admin.id);

      await deleteLanguage(course.id, COURSE_LANGUAGES.TRANSLATION, cookie).expect(200);

      const [updatedQuestion] = await inTenant(() =>
        db
          .select({
            title: assessmentQuestions.title,
            description: assessmentQuestions.description,
          })
          .from(assessmentQuestions)
          .where(eq(assessmentQuestions.id, question.id)),
      );
      const remainingOptions = await inTenant(() =>
        db
          .select({
            language: assessmentQuestionChoiceOptions.language,
            label: assessmentQuestionChoiceOptions.label,
          })
          .from(assessmentQuestionChoiceOptions)
          .where(eq(assessmentQuestionChoiceOptions.questionId, question.id)),
      );

      expect(updatedQuestion).toEqual({ title: BASE_TEXT_ONLY, description: BASE_TEXT_ONLY });
      expect(remainingOptions).toEqual([{ language: COURSE_LANGUAGES.BASE, label: BASE_TEXT }]);
    });

    it("removes the translation from AI mentor and AI judge configurations", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeBilingualCourse(admin.id);
      const { aiMentor } = await arrangeBilingualCourseContent(course.id, admin.id);

      await deleteLanguage(course.id, COURSE_LANGUAGES.TRANSLATION, cookie).expect(200);

      const aiMentorContent = await inTenant(async () => {
        const [mentor] = await db
          .select({ name: aiMentorLessons.name })
          .from(aiMentorLessons)
          .where(eq(aiMentorLessons.id, aiMentor.id));
        const [configuration] = await db
          .select({
            id: aiMentorConfigurations.id,
            openingInstruction: aiMentorConfigurations.openingInstruction,
            additionalInstructions: aiMentorConfigurations.additionalInstructions,
          })
          .from(aiMentorConfigurations)
          .where(eq(aiMentorConfigurations.aiMentorLessonId, aiMentor.id));
        const [teacher] = await db
          .select({
            taskGoal: aiMentorTeacherConfigurations.taskGoal,
            expertise: aiMentorTeacherConfigurations.expertise,
            contentScope: aiMentorTeacherConfigurations.contentScope,
            feedbackGuidance: aiMentorTeacherConfigurations.feedbackGuidance,
          })
          .from(aiMentorTeacherConfigurations)
          .where(eq(aiMentorTeacherConfigurations.configurationId, configuration.id));
        const [roleplay] = await db
          .select({
            scenario: aiMentorRoleplayConfigurations.scenario,
            aiRole: aiMentorRoleplayConfigurations.aiRole,
            learnerRole: aiMentorRoleplayConfigurations.learnerRole,
            characterGoal: aiMentorRoleplayConfigurations.characterGoal,
            factsAndConstraints: aiMentorRoleplayConfigurations.factsAndConstraints,
          })
          .from(aiMentorRoleplayConfigurations)
          .where(eq(aiMentorRoleplayConfigurations.configurationId, configuration.id));
        const [judge] = await db
          .select({ id: aiJudgeConfigurations.id, taskGoal: aiJudgeConfigurations.taskGoal })
          .from(aiJudgeConfigurations)
          .where(eq(aiJudgeConfigurations.aiMentorLessonId, aiMentor.id));
        const [criterion] = await db
          .select({
            id: aiJudgeCriteria.id,
            title: aiJudgeCriteria.title,
            expectedBehavior: aiJudgeCriteria.expectedBehavior,
          })
          .from(aiJudgeCriteria)
          .where(eq(aiJudgeCriteria.configurationId, judge.id));
        const [scoreGuidance] = await db
          .select({
            description: aiJudgeScoreGuidance.description,
            example: aiJudgeScoreGuidance.example,
          })
          .from(aiJudgeScoreGuidance)
          .where(eq(aiJudgeScoreGuidance.criterionId, criterion.id));
        const [blockingError] = await db
          .select({ description: aiJudgeBlockingErrors.description })
          .from(aiJudgeBlockingErrors)
          .where(eq(aiJudgeBlockingErrors.configurationId, judge.id));

        return {
          mentor,
          configuration: {
            openingInstruction: configuration.openingInstruction,
            additionalInstructions: configuration.additionalInstructions,
          },
          teacher,
          roleplay,
          judge: { taskGoal: judge.taskGoal },
          criterion: { title: criterion.title, expectedBehavior: criterion.expectedBehavior },
          scoreGuidance,
          blockingError,
        };
      });

      expect(aiMentorContent).toEqual({
        mentor: { name: BASE_TEXT_ONLY },
        configuration: {
          openingInstruction: BASE_TEXT_ONLY,
          additionalInstructions: BASE_TEXT_ONLY,
        },
        teacher: {
          taskGoal: BASE_TEXT_ONLY,
          expertise: BASE_TEXT_ONLY,
          contentScope: BASE_TEXT_ONLY,
          feedbackGuidance: BASE_TEXT_ONLY,
        },
        roleplay: {
          scenario: BASE_TEXT_ONLY,
          aiRole: BASE_TEXT_ONLY,
          learnerRole: BASE_TEXT_ONLY,
          characterGoal: BASE_TEXT_ONLY,
          factsAndConstraints: BASE_TEXT_ONLY,
        },
        judge: { taskGoal: BASE_TEXT_ONLY },
        criterion: { title: BASE_TEXT_ONLY, expectedBehavior: BASE_TEXT_ONLY },
        scoreGuidance: { description: BASE_TEXT_ONLY, example: BASE_TEXT_ONLY },
        blockingError: { description: BASE_TEXT_ONLY },
      });
    });

    it.each(INVALID_LANGUAGE_DELETIONS)(
      "rejects deleting $deletedLanguage",
      async ({ language }) => {
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeBilingualCourse(admin.id);

        const response = await deleteLanguage(course.id, language, cookie).expect(400);

        expect(response.body.message).toBe("adminCourseView.toast.invalidLanguageToDelete");
      },
    );

    it.each(COURSE_EDIT_ACCESS_CASES)(
      "responds $expectedStatus when $editor deletes a translation of a course authored by $author",
      async ({ editor, author, expectedStatus }) => {
        const currentEditor = await arrangeEditor(editor);
        const course = await arrangeBilingualCourse(await arrangeAuthorId(author, currentEditor));
        const cookie = await cookieFor(currentEditor, app);

        await deleteLanguage(course.id, COURSE_LANGUAGES.TRANSLATION, cookie).expect(
          expectedStatus,
        );
      },
    );

    it("keeps the translation when the editor may not manage the course", async () => {
      const contentCreator = await arrangeEditor(COURSE_EDITORS.CONTENT_CREATOR);
      const course = await arrangeBilingualCourse(
        await arrangeAuthorId(COURSE_AUTHORS.ANOTHER_USER, contentCreator),
      );
      const cookie = await cookieFor(contentCreator, app);

      const response = await deleteLanguage(course.id, COURSE_LANGUAGES.TRANSLATION, cookie).expect(
        403,
      );

      const [unchangedCourse] = await inTenant(() =>
        db
          .select({ availableLocales: courses.availableLocales })
          .from(courses)
          .where(eq(courses.id, course.id)),
      );

      expect(response.body.message).toBe("common.toast.noAccess");
      expect(unchangedCourse).toEqual({
        availableLocales: [COURSE_LANGUAGES.BASE, COURSE_LANGUAGES.TRANSLATION],
      });
    });

    it("responds 404 for a course that does not exist", async () => {
      const { cookie } = await arrangeSignedInAdmin();

      const response = await deleteLanguage(
        "00000000-0000-4000-8000-000000000000",
        COURSE_LANGUAGES.TRANSLATION,
        cookie,
      ).expect(404);

      expect(response.body.message).toBe("masterCourse.error.courseNotFound");
    });

    it("forbids deleting a translation of a course exported from a master course", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeBilingualCourse(admin.id, {
        originType: COURSE_ORIGIN_TYPES.EXPORTED,
      });

      const response = await deleteLanguage(course.id, COURSE_LANGUAGES.TRANSLATION, cookie).expect(
        403,
      );

      expect(response.body.message).toBe("masterCourse.error.exportedCourseReadonly");
    });
  });
});
