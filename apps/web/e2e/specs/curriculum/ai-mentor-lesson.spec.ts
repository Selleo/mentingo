import { existsSync } from "node:fs";

import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createCourseLanguageFlow } from "../../flows/courses/create-course-language.flow";
import { fillRichTextEditorFlow } from "../../flows/courses/editor.flow";
import { selectCourseLanguageFlow } from "../../flows/courses/select-course-language.flow";
import {
  fillAiJudgeConfigurationFlow,
  type AiJudgeConfigurationInput,
} from "../../flows/curriculum/fill-ai-judge-configuration.flow";
import { fillAiMentorLessonFormFlow } from "../../flows/curriculum/fill-ai-mentor-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveAiMentorLessonFormFlow } from "../../flows/curriculum/save-ai-mentor-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

const baseJudgeConfiguration: AiJudgeConfigurationInput = {
  taskGoal: "Discover the customer's needs and agree on a useful next step.",
  passingThresholdPercent: 0,
  criterion: {
    title: "Uses SPIN discovery questions",
    expectedBehavior:
      "The student asks Situation, Problem, Implication, and Need-payoff questions.",
    maxScore: 2,
    scoreGuidance: [
      {
        score: 0,
        description: "The student does not ask a relevant discovery question.",
        example: "The student immediately presents the offer.",
      },
      {
        score: 1,
        description: "The student asks a Situation question but does not explore the problem.",
        example: "What process do you currently use?",
      },
      {
        score: 2,
        description:
          "The student identifies the situation and explores the problem or its implications.",
        example: "What happens when the current process delays the team?",
      },
    ],
  },
  blockingError: "The student invents customer information instead of asking about it.",
};

const translatedJudgeConfiguration: AiJudgeConfigurationInput = {
  taskGoal: "Kundenbedarf ermitteln und einen hilfreichen nächsten Schritt vereinbaren.",
  passingThresholdPercent: 0,
  criterion: {
    title: "Verwendet SPIN-Fragen",
    expectedBehavior:
      "Der Teilnehmer stellt Situations-, Problem-, Implikations- und Nutzenfragen.",
    maxScore: 2,
    scoreGuidance: [
      {
        score: 0,
        description: "Der Teilnehmer stellt keine relevante Analysefrage.",
        example: "Der Teilnehmer präsentiert sofort das Angebot.",
      },
      {
        score: 1,
        description: "Der Teilnehmer fragt nach der Situation, vertieft das Problem aber nicht.",
        example: "Welchen Prozess verwenden Sie derzeit?",
      },
      {
        score: 2,
        description:
          "Der Teilnehmer versteht die Situation und untersucht das Problem oder seine Folgen.",
        example: "Was passiert, wenn der aktuelle Prozess das Team verzögert?",
      },
    ],
  },
  blockingError: "Der Teilnehmer erfindet Kundendaten, anstatt danach zu fragen.",
};

const expectJudgeConfigurationInDialog = async (
  page: Parameters<typeof fillAiJudgeConfigurationFlow>[0],
  configuration: AiJudgeConfigurationInput,
) => {
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_TASK_GOAL_INPUT).locator(".ProseMirror"),
  ).toContainText(configuration.taskGoal);
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_PASSING_THRESHOLD_INPUT),
  ).toHaveValue(String(configuration.passingThresholdPercent));

  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionToggle(0)).click();
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionTitleInput(0)),
  ).toHaveValue(configuration.criterion.title);
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionExpectedBehaviorInput(0)),
  ).toHaveValue(configuration.criterion.expectedBehavior);
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeCriterionMaxScoreInput(0)),
  ).toHaveValue(String(configuration.criterion.maxScore));

  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoringGuidanceToggle(0)).click();
  for (const guidance of configuration.criterion.scoreGuidance) {
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoreDescriptionInput(0, guidance.score)),
    ).toHaveValue(guidance.description);
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeScoreExampleInput(0, guidance.score)),
    ).toHaveValue(guidance.example);
  }

  const blockingErrorsSection = page.getByTestId(
    AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_BLOCKING_ERRORS_SECTION,
  );
  if ((await blockingErrorsSection.getAttribute("open")) === null)
    await blockingErrorsSection.click();
  await expect(
    page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.judgeBlockingErrorInput(0)),
  ).toHaveValue(configuration.blockingError);
};

