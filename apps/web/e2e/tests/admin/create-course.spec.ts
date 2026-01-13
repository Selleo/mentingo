import { test, expect } from "@playwright/test";

import type { Locator, Page } from "@playwright/test";

const NEW_COURSE = {
  title: "CSS Fundamentals",
  description: "This course takes you through a css course, it lets you learn the basics.",
  chapter: {
    title: "CSS Introduction",
    editedTitle: "Edited CSS Introduction",
  },
  label: {
    title: "Title",
    description: "Description",
    category: "Category",
  },
  button: {
    addChapter: "add chapter",
    createNew: "create new",
    save: "save",
    delete: "delete",
    removePresentation: "remove presentation",
    addLesson: "add lesson",
    removeVideo: "remove video",
    addQuestion: "add question",
    addWords: "add words",
    cancel: "cancel",
    proceed: "proceed",
  },
  lessons: {
    quizTitle: "Quiz for first exam",
    fillInTheBlankDescription:
      "The most popular programing language used to styling components is ",
    contentLessonTitle: "Introduction to CSS",
    contentLessonDescription:
      "CSS is a style sheet language used for describing the presentation of a document written in HTML.",
    presentationLessonTitle: "HTML tags presentation",
    presentationLessonDescription: "This presentation presents knowledge about tags in html",
    videoLessonTitle: "Video for CSS course",
    videoLessonDescription: "This video presents knowledge about tags in html",
  },
  dialog: {
    deleteQuiz: "Are you sure you want to delete this quiz lesson from chapter?",
    deleteChapter: "Are you sure you want to delete this chapter?",
  },
  editedLesson: {
    quizTitle: "Edited Quiz for first exam",
    contentLessonTitle: "Edited Introduction to CSS",
    presentationLessonTitle: "Edited HTML tags presentation",
    videoLessonTitle: "Edited Video for CSS course",
    contentLessonDescription:
      "Edited CSS is a style sheet language used for describing the presentation of a document written in HTML.",
    videoLessonDescription: "Edited This video presents knowledge about tags in html",
    presentationLessonDescription: "Edited This presentation presents knowledge about tags in html",
  },
  lessonType: {
    content: "Content",
    presentation: "Presentation",
    video: "Video",
    quiz: "Quiz",
  },
  questionType: {
    freeText: "free text",
    shortAnswer: "short answer",
    singleChoice: "single choice",
    mutlipleChoice: "multiple choice",
    trueOrFalse: "true or false",
    matching: "matching",
    scale: "scale 1 to 5",
    photoQuestion: "photo question",
    fillInTheBlanks: "fill in the blanks",
  },
  questions: {
    freeText: "Describe what is your CSS and HTML level",
    shortAnswer: "Describe what would you like to learn with this course",
    singleChoice: "Which css tag is most popular, choose one correct answer",
    multipleChoice: "Which of the following are valid CSS properties?",
    trueOrFalse: "Which of the following statements about CSS are true?",
    matching: "Match the CSS property with its effect",
    scale: "How would you rate your CSS knowledge on a scale from 1 to 5?",
    photoQuestion: "What code language do you see on this screenshot",
    fillInTheBlank: "Fill words in blank space",
  },
  options: {
    singleChoice: [
      { text: "<div></div>", isCorrect: true },
      { text: "<p></p>", isCorrect: false },
      { text: "<h1></h1>", isCorrect: false },
    ],
    multipleChoice: [
      { text: "color", isCorrect: true },
      { text: "font-size", isCorrect: true },
      { text: "text-align-center", isCorrect: false },
      { text: "background-image-url", isCorrect: false },
    ],
    trueOrFalse: [
      "CSS allows direct manipulation of a website's database.",
      "CSS enables styling HTML elements, such as colors, fonts, and page layouts.",
      "CSS only works in web browsers that support JavaScript.",
    ],
    matching: [
      { optionText: "Affects the spacing inside an element.", matchedWord: "Padding" },
      {
        optionText: "Defines how an element is positioned relative to its container.",
        matchedWord: "Position",
      },
      { optionText: "Adds shadow effects to an element.", matchedWord: "Box shadow" },
    ],
    scale: [
      "Beginner (I have basic knowledge and am still learning CSS)",
      "Intermediate (I understand the basics but am still learning more advanced techniques)",
      "Expert (I have advanced knowledge and can create complex styles)",
    ],
    photoOptions: ["JAVA", "PYTHON", "JAVASCRIPT"],
  },
} as const;

