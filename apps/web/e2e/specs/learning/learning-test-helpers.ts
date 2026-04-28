import { USER_ROLE } from "~/config/userRoles";

import type { FixtureFactories } from "../../factories";
import type { CurriculumCourseLessonRecord } from "../../factories/curriculum.factory";
import type { PageHandle } from "../../fixtures/types";
import type { UpdateCourseSettingsBody } from "~/api/generated-api";
import type { UserRole } from "~/config/userRoles";

type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

type WithWorkerPage = (
  role: UserRole,
  run: (handle: PageHandle) => Promise<void>,
  options?: { root?: boolean },
) => Promise<void>;

type LearningCourseBuilderContext = {
  chapterId: string;
  courseId: string;
  prefix: string;
  curriculumFactory: ReturnType<FixtureFactories["createCurriculumFactory"]>;
};

type CreatePublishedLearningCourseInput<TLessons> = {
  categoryTitle?: (prefix: string) => string;
  cleanup: Cleanup;
  factories: FixtureFactories;
  prefix: string;
  settings?: UpdateCourseSettingsBody;
  shouldKeepCourseAfterTest?: () => boolean;
  withWorkerPage: WithWorkerPage;
  buildLessons: (context: LearningCourseBuilderContext) => Promise<TLessons>;
};

export type PublishedLearningCourse<TLessons> = {
  categoryId: string;
  courseId: string;
  lessons: TLessons;
};

export const createPublishedLearningCourse = async <TLessons>({
  categoryTitle = (prefix) => `Learning Category ${prefix}`,
  cleanup,
  factories,
  prefix,
  settings,
  shouldKeepCourseAfterTest,
  withWorkerPage,
  buildLessons,
}: CreatePublishedLearningCourseInput<TLessons>): Promise<PublishedLearningCourse<TLessons>> => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const curriculumFactory = factories.createCurriculumFactory();

  let categoryId = "";
  let courseId = "";
  let lessons: TLessons | undefined;

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      const category = await categoryFactory.create(categoryTitle(prefix));
      const course = await courseFactory.create({
        title: `${prefix}-course`,
        categoryId: category.id,
        language: "en",
        status: "draft",
      });
      const chapter = await curriculumFactory.createChapter({
        courseId: course.id,
        title: `${prefix}-chapter`,
      });

      categoryId = category.id;
      courseId = course.id;
      lessons = await buildLessons({
        chapterId: chapter.id,
        courseId: course.id,
        curriculumFactory,
        prefix,
      });

      if (settings) {
        await courseFactory.updateSettings(course.id, settings);
      }

      await courseFactory.update(course.id, { status: "published", language: "en" });

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await courseFactory.update(course.id, { status: "draft", language: "en" });
            if (shouldKeepCourseAfterTest?.()) return;

            await courseFactory.delete(course.id);
            await categoryFactory.delete(category.id);
          },
          { root: true },
        );
      });
    },
    { root: true },
  );

  if (!lessons) {
    throw new Error(`Learning course ${prefix} was not created`);
  }

  return { categoryId, courseId, lessons };
};

export const createTwoContentLessonsCourse = async (
  input: Omit<
    CreatePublishedLearningCourseInput<{
      firstLesson: CurriculumCourseLessonRecord;
      secondLesson: CurriculumCourseLessonRecord;
    }>,
    "buildLessons"
  >,
) =>
  createPublishedLearningCourse({
    ...input,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const firstLesson = await curriculumFactory.createContentLesson(courseId, {
        chapterId,
        title: `${prefix}-first-lesson`,
        displayOrder: 1,
      });
      const secondLesson = await curriculumFactory.createContentLesson(courseId, {
        chapterId,
        title: `${prefix}-second-lesson`,
        displayOrder: 2,
      });

      return { firstLesson, secondLesson };
    },
  });

export const createThreeContentLessonsCourse = async (
  input: Omit<
    CreatePublishedLearningCourseInput<{
      firstLesson: CurriculumCourseLessonRecord;
      thirdLesson: CurriculumCourseLessonRecord;
    }>,
    "buildLessons"
  >,
) =>
  createPublishedLearningCourse({
    ...input,
    settings: input.settings ?? { lessonSequenceEnabled: false },
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const firstLesson = await curriculumFactory.createContentLesson(courseId, {
        chapterId,
        title: `${prefix}-first-lesson`,
        displayOrder: 1,
      });
      await curriculumFactory.createContentLesson(courseId, {
        chapterId,
        title: `${prefix}-second-lesson`,
        displayOrder: 2,
      });
      const thirdLesson = await curriculumFactory.createContentLesson(courseId, {
        chapterId,
        title: `${prefix}-third-lesson`,
        displayOrder: 3,
      });

      return { firstLesson, thirdLesson };
    },
  });

