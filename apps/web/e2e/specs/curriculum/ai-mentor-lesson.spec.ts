import { AI_MENTOR_TYPE } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import {
  BASE_AI_JUDGE_CONFIGURATION,
  GERMAN_AI_JUDGE_CONFIGURATION,
} from "../../data/curriculum/ai-judge.data";
import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createCourseLanguageFlow } from "../../flows/courses/create-course-language.flow";
import { fillRichTextEditorFlow, typeBoldRichTextFlow } from "../../flows/courses/editor.flow";
import { selectCourseLanguageFlow } from "../../flows/courses/select-course-language.flow";
import { assertAiJudgeConfigurationFlow } from "../../flows/curriculum/assert-ai-judge-configuration.flow";
import { fillAiJudgeConfigurationFlow } from "../../flows/curriculum/fill-ai-judge-configuration.flow";
import { fillAiMentorLessonFormFlow } from "../../flows/curriculum/fill-ai-mentor-lesson-form.flow";
import { mockLumaConfigFlow } from "../../flows/curriculum/mock-luma-config.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveAiMentorLessonFormFlow } from "../../flows/curriculum/save-ai-mentor-lesson-form.flow";

import {
  arrangeCurriculumChapter,
  translateAiMentorCourseExceptJudge,
} from "./curriculum-test-helpers";

test("admin can create and preview an AI mentor lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `curriculum-ai-mentor-${Date.now()}`;
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    const curriculumFactory = factories.createCurriculumFactory();
    const lessonTitle = `${prefix}-lesson`;
    const mentorName = "Ada";
    const scenario = "Practice a concise discovery conversation.";
    const formattedDescriptionText = "Practice the topic with a mentor.";

    await mockLumaConfigFlow(page, {
      enabled: true,
      courseGenerationEnabled: false,
      voiceMentorEnabled: true,
    });
    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "ai_mentor");
    await fillAiMentorLessonFormFlow(page, {
      title: lessonTitle,
      name: mentorName,
      description: formattedDescriptionText,
      scenario,
    });
    await typeBoldRichTextFlow(
      page,
      AI_MENTOR_LESSON_FORM_HANDLES.DESCRIPTION_INPUT,
      formattedDescriptionText,
    );
    await saveAiMentorLessonFormFlow(page);

    await expect
      .poll(
        async () => (await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle))?.id,
      )
      .toBeDefined();
    const savedLesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);
    expect(savedLesson?.description).toContain("<strong>");

    await openExistingLessonFlow(page, chapter.id, savedLesson?.id ?? "");
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_BUTTON).click();
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_SCENARIO_INPUT),
    ).toContainText(scenario);
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_CANCEL_BUTTON)
      .click();

    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.PREVIEW_BUTTON).click();
    const voiceAction = page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON);
    await expect(voiceAction).toHaveAttribute("data-mode", "voice");
    await expect(voiceAction).toBeEnabled();
    await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeEnabled();
    await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGES)).toContainText(mentorName);
    await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION).click();
    await expect(
      page.getByTestId(LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION_DIALOG),
    ).toContainText(formattedDescriptionText);
  });
});

test("admin can save and reopen complete Teacher and AI Judge configurations", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `curriculum-ai-judge-round-trip-${Date.now()}`;
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    const curriculumFactory = factories.createCurriculumFactory();
    const lessonTitle = `${prefix}-lesson`;
    const teacherTaskGoal = "Teach a structured discovery conversation.";
    const teacherExpertise = "Sales discovery coach";

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "ai_mentor");
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.TITLE_INPUT).fill(lessonTitle);
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.NAME_INPUT).fill("Ada");
    await fillRichTextEditorFlow(
      page,
      AI_MENTOR_LESSON_FORM_HANDLES.DESCRIPTION_INPUT,
      "Practice a discovery conversation.",
    );
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_BUTTON).click();
    await page
      .getByTestId(
        AI_MENTOR_LESSON_FORM_HANDLES.mentorConfigurationChoice("type", AI_MENTOR_TYPE.TEACHER),
      )
      .click();
    await fillRichTextEditorFlow(
      page,
      AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_TASK_GOAL_INPUT,
      teacherTaskGoal,
    );
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_EXPERTISE_INPUT)
      .fill(teacherExpertise);
    await fillRichTextEditorFlow(
      page,
      AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONTENT_SCOPE_INPUT,
      "SPIN discovery questions and relevant next steps.",
    );
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_APPLY_BUTTON).click();
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();
    await fillAiJudgeConfigurationFlow(page, BASE_AI_JUDGE_CONFIGURATION);
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_APPLY_BUTTON).click();
    await saveAiMentorLessonFormFlow(page);

    await expect
      .poll(
        async () => (await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle))?.id,
      )
      .toBeDefined();
    const savedLesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);

    await openExistingLessonFlow(page, chapter.id, savedLesson?.id ?? "");
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_BUTTON).click();
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_TASK_GOAL_INPUT),
    ).toContainText(teacherTaskGoal);
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_EXPERTISE_INPUT),
    ).toHaveValue(teacherExpertise);
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_CANCEL_BUTTON)
      .click();
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();
    await assertAiJudgeConfigurationFlow(page, BASE_AI_JUDGE_CONFIGURATION);
  });
});

