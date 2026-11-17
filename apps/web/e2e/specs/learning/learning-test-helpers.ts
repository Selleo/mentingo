import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import { USER_ROLE } from "~/config/userRoles";

import { SCORM_TEST_DATA } from "../../data/scorm/scorm.data";
import { fillCreateScormCourseFormFlow } from "../../flows/courses/fill-create-scorm-course-form.flow";
import { openCreateScormCoursePageFlow } from "../../flows/courses/open-create-scorm-course-page.flow";
import { submitCreateScormCourseFormFlow } from "../../flows/courses/submit-create-scorm-course-form.flow";
import { fillScormLessonFormFlow } from "../../flows/curriculum/fill-scorm-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveScormLessonFormFlow } from "../../flows/curriculum/save-scorm-lesson-form.flow";

import type { FixtureFactories } from "../../factories";
import type { CurriculumCourseLessonRecord } from "../../factories/curriculum.factory";
import type { Cleanup, PageHandle, WithWorkerPage } from "../../fixtures/types";
import type { AnswerAllRenderedQuizQuestionTypesFlowInput } from "../../flows/learning/answer-all-rendered-quiz-question-types.flow";
import type { UpdateCourseSettingsBody } from "~/api/generated-api";

type LearningCourseBuilderContext = {
  chapterId: string;
  courseId: string;
  page: PageHandle["page"];
  prefix: string;
  curriculumFactory: ReturnType<FixtureFactories["createCurriculumFactory"]>;
};

type CreatePublishedLearningCourseInput<TLessons> = {
  categoryTitle?: (prefix: string) => string;
  cleanup: Cleanup;
  factories: FixtureFactories;
  prefix: string;
  // shortcut: defaults to the shared root tenant for specs outside learning/ai/live-training/statistics
  // that still run there (courses, curriculum, course-enrollment); flip the default once they drop it
  root?: boolean;
  settings?: UpdateCourseSettingsBody;
  shouldKeepCourseAfterTest?: () => boolean;
  withWorkerPage: WithWorkerPage;
  buildLessons: (context: LearningCourseBuilderContext) => Promise<TLessons>;
};

type LearningCourseInput<TLessons> = Omit<
  CreatePublishedLearningCourseInput<TLessons>,
  "buildLessons"
>;

export type PublishedLearningCourse<TLessons> = {
  categoryId: string;
  chapterId: string;
  courseId: string;
  lessons: TLessons;
};

export const createPublishedLearningCourse = async <TLessons>({
  categoryTitle = (prefix) => `Learning Category ${prefix}`,
  cleanup,
  factories,
  prefix,
  root = true,
  settings,
  shouldKeepCourseAfterTest,
  withWorkerPage,
  buildLessons,
}: CreatePublishedLearningCourseInput<TLessons>): Promise<PublishedLearningCourse<TLessons>> => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const curriculumFactory = factories.createCurriculumFactory();

  let categoryId = "";
  let chapterId = "";
  let courseId = "";
  let lessons: TLessons | undefined;

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const category = await categoryFactory.create(categoryTitle(prefix));
      const course = await courseFactory.create({
        title: `${prefix}-course`,
        categoryId: category.id,
        language: "en",
        status: "draft",
      });

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await courseFactory.update(course.id, { status: "draft", language: "en" });
            // Courses with learner attempts cannot be deleted, so they are only unpublished.
            if (shouldKeepCourseAfterTest?.()) return;

            await courseFactory.delete(course.id);
            await categoryFactory.delete(category.id);
          },
          { root },
        );
      });

      const chapter = await curriculumFactory.createChapter({
        courseId: course.id,
        title: `${prefix}-chapter`,
      });

      categoryId = category.id;
      chapterId = chapter.id;
      courseId = course.id;
      lessons = await buildLessons({
        chapterId: chapter.id,
        courseId: course.id,
        curriculumFactory,
        page,
        prefix,
      });

      if (settings) {
        await courseFactory.updateSettings(course.id, settings);
      }

      await courseFactory.update(course.id, { status: "published", language: "en" });
    },
    { root },
  );

  if (!lessons) {
    throw new Error(`Learning course ${prefix} was not created`);
  }

  return { categoryId, chapterId, courseId, lessons };
};