type QuizAnswerOrder = "correct-first" | "wrong-first";

export const createSingleChoiceQuizLessonCourse = async (
  input: Omit<
    CreatePublishedLearningCourseInput<{
      quizLesson: CurriculumCourseLessonRecord;
    }>,
    "buildLessons"
  > & {
    answerOrder?: QuizAnswerOrder;
    thresholdScore?: number;
  },
) =>
  createPublishedLearningCourse({
    ...input,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const correctAnswer = {
        optionText: `${prefix}-correct-answer`,
        displayOrder: input.answerOrder === "wrong-first" ? 2 : 1,
        isCorrect: true,
      };
      const wrongAnswer = {
        optionText: `${prefix}-wrong-answer`,
        displayOrder: input.answerOrder === "wrong-first" ? 1 : 2,
        isCorrect: false,
      };
      const quizLesson = await curriculumFactory.createQuizLesson(courseId, {
        chapterId,
        title: `${prefix}-quiz-lesson`,
        displayOrder: 1,
        thresholdScore: input.thresholdScore ?? 50,
        questions: [
          {
            type: "single_choice",
            title: `${prefix}-quiz-question`,
            displayOrder: 1,
            options:
              input.answerOrder === "wrong-first"
                ? [wrongAnswer, correctAnswer]
                : [correctAnswer, wrongAnswer],
          },
        ],
      });

      return { quizLesson };
    },
  });

export const createSequencedQuizAndContentCourse = async (
  input: Omit<
    CreatePublishedLearningCourseInput<{
      blockedLesson: CurriculumCourseLessonRecord;
      quizLesson: CurriculumCourseLessonRecord;
    }>,
    "buildLessons" | "settings"
  > & {
    answerOrder?: QuizAnswerOrder;
    thresholdScore?: number;
  },
) =>
  createPublishedLearningCourse({
    ...input,
    settings: { lessonSequenceEnabled: true },
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const correctAnswer = {
        optionText: `${prefix}-correct-answer`,
        displayOrder: input.answerOrder === "wrong-first" ? 2 : 1,
        isCorrect: true,
      };
      const wrongAnswer = {
        optionText: `${prefix}-wrong-answer`,
        displayOrder: input.answerOrder === "wrong-first" ? 1 : 2,
        isCorrect: false,
      };
      const quizLesson = await curriculumFactory.createQuizLesson(courseId, {
        chapterId,
        title: `${prefix}-quiz-lesson`,
        displayOrder: 1,
        thresholdScore: input.thresholdScore ?? 50,
        questions: [
          {
            type: "single_choice",
            title: `${prefix}-quiz-question`,
            displayOrder: 1,
            options:
              input.answerOrder === "wrong-first"
                ? [wrongAnswer, correctAnswer]
                : [correctAnswer, wrongAnswer],
          },
        ],
      });
      const blockedLesson = await curriculumFactory.createContentLesson(courseId, {
        chapterId,
        title: `${prefix}-blocked-lesson`,
        displayOrder: 2,
      });

      return { quizLesson, blockedLesson };
    },
  });

export const createEmbedLessonCourse = async (
  input: Omit<
    CreatePublishedLearningCourseInput<{
      embedLesson: CurriculumCourseLessonRecord;
    }>,
    "buildLessons"
  >,
) =>
  createPublishedLearningCourse({
    ...input,
    categoryTitle: (prefix) => `Learning Embed Category ${prefix}`,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const embedLesson = await curriculumFactory.createEmbedLesson(courseId, {
        chapterId,
        title: `${prefix}-embed-lesson`,
        type: "embed",
        resources: [{ fileUrl: "https://example.com", allowFullscreen: true }],
      });

      return { embedLesson };
    },
  });