test("admin can create and preview an AI mentor lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-ai-mentor-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `ai-mentor-chapter-${Date.now()}`,
    });
    const lessonTitle = `ai-mentor-lesson-${Date.now()}`;
    const formattedDescriptionText = "Practice the topic with a mentor.";
    const boldShortcut = process.platform === "darwin" ? "Meta+B" : "Control+B";

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "ai_mentor");
    await fillAiMentorLessonFormFlow(page, {
      title: lessonTitle,
      name: "Ada",
      description: formattedDescriptionText,
      scenario: "Practice a concise discovery conversation.",
    });
    const descriptionEditor = page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.DESCRIPTION_INPUT)
      .locator(".ProseMirror");
    await descriptionEditor.fill("");
    await descriptionEditor.click();
    await page.keyboard.press(boldShortcut);
    await page.keyboard.type(formattedDescriptionText);
    await page.keyboard.press(boldShortcut);
    await saveAiMentorLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
          ?.id;
      })
      .not.toBeUndefined();

    const updatedCourse = await courseFactory.getById(course.id);
    const lessonId = updatedCourse.chapters[0]!.lessons!.find(
      (lesson) => lesson.title === lessonTitle,
    )!.id;
    const savedLesson = updatedCourse.chapters[0]!.lessons!.find(
      (lesson) => lesson.title === lessonTitle,
    )!;

    expect(savedLesson.description).toContain("<strong>");

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_BUTTON).click();
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_SCENARIO_INPUT).locator(".ProseMirror"),
    ).toContainText("Practice a concise discovery conversation.");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.PREVIEW_BUTTON).click();
    await expect(page.getByText("Ada").first()).toBeVisible();
    await expect(page.getByText(formattedDescriptionText).first()).toBeVisible();
  });
});