export const createTwoContentLessonsCourse = async (
  input: LearningCourseInput<{
    firstLesson: CurriculumCourseLessonRecord;
    secondLesson: CurriculumCourseLessonRecord;
  }>,
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
  input: LearningCourseInput<{
    firstLesson: CurriculumCourseLessonRecord;
    thirdLesson: CurriculumCourseLessonRecord;
  }>,
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

type SingleChoiceQuizInput = {
  answerOrder?: QuizAnswerOrder;
  thresholdScore?: number;
};

type SingleChoiceQuizLessons = {
  correctOptionId: string;
  quizLesson: CurriculumCourseLessonRecord;
  wrongOptionId: string;
};

const createSingleChoiceQuizLesson = async (
  { chapterId, courseId, curriculumFactory, prefix }: LearningCourseBuilderContext,
  { answerOrder, thresholdScore = 50 }: SingleChoiceQuizInput,
): Promise<SingleChoiceQuizLessons> => {
  const isWrongFirst = answerOrder === "wrong-first";
  const correctAnswer = {
    id: randomUUID(),
    optionText: `${prefix}-correct-answer`,
    displayOrder: isWrongFirst ? 2 : 1,
    isCorrect: true,
  };
  const wrongAnswer = {
    id: randomUUID(),
    optionText: `${prefix}-wrong-answer`,
    displayOrder: isWrongFirst ? 1 : 2,
    isCorrect: false,
  };
  const quizLesson = await curriculumFactory.createQuizLesson(courseId, {
    chapterId,
    title: `${prefix}-quiz-lesson`,
    displayOrder: 1,
    thresholdScore,
    questions: [
      {
        type: "single_choice",
        title: `${prefix}-quiz-question`,
        displayOrder: 1,
        options: isWrongFirst ? [wrongAnswer, correctAnswer] : [correctAnswer, wrongAnswer],
      },
    ],
  });

  return { correctOptionId: correctAnswer.id, quizLesson, wrongOptionId: wrongAnswer.id };
};

export const createSingleChoiceQuizLessonCourse = async (
  input: LearningCourseInput<SingleChoiceQuizLessons> & SingleChoiceQuizInput,
) =>
  createPublishedLearningCourse({
    ...input,
    buildLessons: (context) => createSingleChoiceQuizLesson(context, input),
  });

export const createSequencedQuizAndContentCourse = async (
  input: Omit<
    LearningCourseInput<SingleChoiceQuizLessons & { blockedLesson: CurriculumCourseLessonRecord }>,
    "settings"
  > &
    SingleChoiceQuizInput,
) =>
  createPublishedLearningCourse({
    ...input,
    settings: { lessonSequenceEnabled: true },
    buildLessons: async (context) => {
      const quiz = await createSingleChoiceQuizLesson(context, input);
      const blockedLesson = await context.curriculumFactory.createContentLesson(context.courseId, {
        chapterId: context.chapterId,
        title: `${context.prefix}-blocked-lesson`,
        displayOrder: 2,
      });

      return { ...quiz, blockedLesson };
    },
  });

export const createEmbedLessonCourse = async (
  input: LearningCourseInput<{ embedLesson: CurriculumCourseLessonRecord }>,
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
  input: LearningCourseInput<{ aiMentorLesson: CurriculumCourseLessonRecord }>,
) =>
  createPublishedLearningCourse({
    ...input,
    categoryTitle: (prefix) => `Learning AI Mentor Category ${prefix}`,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const aiMentorLesson = await curriculumFactory.createAiMentorLesson(courseId, {
        chapterId,
        title: `${prefix}-lesson`,
        description: "<p>Practice with your AI mentor.</p>",
        displayOrder: 1,
      });

      return { aiMentorLesson };
    },
  });

const choiceOptions = (prefix: string, correctCount: number, wrongCount: number) =>
  [
    ...Array.from({ length: correctCount }, (_, index) => ({
      optionText: `${prefix}-correct-${index + 1}`,
      isCorrect: true,
    })),
    ...Array.from({ length: wrongCount }, (_, index) => ({
      optionText: `${prefix}-wrong-${index + 1}`,
      isCorrect: false,
    })),
  ].map((option, index) => ({ ...option, id: randomUUID(), displayOrder: index + 1 }));

const correctOptionIds = (options: ReturnType<typeof choiceOptions>) =>
  options.filter((option) => option.isCorrect).map((option) => option.id);