export class CreateCourseActions {
  constructor(private readonly page: Page) {}

  async openCourse(courseId: string): Promise<void> {
    const rowSelector = `[data-course-id="${courseId}"]`;
    await this.page.locator(rowSelector).click();
    await this.page.waitForURL(`/admin/beta-courses/${courseId}`);
  }

  async verifyCoursePage(page: Page, courseId: string): Promise<void> {
    const currentUrl = page.url();
    expect(currentUrl).toMatch(`/admin/beta-courses/${courseId}`);
  }

  async navigateToNewCoursePage(page: Page): Promise<void> {
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.createNew, "i") }).click();
    await page.waitForURL("/admin/beta-courses/new");
  }

  async fillCourseForm(page: Page): Promise<void> {
    await page.getByLabel(NEW_COURSE.label.title).fill(NEW_COURSE.title);

    await page.getByLabel(NEW_COURSE.label.category).click();
    await page.locator('[data-testid="category-option-E2E Testing"]').click();

    await page.locator("#description").getByRole("paragraph").fill(NEW_COURSE.description);

    // const fileInput = await page.locator('input[type="file"]');
    // const filePath = "app/assets/thumbnail-e2e.jpg";
    // await fileInput.setInputFiles(filePath);
  }

  async addChapter(page: Page, chapterTitle: string): Promise<string> {
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.addChapter, "i") }).click();
    await page.getByLabel(NEW_COURSE.label.title).fill(chapterTitle);

    const createChapterResponsePromise = page.waitForResponse(
      (response) => {
        return (
          response.url().includes("/api/chapter/beta-create-chapter") && response.status() === 201
        );
      },
      { timeout: 60000 },
    );

    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();
    const createChapterResponse = await createChapterResponsePromise;
    const createChapterResJson = await createChapterResponse.json();
    return createChapterResJson.data.id;
  }

  async addContentLesson(
    page: Page,
    chapterLocator: Locator,
    lessonTitle: string,
    lessonDescription: string,
  ): Promise<void> {
    await chapterLocator
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.addLesson, "i") })
      .click();

    const buttonWithText = await page.locator(`h3:has-text("${NEW_COURSE.lessonType.content}")`);
    const lessonButton = buttonWithText.locator("..");
    await lessonButton.click();

    await page.getByLabel(NEW_COURSE.label.title).fill(lessonTitle);

    const descriptionField = page.locator("#description");
    const editorInput = descriptionField.locator('div[contenteditable="true"]');
    await expect(editorInput).toBeVisible();
    await editorInput.click();
    await page.keyboard.type(lessonDescription, { delay: 5 });
    await expect(editorInput).toHaveText(lessonDescription);
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();
  }

  async addQuiz(page: Page, chapterLocator: Locator): Promise<void> {
    await chapterLocator
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.addLesson, "i") })
      .click();
    const buttonWithText = await page.locator(`h3:has-text("${NEW_COURSE.lessonType.quiz}")`);
    const lessonButton = buttonWithText.locator("..");
    await lessonButton.click();
    await page.getByLabel(NEW_COURSE.label.title).fill(NEW_COURSE.lessons.quizTitle);
  }

  async addQuestion(
    page: Page,
    questionType: string,
    questionTitle: string,
    questionIndex: number,
  ): Promise<void> {
    await expect(
      page.getByRole("button", { name: new RegExp(NEW_COURSE.button.addQuestion, "i") }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.addQuestion, "i") })
      .click();
    await expect(page.getByRole("button", { name: new RegExp(questionType, "i") })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(questionType, "i") }).click();
    await page.locator(`input[name="questions.${questionIndex}.title"]`).fill(questionTitle);
  }

  async addOptionsAndFillAnswerQuestion(
    questionIndex: number,
    multipleChoice: boolean = false,
  ): Promise<void> {
    const options = multipleChoice
      ? NEW_COURSE.options.multipleChoice
      : NEW_COURSE.options.singleChoice;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const optionTextLocator = `input[name="questions.${questionIndex}.options.${i}.optionText"]`;
      const optionIsCorrectLocator = `input[name="questions.${questionIndex}.options.${i}.isCorrect"]`;

      await this.page.locator(optionTextLocator).fill(option.text);

      if (option.isCorrect) {
        if (multipleChoice) {
          await this.page.locator(optionIsCorrectLocator).locator("..").locator("button").click();
        } else {
          await this.page.locator(optionIsCorrectLocator).click();
        }
      }

      if (i >= 1 && i < options.length - 1) {
        await this.page.getByTestId(`add-options-button-${questionIndex}`).click();
      }
    }
  }
  async addTrueOrFalseQuestion(
    page: Page,
    questionIndex: number,
    correctAnswerIndex: number,
  ): Promise<void> {
    await page.getByTestId(`add-options-button-${questionIndex}`).click();
    await page.getByTestId(`add-options-button-${questionIndex}`).click();

    for (let i = 0; i < NEW_COURSE.options.trueOrFalse.length; i++) {
      await page
        .locator(`input[name="questions.${questionIndex}.options.${i}.optionText"]`)
        .fill(NEW_COURSE.options.trueOrFalse[i]);
    }
    await page
      .locator(`input[name="questions.${questionIndex}.options.${correctAnswerIndex}.isCorrect"]`)
      .first()
      .click();
  }
  async addMatchingQuestion(page: Page, questionIndex: number): Promise<void> {
    await page.getByTestId(`add-options-button-${questionIndex}`).click();

    for (let i = 0; i < NEW_COURSE.options.matching.length; i++) {
      const option = NEW_COURSE.options.matching[i];
      await page
        .locator(`input[name="questions.${questionIndex}.options.${i}.optionText"]`)
        .fill(option.optionText);
      await page
        .locator(`input[name="questions.${questionIndex}.options.${i}.matchedWord"]`)
        .fill(option.matchedWord);
    }
  }
  async addScaleQuestion(page: Page, questionIndex: number): Promise<void> {
    await page.getByTestId(`add-options-button-${questionIndex}`).click();
    await page.getByTestId(`add-options-button-${questionIndex}`).click();

    for (let i = 0; i < NEW_COURSE.options.scale.length; i++) {
      await page
        .locator(`input[name="questions.${questionIndex}.options.${i}.optionText"]`)
        .fill(NEW_COURSE.options.scale[i]);
    }
  }
  async addPhotoQuestion(
    page: Page,
    questionIndex: number,
    imagePath: string,
    correctOptionIndex: number,
  ): Promise<void> {
    await page.getByTestId(`add-options-button-${questionIndex}`).click();

    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(imagePath);
    await page.locator("text=Click to replace").waitFor({ state: "visible" });

    for (let i = 0; i < NEW_COURSE.options.photoOptions.length; i++) {
      await page
        .locator(`input[name="questions.${questionIndex}.options.${i}.optionText"]`)
        .fill(NEW_COURSE.options.photoOptions[i]);
    }

    await page
      .locator(`input[name="questions.${questionIndex}.options.${correctOptionIndex}.isCorrect"]`)
      .click();
  }

  async addFillInTheBlankQuestion(page: Page, word: string) {
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.addWords, "i") }).click();

    await page.locator('[data-testid="new-word-input"]').waitFor({ state: "visible" });
    await page.locator('[data-testid="add-word"]').waitFor({ state: "visible" });
    await page.locator('[data-testid="new-word-input"]').fill(word);
    await page.locator('[data-testid="add-word"]').click();

    const draggableElement = page.getByTestId(`drag-${word}`);
    await draggableElement.waitFor({ state: "visible" });

    const editableElement = page.locator('div[contenteditable="true"]');
    await editableElement.click();

    await page.keyboard.type(NEW_COURSE.lessons.fillInTheBlankDescription, { delay: 5 });

    await draggableElement.dragTo(editableElement);
  }

  async addPresentationLesson(
    page: Page,
    chapterLocator: Locator,
    lessonTitle: string,
    lessonDescription: string,
  ) {
    await chapterLocator
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.addLesson, "i") })
      .click();

    const buttonWithText = await page.locator(
      `h3:has-text("${NEW_COURSE.lessonType.presentation}")`,
    );
    const lessonButton = buttonWithText.locator("..");
    await lessonButton.click();

    await page.getByLabel(NEW_COURSE.label.title).fill(lessonTitle);
    const fileInput = await page.locator('input[type="file"]');
    const filePath = "app/assets/presentation-e2e.pptx";
    await fileInput.setInputFiles(filePath);
    await page.getByLabel(NEW_COURSE.label.description).fill(lessonDescription);

    await page
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.removePresentation, "i") })
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();

    await expect(chapterLocator.locator(`div[aria-label="Lesson: ${lessonTitle}"]`)).toBeVisible();
  }
  async addVideoLesson(
    page: Page,
    chapterLocator: Locator,
    lessonTitle: string,
    lessonDescription: string,
  ) {
    await chapterLocator
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.addLesson, "i") })
      .click();

    const buttonWithTextVideo = await page.locator(`h3:has-text("${NEW_COURSE.lessonType.video}")`);
    const lessonVideoButton = buttonWithTextVideo.locator("..");
    await lessonVideoButton.click();

    await page.getByLabel(NEW_COURSE.label.title).fill(lessonTitle);
    const fileInputVideo = await page.locator('input[type="file"]');
    const filePathVideo = "app/assets/video-e2e.mp4";
    await fileInputVideo.setInputFiles(filePathVideo);
    await page.getByLabel(NEW_COURSE.label.description).fill(lessonDescription);

    await page
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.removeVideo, "i") })
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();

    await expect(chapterLocator.locator(`div[aria-label="Lesson: ${lessonTitle}"]`)).toBeVisible();
  }
  async editChapter(page: Page, chapterName: string, newChapterTitle: string) {
    await page.locator(`text=${chapterName}`).click();
    await page.getByLabel(NEW_COURSE.label.title).fill(newChapterTitle);
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();
    await page.locator(`text=${newChapterTitle}`).waitFor({ state: "visible" });
  }

  async editContentLesson(page: Page) {
    const lessonLocator = page.locator(`text=${NEW_COURSE.lessons.contentLessonTitle}`);
    await lessonLocator.click();
    await page.getByLabel(NEW_COURSE.label.title).fill(NEW_COURSE.editedLesson.contentLessonTitle);
    const descriptionField = page.locator("#description");
    const editorInput = descriptionField.locator('div[contenteditable="true"]');
    await expect(editorInput).toBeVisible();
    await editorInput.click();
    await page.keyboard.type(NEW_COURSE.editedLesson.contentLessonDescription, { delay: 5 });
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();
    await page
      .locator(`text=${NEW_COURSE.editedLesson.contentLessonTitle}`)
      .waitFor({ state: "visible" });
  }

  async editPresentationLesson(page: Page) {
    const lessonLocator = page.locator(`text=${NEW_COURSE.lessons.presentationLessonTitle}`);
    await lessonLocator.click();
    await page
      .getByLabel(NEW_COURSE.label.title)
      .fill(NEW_COURSE.editedLesson.presentationLessonTitle);
    const removeButton = page.getByRole("button", {
      name: new RegExp(NEW_COURSE.button.removePresentation, "i"),
    });
    await removeButton.click();
    await removeButton.waitFor({ state: "hidden" });

    const fileInputVideo = await page.locator('input[type="file"]');
    const filePathVideo = "app/assets/presentation-e2e.pptx";
    await fileInputVideo.setInputFiles(filePathVideo);

    await removeButton.waitFor({ state: "visible" });
    await page
      .getByLabel(NEW_COURSE.label.description)
      .fill(NEW_COURSE.editedLesson.presentationLessonDescription);
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();
    await page
      .locator(`text=${NEW_COURSE.editedLesson.presentationLessonTitle}`)
      .waitFor({ state: "visible" });
  }

  async editQuizTitle(page: Page) {
    const lessonLocator = page.locator(`text=${NEW_COURSE.lessons.quizTitle}`);
    await lessonLocator.click();
    await page.getByLabel(NEW_COURSE.label.title).fill(NEW_COURSE.editedLesson.quizTitle);
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();
    await page.locator(`text=${NEW_COURSE.editedLesson.quizTitle}`).waitFor({ state: "visible" });
  }

  async editVideoLesson(page: Page) {
    const lessonLocator = page.locator(`text=${NEW_COURSE.lessons.videoLessonTitle}`);
    await lessonLocator.click();
    await page.getByLabel(NEW_COURSE.label.title).fill(NEW_COURSE.editedLesson.videoLessonTitle);
    const removeButton = page.getByRole("button", {
      name: new RegExp(NEW_COURSE.button.removeVideo, "i"),
    });
    await removeButton.click();
    await removeButton.waitFor({ state: "hidden" });

    const fileInputVideo = await page.locator('input[type="file"]');
    const filePathVideo = "app/assets/video-e2e.mp4";
    await fileInputVideo.setInputFiles(filePathVideo);

    await removeButton.waitFor({ state: "visible" });
    await page
      .getByLabel(NEW_COURSE.label.description)
      .fill(NEW_COURSE.editedLesson.videoLessonDescription);

    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();
    await page
      .locator(`text=${NEW_COURSE.editedLesson.videoLessonTitle}`)
      .waitFor({ state: "visible" });
  }
}