test("admin can save and reopen complete Teacher and AI Judge configurations", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-ai-judge-round-trip-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `ai-judge-round-trip-chapter-${Date.now()}`,
    });
    const lessonTitle = `ai-judge-round-trip-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

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
    await page.getByRole("radio", { name: /Teacher/ }).click();
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_TASK_GOAL_INPUT)
      .locator(".ProseMirror")
      .fill("Teach a structured discovery conversation.");
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_EXPERTISE_INPUT)
      .fill("Sales discovery coach");
    await page
      .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONTENT_SCOPE_INPUT)
      .locator(".ProseMirror")
      .fill("SPIN discovery questions and relevant next steps.");
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_APPLY_BUTTON).click();
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();
    await fillAiJudgeConfigurationFlow(page, baseJudgeConfiguration);
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_APPLY_BUTTON).click();
    await saveAiMentorLessonFormFlow(page);

    const savedCourse = await courseFactory.getById(course.id);
    const lessonId = savedCourse.chapters[0]!.lessons!.find(
      (lesson) => lesson.title === lessonTitle,
    )!.id;

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_CONFIGURATION_BUTTON).click();
    await expect(
      page
        .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_TASK_GOAL_INPUT)
        .locator(".ProseMirror"),
    ).toContainText("Teach a structured discovery conversation.");
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.MENTOR_EXPERTISE_INPUT),
    ).toHaveValue("Sales discovery coach");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();
    await expectJudgeConfigurationInDialog(page, baseJudgeConfiguration);
  });
});

test("admin can complete AI Judge translations and refresh course translation status", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-ai-judge-translation-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `ai-judge-translation-chapter-${Date.now()}`,
    });
    const lesson = await curriculumFactory.createAiMentorLesson(course.id, {
      chapterId: chapter.id,
      title: `ai-judge-translation-lesson-${Date.now()}`,
      aiJudgeConfiguration: {
        taskGoal: baseJudgeConfiguration.taskGoal,
        passingThresholdPercent: baseJudgeConfiguration.passingThresholdPercent,
        criteria: [
          {
            title: baseJudgeConfiguration.criterion.title,
            expectedBehavior: baseJudgeConfiguration.criterion.expectedBehavior,
            maxScore: baseJudgeConfiguration.criterion.maxScore,
            scoreGuidance: baseJudgeConfiguration.criterion.scoreGuidance,
          },
        ],
        blockingErrors: [{ description: baseJudgeConfiguration.blockingError }],
      },
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await createCourseLanguageFlow(page, "de");
    await courseFactory.update(course.id, {
      language: "de",
      title: `Deutscher ${course.title}`,
      description: "<p>Deutsche Kursbeschreibung</p>",
    });
    await apiClient.api.chapterControllerUpdateChapter(
      {
        language: "de",
        title: "Deutsches Kapitel",
      },
      { id: chapter.id },
    );
    await curriculumFactory.updateAiMentorLesson(lesson.id, {
      language: "de",
      title: "Deutsche KI-Mentor-Lektion",
      description: "<p>Deutsche Lektionsbeschreibung</p>",
      name: "Ada",
      voiceMode: "preset",
      ttsPreset: "female",
      customTtsReference: null,
    });
    await apiClient.api.aiMentorConfigurationControllerUpdateAiMentorConfigurationTranslations(
      lesson.id,
      "de",
      {
        type: "roleplay",
        scenario: "Führe ein realistisches Kundengespräch.",
        aiRole: "Kunde",
        learnerRole: "Vertriebsmitarbeiter",
        characterGoal: "Erreiche ein realistisches Ergebnis.",
      },
    );

    const beforeTranslation = await apiClient.api.courseControllerHasMissingTranslations({
      id: course.id,
      language: "de",
    });
    expect(beforeTranslation.data.data.hasMissingTranslations).toBe(true);

    await selectCourseLanguageFlow(page, "en");
    await selectCourseLanguageFlow(page, "de");
    await openExistingLessonFlow(page, chapter.id, lesson.id);
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();

    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_ADD_CRITERION_BUTTON),
    ).toBeDisabled();
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_PASSING_THRESHOLD_INPUT),
    ).toBeDisabled();
    await expect(
      page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_ADD_BLOCKING_ERROR_BUTTON),
    ).toBeDisabled();

    await fillAiJudgeConfigurationFlow(page, translatedJudgeConfiguration, {
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

    const translationStatusResponse = await translationStatusRefetch;
    const translationStatus = (await translationStatusResponse.json()) as {
      data: { hasMissingTranslations: boolean };
    };
    expect(translationStatus.data.hasMissingTranslations).toBe(false);

    const afterTranslation = await apiClient.api.courseControllerHasMissingTranslations({
      id: course.id,
      language: "de",
    });
    expect(afterTranslation.data.data.hasMissingTranslations).toBe(false);

    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.JUDGE_CONFIGURE_BUTTON).click();
    await expectJudgeConfigurationInDialog(page, translatedJudgeConfiguration);
  });
});

const aiResourceTest = existsSync(CURRICULUM_TEST_DATA.files.aiMentorResource) ? test : test.skip;

aiResourceTest(
  "admin can upload an AI mentor resource file",
  async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `curriculum-ai-resource-${Date.now()}`,
      );
      const curriculumFactory = factories.createCurriculumFactory();
      const chapter = await curriculumFactory.createChapter({
        courseId: course.id,
        title: `ai-resource-chapter-${Date.now()}`,
      });
      const lesson = await curriculumFactory.createAiMentorLesson(course.id, {
        chapterId: chapter.id,
        title: `ai-resource-lesson-${Date.now()}`,
      });

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await openCurriculumPageFlow(page, course.id);
      await openExistingLessonFlow(page, chapter.id, lesson.id);
      await page
        .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.RESOURCE_FILE_INPUT)
        .setInputFiles(CURRICULUM_TEST_DATA.files.aiMentorResource);

      await expect(page.getByText("ai-mentor-resource.pdf").first()).toBeVisible();
    });
  },
);