export const createAllRenderedQuestionTypesQuizCourse = async ({
  openQuestionsRequireReview = false,
  ...input
}: LearningCourseInput<{
  answers: AnswerAllRenderedQuizQuestionTypesFlowInput;
  quizLesson: CurriculumCourseLessonRecord;
}> & { openQuestionsRequireReview?: boolean }) =>
  createPublishedLearningCourse({
    ...input,
    categoryTitle: (prefix) => `Learning All Quiz Types Category ${prefix}`,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const textBlankAnswer = `${prefix}-text-answer`;
      const textBlankAnswerId = randomUUID();
      const dndBlankAnswer = `${prefix}-dnd-answer`;
      const dndBlankAnswerId = randomUUID();
      const singleChoice = choiceOptions(`${prefix}-single`, 1, 1);
      const multipleChoice = choiceOptions(`${prefix}-multi`, 2, 1);
      const trueOrFalse = choiceOptions(`${prefix}-statement`, 1, 1);
      const photoSingleChoice = choiceOptions(`${prefix}-photo-single`, 1, 1);
      const photoMultipleChoice = choiceOptions(`${prefix}-photo-multi`, 2, 1);
      const matchingPairs = [1, 2].map((pairNumber) => ({
        optionId: randomUUID(),
        prompt: `${prefix}-matching-prompt-${pairNumber}`,
        match: `${prefix}-matching-match-${pairNumber}`,
      }));

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
            options: singleChoice,
          },
          {
            type: "multiple_choice",
            title: `${prefix}-multiple-choice`,
            displayOrder: 2,
            options: multipleChoice,
          },
          {
            type: "true_or_false",
            title: `${prefix}-true-or-false`,
            displayOrder: 3,
            options: trueOrFalse,
          },
          {
            type: "photo_question_single_choice",
            title: `${prefix}-photo-single-choice`,
            displayOrder: 4,
            photoS3Key: null,
            options: photoSingleChoice,
          },
          {
            type: "photo_question_multiple_choice",
            title: `${prefix}-photo-multiple-choice`,
            displayOrder: 5,
            photoS3Key: null,
            options: photoMultipleChoice,
          },
          {
            type: "fill_in_the_blanks_text",
            title: `${prefix}-fill-text`,
            description: `Type the <blank-answer-${textBlankAnswerId}> answer.`,
            displayOrder: 6,
            options: [
              {
                id: textBlankAnswerId,
                optionText: textBlankAnswer,
                displayOrder: 1,
                isCorrect: true,
              },
            ],
          },
          {
            type: "fill_in_the_blanks_dnd",
            title: `${prefix}-fill-dnd`,
            description: `Drag the <blank-answer-${dndBlankAnswerId}> answer.`,
            displayOrder: 7,
            options: [
              {
                id: dndBlankAnswerId,
                optionText: dndBlankAnswer,
                displayOrder: 1,
                isCorrect: true,
              },
            ],
          },
          {
            type: "brief_response",
            title: `${prefix}-brief-response`,
            displayOrder: 8,
            requiresReview: openQuestionsRequireReview,
          },
          {
            type: "detailed_response",
            title: `${prefix}-detailed-response`,
            displayOrder: 9,
            requiresReview: openQuestionsRequireReview,
          },
          {
            type: "matching",
            title: `${prefix}-matching`,
            displayOrder: 10,
            options: matchingPairs.map(({ optionId, prompt, match }, index) => ({
              id: optionId,
              optionText: prompt,
              matchedWord: match,
              displayOrder: index + 1,
              isCorrect: true,
            })),
          },
        ],
      });

      const answers: AnswerAllRenderedQuizQuestionTypesFlowInput = {
        singleChoiceOptionIds: correctOptionIds(singleChoice),
        multipleChoiceOptionIds: correctOptionIds(multipleChoice),
        trueOrFalseAnswers: trueOrFalse.map((option) => ({
          optionId: option.id,
          value: option.isCorrect ? "true" : "false",
        })),
        photoSingleChoiceOptionIds: correctOptionIds(photoSingleChoice),
        photoMultipleChoiceOptionIds: correctOptionIds(photoMultipleChoice),
        textBlankAnswer,
        dndBlankAnswer,
        dndBlankAnswerId,
        briefResponse: `${prefix}-brief-answer`,
        detailedResponse: `${prefix}-detailed-answer`,
        matchingPairs: matchingPairs.map(({ optionId, match }) => ({ optionId, match })),
      };

      return { answers, quizLesson };
    },
  });