export const createAiMentorLessonCourse = async (
  input: Omit<
    CreatePublishedLearningCourseInput<{
      aiMentorLesson: CurriculumCourseLessonRecord;
    }>,
    "buildLessons"
  >,
) =>
  createPublishedLearningCourse({
    ...input,
    categoryTitle: (prefix) => `Learning AI Mentor Category ${prefix}`,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const aiMentorLesson = await curriculumFactory.createAiMentorLesson(courseId, {
        chapterId,
        title: `${prefix}-lesson`,
        description: "<p>Practice with your AI mentor.</p>",
        aiMentorInstructions: "<p>Ask concise questions.</p>",
        completionConditions: "<p>Complete the mentor conversation.</p>",
        displayOrder: 1,
      });

      return { aiMentorLesson };
    },
  });

export const createAllRenderedQuestionTypesQuizCourse = async (
  input: Omit<
    CreatePublishedLearningCourseInput<{
      dndBlankAnswer: string;
      quizLesson: CurriculumCourseLessonRecord;
      textBlankAnswer: string;
    }>,
    "buildLessons"
  >,
) =>
  createPublishedLearningCourse({
    ...input,
    categoryTitle: (prefix) => `Learning All Quiz Types Category ${prefix}`,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const textBlankAnswer = `${prefix}-text-answer`;
      const dndBlankAnswer = `${prefix}-dnd-answer`;
      const quizLesson = await curriculumFactory.createQuizLesson(courseId, {
        chapterId,
        title: `${prefix}-quiz-lesson`,
        displayOrder: 1,
        thresholdScore: 100,
        questions: [
          {
            type: "single_choice",
            title: `${prefix}-single-choice`,
            displayOrder: 1,
            options: [
              { optionText: `${prefix}-single-correct`, displayOrder: 1, isCorrect: true },
              { optionText: `${prefix}-single-wrong`, displayOrder: 2, isCorrect: false },
            ],
          },
          {
            type: "multiple_choice",
            title: `${prefix}-multiple-choice`,
            displayOrder: 2,
            options: [
              { optionText: `${prefix}-multi-correct-1`, displayOrder: 1, isCorrect: true },
              { optionText: `${prefix}-multi-correct-2`, displayOrder: 2, isCorrect: true },
              { optionText: `${prefix}-multi-wrong`, displayOrder: 3, isCorrect: false },
            ],
          },
          {
            type: "true_or_false",
            title: `${prefix}-true-or-false`,
            displayOrder: 3,
            options: [
              { optionText: `${prefix}-true-statement`, displayOrder: 1, isCorrect: true },
              { optionText: `${prefix}-false-statement`, displayOrder: 2, isCorrect: false },
            ],
          },
          {
            type: "photo_question_single_choice",
            title: `${prefix}-photo-single-choice`,
            displayOrder: 4,
            photoS3Key: null,
            options: [
              { optionText: `${prefix}-photo-single-correct`, displayOrder: 1, isCorrect: true },
              { optionText: `${prefix}-photo-single-wrong`, displayOrder: 2, isCorrect: false },
            ],
          },
          {
            type: "photo_question_multiple_choice",
            title: `${prefix}-photo-multiple-choice`,
            displayOrder: 5,
            photoS3Key: null,
            options: [
              { optionText: `${prefix}-photo-multi-correct-1`, displayOrder: 1, isCorrect: true },
              { optionText: `${prefix}-photo-multi-correct-2`, displayOrder: 2, isCorrect: true },
              { optionText: `${prefix}-photo-multi-wrong`, displayOrder: 3, isCorrect: false },
            ],
          },
          {
            type: "fill_in_the_blanks_text",
            title: `${prefix}-fill-text`,
            description: "Type the [word] answer.",
            displayOrder: 6,
            options: [{ optionText: textBlankAnswer, displayOrder: 1, isCorrect: true }],
          },
          {
            type: "fill_in_the_blanks_dnd",
            title: `${prefix}-fill-dnd`,
            description: "Drag the [word] answer.",
            displayOrder: 7,
            options: [{ optionText: dndBlankAnswer, displayOrder: 1, isCorrect: true }],
          },
          { type: "brief_response", title: `${prefix}-brief-response`, displayOrder: 8 },
          { type: "detailed_response", title: `${prefix}-detailed-response`, displayOrder: 9 },
        ],
      });

      return { quizLesson, textBlankAnswer, dndBlankAnswer };
    },
  });