test("admin can complete AI Judge translations and refresh course translation status", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `curriculum-ai-judge-translation-${Date.now()}`;
    const { course, chapter, courseFactory } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    const lesson = await factories.createCurriculumFactory().createAiMentorLesson(course.id, {
      chapterId: chapter.id,
      title: `${prefix}-lesson`,
      aiJudgeConfiguration: {
        taskGoal: BASE_AI_JUDGE_CONFIGURATION.taskGoal,
        passingThresholdPercent: BASE_AI_JUDGE_CONFIGURATION.passingThresholdPercent,
        criteria: [BASE_AI_JUDGE_CONFIGURATION.criterion],
        blockingErrors: [{ description: BASE_AI_JUDGE_CONFIGURATION.blockingError }],
      },
    });

    await openCurriculumPageFlow(page, course.id);
    await createCourseLanguageFlow(page, "de");
    await translateAiMentorCourseExceptJudge({
      factories,
      courseId: course.id,
      courseTitle: course.title,
      chapterId: chapter.id,
      lessonId: lesson.id,
    });
    expect(await courseFactory.hasMissingTranslations(course.id, "de")).toBe(true);

    // Translations were written through the API; reload so the cached "de" course is not the pre-translation one.
    await page.reload();
    await selectCourseLanguageFlow(page, "de");
    await openExistingLessonFlow(page, chapter.id, lesson.id);
    const missingTranslationsAlert = page.getByTestId(
      AI_MENTOR_LESSON_FORM_HANDLES.MISSING_TRANSLATIONS_ALERT,
    );
    await expect(missingTranslationsAlert).toBeVisible();
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();

    // Translations may change copy only; structure stays locked to the base language.
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_ADD_CRITERION_BUTTON),
    ).toBeDisabled();
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_PASSING_THRESHOLD_INPUT),
    ).toBeDisabled();
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_ADD_BLOCKING_ERROR_BUTTON),
    ).toBeDisabled();

    await fillAiJudgeConfigurationFlow(page, GERMAN_AI_JUDGE_CONFIGURATION, {
      configureStructure: false,
    });

    const translationStatusRefetch = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/course/beta-course-missing-translations") &&
        response.url().includes(`id=${course.id}`) &&
        response.url().includes("language=de"),
    );
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_APPLY_BUTTON).click();
    await translationStatusRefetch;

    await expect.poll(() => courseFactory.hasMissingTranslations(course.id, "de")).toBe(false);
    await expect(missingTranslationsAlert).toBeHidden();

    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();
    await assertAiJudgeConfigurationFlow(page, GERMAN_AI_JUDGE_CONFIGURATION);
  });
});

test("admin can upload an AI mentor resource file", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const aiConfig = await apiClient.api.envControllerGetAiConfigured();
    // The upload request waits for document ingestion, which embeds the file through OpenAI.
    test.skip(!aiConfig.data.data.enabled, "requires OpenAI for document ingestion");

    const prefix = `curriculum-ai-resource-${Date.now()}`;
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    const lesson = await factories.createCurriculumFactory().createAiMentorLesson(course.id, {
      chapterId: chapter.id,
      title: `${prefix}-lesson`,
    });
    const resourceFileName = "ai-mentor-resource.pdf";

    await openCurriculumPageFlow(page, course.id);
    await openExistingLessonFlow(page, chapter.id, lesson.id);
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/api/ingestion/ingest"),
    );
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.RESOURCE_FILE_INPUT)
      .setInputFiles(CURRICULUM_TEST_DATA.files.aiMentorResource);

    expect((await uploadResponse).ok()).toBe(true);
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.resourceFileCard(resourceFileName)),
    ).toHaveAttribute("data-state", "uploaded");
  });
});