export const createTextGapFillQuizCourse = async (
  input: LearningCourseInput<{
    quizLesson: CurriculumCourseLessonRecord;
    textBlankAnswer: string;
    wrongTextBlankAnswer: string;
  }>,
) =>
  createPublishedLearningCourse({
    ...input,
    categoryTitle: (prefix) => `Learning Text Gap Fill Category ${prefix}`,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => {
      const textBlankAnswer = `${prefix}-correct-gap`;
      const textBlankAnswerId = randomUUID();
      const wrongTextBlankAnswer = `${prefix}-wrong-gap`;
      const quizLesson = await curriculumFactory.createQuizLesson(courseId, {
        chapterId,
        title: `${prefix}-quiz-lesson`,
        displayOrder: 1,
        thresholdScore: 0,
        questions: [
          {
            type: "fill_in_the_blanks_text",
            title: `${prefix}-fill-text`,
            description: `Type the <blank-answer-${textBlankAnswerId}> answer.`,
            displayOrder: 1,
            options: [
              {
                id: textBlankAnswerId,
                optionText: textBlankAnswer,
                displayOrder: 1,
                isCorrect: true,
              },
            ],
          },
        ],
      });

      return { quizLesson, textBlankAnswer, wrongTextBlankAnswer };
    },
  });

/** Adds a multi-SCO SCORM lesson through the curriculum UI (packages are uploaded with tus). */
export const createMultiScoScormLessonCourse = async (
  input: LearningCourseInput<{ lessonId: string }>,
) =>
  createPublishedLearningCourse({
    ...input,
    buildLessons: async ({ chapterId, courseId, page, prefix }) => {
      const courseFactory = input.factories.createCourseFactory();
      const findScormLessonId = async () => {
        const course = await courseFactory.getById(courseId);
        return course.chapters[0]?.lessons?.find((lesson) => lesson.type === "scorm")?.id ?? null;
      };

      await openCurriculumPageFlow(page, courseId);
      await openNewLessonFormFlow(page, chapterId, "scorm");
      await fillScormLessonFormFlow(page, {
        title: `${prefix}-multi-sco-lesson`,
        packagePath: SCORM_TEST_DATA.files.multiScoPackage,
      });
      await saveScormLessonFormFlow(page);

      await expect.poll(findScormLessonId, { timeout: 30_000 }).not.toBeNull();
      const lessonId = await findScormLessonId();
      if (!lessonId) throw new Error(`SCORM lesson was not created for course ${courseId}`);

      return { lessonId };
    },
  });

/** Imports a single-SCO SCORM package as a new published course through the UI. */
export const createScormPackageCourse = async ({
  cleanup,
  factories,
  prefix,
  root = true,
  withWorkerPage,
}: Pick<
  CreatePublishedLearningCourseInput<unknown>,
  "cleanup" | "factories" | "prefix" | "root" | "withWorkerPage"
>) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const title = `${prefix}-course`;
  let courseId = "";
  let lessonId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const category = await categoryFactory.create(`${prefix}-category`);

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            const createdCourse = await courseFactory.findByTitle(title);
            if (createdCourse) {
              await courseFactory.update(createdCourse.id, { status: "draft", language: "en" });
              await courseFactory.delete(createdCourse.id);
            }
            await categoryFactory.delete(category.id);
          },
          { root },
        );
      });

      await openCreateScormCoursePageFlow(page);
      await fillCreateScormCourseFormFlow(page, {
        title,
        categoryTitle: category.title,
        language: "en",
        description: `Description for ${title}`,
        packagePath: SCORM_TEST_DATA.files.singleScoPackage,
      });
      await submitCreateScormCourseFormFlow(page);

      await expect
        .poll(async () => (await courseFactory.findByTitle(title))?.id ?? null, {
          timeout: 30_000,
        })
        .not.toBeNull();
      const createdCourse = await courseFactory.findByTitle(title);
      if (!createdCourse) throw new Error(`SCORM course ${title} was not created`);

      await courseFactory.update(createdCourse.id, { status: "published", language: "en" });

      const course = await courseFactory.getById(createdCourse.id);
      courseId = course.id;
      lessonId = course.chapters[0]?.lessons?.[0]?.id ?? "";
    },
    { root },
  );

  if (!lessonId) throw new Error(`SCORM course ${title} has no lesson`);

  return { courseId, lessonId };
};
