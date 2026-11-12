import { ASSESSMENT_SCORING_MODES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { addQuizQuestionFlow } from "../../flows/curriculum/add-quiz-question.flow";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can create a quiz lesson with a partially scored matching question", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-quiz-matching-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `quiz-matching-chapter-${Date.now()}`,
    });
    const lessonTitle = `quiz-matching-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "quiz");
    await fillQuizLessonTitleFlow(page, lessonTitle);

    await addQuizQuestionFlow(page, QuestionType.MATCHING, 0);
    await page
      .getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(0))
      .fill("Match the animal with its sound");

    const pairs = [
      ["Cat", "Meow"],
      ["Dog", "Woof"],
    ];
    for (const [pairIndex, [prompt, match]] of pairs.entries()) {
      await page
        .getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingPromptInput(0, pairIndex))
        .fill(prompt);
      await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(0, pairIndex)).fill(match);
    }

    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingScoringSelect(0)).click();
    await page.getByRole("option", { name: "Points for each correct pair" }).click();

    await saveQuizLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        const question = updatedCourse.chapters[0]?.lessons?.find(
          (lesson) => lesson.title === lessonTitle,
        )?.questions?.[0];

        return {
          type: question?.type,
          scoringMode: question?.scoringMode,
          pairs: question?.options?.map(({ optionText, matchedWord }) => [optionText, matchedWord]),
        };
      })
      .toEqual({
        type: QuestionType.MATCHING,
        scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL,
        pairs,
      });
  });
});