test.describe.serial("Course management", () => {
  let createCourseActions: CreateCourseActions;
  let newCourseId: string;
  let newChapterId: string;

  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/courses");
    createCourseActions = new CreateCourseActions(page);
  });

  test("should click cancel button and back to the course list", async ({ page }) => {
    await createCourseActions.navigateToNewCoursePage(page);

    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.cancel, "i") }).click();
    await page.waitForURL("/admin/courses");

    const currentUrl = await page.url();
    expect(currentUrl).toMatch("/admin/courses");
  });

  test("should disable the proceed button when form is incomplete", async ({ page }) => {
    await createCourseActions.navigateToNewCoursePage(page);

    const proceedButton = page.getByRole("button", {
      name: new RegExp(NEW_COURSE.button.proceed, "i"),
    });

    await expect(proceedButton).toBeDisabled();

    await createCourseActions.fillCourseForm(page);
    await expect(proceedButton).not.toBeDisabled();
  });

  test("should create a new course with chapter and lesson", async ({ page }) => {
    await createCourseActions.navigateToNewCoursePage(page);

    await createCourseActions.fillCourseForm(page);

    const proceedButton = page.getByRole("button", {
      name: new RegExp(NEW_COURSE.button.proceed, "i"),
    });

    await expect(proceedButton).not.toBeDisabled();

    const courseResponsePromise = page.waitForResponse(
      (response) => {
        return response.url().includes("/api/course") && response.status() === 201;
      },
      { timeout: 60000 },
    );

    await proceedButton.click();

    const courseResponse = await courseResponsePromise;

    const courseResJson = await courseResponse.json();
    newCourseId = courseResJson.data.id;

    await page.waitForURL(`admin/beta-courses/${newCourseId}`);
    await createCourseActions.verifyCoursePage(page, newCourseId);

    newChapterId = await createCourseActions.addChapter(page, NEW_COURSE.chapter.title);

    const chapterLocator = page.locator(`[data-chapter-id="${newChapterId}"]`);
    await expect(chapterLocator).toBeVisible();

    await createCourseActions.addContentLesson(
      page,
      chapterLocator,
      NEW_COURSE.lessons.contentLessonTitle,
      NEW_COURSE.lessons.contentLessonDescription,
    );
    await expect(
      chapterLocator.locator(`div[aria-label="Lesson: ${NEW_COURSE.lessons.contentLessonTitle}"]`),
    ).toBeVisible();

    // await createCourseActions.addPresentationLesson(
    //   page,
    //   chapterLocator,
    //   NEW_COURSE.lessons.presentationLessonTitle,
    //   NEW_COURSE.lessons.presentationLessonDescription,
    // );

    // await createCourseActions.addVideoLesson(
    //   page,
    //   chapterLocator,
    //   NEW_COURSE.lessons.videoLessonTitle,
    //   NEW_COURSE.lessons.presentationLessonTitle,
    // );

    await createCourseActions.addQuiz(page, chapterLocator);

    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.freeText,
      NEW_COURSE.questions.freeText,
      0,
    );
    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.shortAnswer,
      NEW_COURSE.questions.shortAnswer,
      1,
    );

    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.singleChoice,
      NEW_COURSE.questions.singleChoice,
      2,
    );
    await createCourseActions.addOptionsAndFillAnswerQuestion(2);

    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.mutlipleChoice,
      NEW_COURSE.questions.multipleChoice,
      3,
    );
    await createCourseActions.addOptionsAndFillAnswerQuestion(3, true);

    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.trueOrFalse,
      NEW_COURSE.questions.trueOrFalse,
      4,
    );
    await createCourseActions.addTrueOrFalseQuestion(page, 4, 1);

    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.matching,
      NEW_COURSE.questions.matching,
      5,
    );
    await createCourseActions.addMatchingQuestion(page, 5);

    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.scale,
      NEW_COURSE.questions.scale,
      6,
    );

    await createCourseActions.addScaleQuestion(page, 6);

    // await createCourseActions.addQuestion(
    //   page,
    //   NEW_COURSE.questionType.photoQuestion,

    //   NEW_COURSE.questions.photoQuestion,
    //   7,
    // );
    // const imagePath = "app/assets/thumbnail-e2e.jpg";
    // await createCourseActions.addPhotoQuestion(page, 7, imagePath, 2);

    await createCourseActions.addQuestion(
      page,
      NEW_COURSE.questionType.fillInTheBlanks,
      NEW_COURSE.questions.fillInTheBlank,
      7,
    );
    await createCourseActions.addFillInTheBlankQuestion(page, "CSS");
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.save, "i") }).click();

    const quizLocator = chapterLocator.locator(
      `div[aria-label="Lesson: ${NEW_COURSE.lessons.quizTitle}"]`,
    );
    await expect(quizLocator).toBeVisible();
  });

  test("should check if course occurs on course list", async ({ page }) => {
    await createCourseActions.openCourse(newCourseId);

    await createCourseActions.verifyCoursePage(page, newCourseId);
  });

  test("should edit chapter and lessons", async ({ page }) => {
    await createCourseActions.openCourse(newCourseId);
    await createCourseActions.editChapter(
      page,
      NEW_COURSE.chapter.title,
      NEW_COURSE.chapter.editedTitle,
    );
    await createCourseActions.editContentLesson(page);
    await createCourseActions.editQuizTitle(page);
  });

  test("should remove questions from chapter and save.", async ({ page }) => {
    await createCourseActions.openCourse(newCourseId);
    await page.click(`[data-testid='accordion - ${newChapterId}']`);
    const quizLocator = page.locator(`text=${NEW_COURSE.editedLesson.quizTitle}`);
    await quizLocator.waitFor();
    await quizLocator.click();

    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.delete, "i") }).click();
    const dialogLocator = page.locator(
      `div[role="dialog"]:has(h2:text("${NEW_COURSE.dialog.deleteQuiz}"))`,
    );
    await dialogLocator.waitFor();

    await dialogLocator
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.delete, "i") })
      .click();

    await page.waitForTimeout(2000);

    await expect(quizLocator).not.toBeVisible();
  });

  test("should check if freemium works", async ({ page }) => {
    await createCourseActions.openCourse(newCourseId);

    await page.waitForSelector(`[data-testid="Freemium - ${newChapterId}"]`, { state: "attached" });
    await page.locator(`[data-testid="Freemium - ${newChapterId}"]`).click();

    await page.waitForTimeout(3000);

    const chapterLocator = page.locator(`[data-chapter-id="${newChapterId}"]`);
    await chapterLocator.waitFor({ state: "visible" });

    await expect(
      await page.locator(`[data-testid="Freemium - ${newChapterId}"]`).getAttribute("data-state"),
    ).toBe("checked");
  });

  test("should remove chapter with all lessons.", async ({ page }) => {
    await createCourseActions.openCourse(newCourseId);
    await page.locator(`text=${NEW_COURSE.chapter.editedTitle}`).click();
    await page.getByRole("button", { name: new RegExp(NEW_COURSE.button.delete, "i") }).click();
    const dialogLocator = page.locator(
      `div[role="dialog"]:has(h2:text("${NEW_COURSE.dialog.deleteChapter}"))`,
    );
    await dialogLocator.waitFor();
    await dialogLocator
      .getByRole("button", { name: new RegExp(NEW_COURSE.button.delete, "i") })
      .click();

    await page.waitForTimeout(2000);

    await expect(page.locator(`text=${NEW_COURSE.chapter.editedTitle}`)).not.toBeVisible();
  });
});
