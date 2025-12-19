import path from "path";

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

const TEST_DATA = {
  base: {
    titleEn: "title",
    titlePl: "Polish course title",
    descEn: "description",
    descPl: "polish course description",
    category: "Web Development",
    intro: "opis",
  },
  chapters: ["chapter 1", "2", "3"],
  lessons: {
    text: "title",
    video: {
      title: "video title",
      file: path.join(process.cwd(), "app/assets/video-e2e.mp4"),
      description: "description",
    },
    presentation: {
      title: "presentation title",
      file: path.join(process.cwd(), "app/assets/presentation-e2e.pptx"),
      description: "desc",
    },
    quiz: { title: "Cars quiz", score: "50" },
    aiMentor: "AI Mentor lesson",
    embed: "embed lesson",
  },
  student: { email: "student0@example.com", password: "password" },
  admin: { email: "admin@example.com", password: "password" },
};

const selectLanguage = async (page: Page) => {
  await expect(
    page.getByRole("heading", { name: `${TEST_DATA.base.titleEn} Draft` }),
  ).toBeVisible();
  await page.getByRole("combobox").click();
  await page.getByText("Polish").click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("* Course title").click();
  await page.getByLabel("* Course title").fill(TEST_DATA.base.titlePl);
  await page.locator("#description").getByRole("paragraph").click();
  await page.locator("#description div").fill(TEST_DATA.base.descPl);
  await page.locator("#description div").press("ControlOrMeta+ArrowRight");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: `${TEST_DATA.base.titlePl} Draft` }),
  ).toBeVisible();
  await page.locator("button").filter({ hasText: "Polish" }).click();
  await page.getByText("English").click();
  await expect(
    page.getByRole("heading", { name: `${TEST_DATA.base.titleEn} Draft` }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Curriculum" }).click();
};

const createCourse = async (page: Page) => {
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.locator(".h-min > button:nth-child(2)").click();
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByPlaceholder("Enter title").click();
  await page.getByPlaceholder("Enter title").fill(TEST_DATA.base.titleEn);
  await page.getByLabel("* Category").click();
  await page
    .getByTestId(`category-option-${TEST_DATA.base.category}`)
    .getByText(TEST_DATA.base.category)
    .click();
  await page.locator("button").filter({ hasText: "English" }).click();
  await page.getByLabel("Polish").getByText("Polish").click();
  await page.locator("#description").getByRole("paragraph").click();
  await page.locator("#description div").fill(TEST_DATA.base.intro);
  await page.locator("button").filter({ hasText: "Polish" }).click();
  await page.getByLabel("English").getByText("English").click();
  await page.getByText(TEST_DATA.base.intro).click();
  await page.locator("#description div").fill(TEST_DATA.base.descEn);
  await page.getByRole("button", { name: "Proceed" }).click();
};

const addChapters = async (page: Page) => {
  const addChapterButton = page.getByRole("button", { name: "Add chapter" }).first();
  await expect(addChapterButton).toBeVisible();

  for (const title of TEST_DATA.chapters) {
    await addChapterButton.click();
    const chapterTitleInput = page.getByLabel(NEW_COURSE.label.title, { exact: false }).first();
    await chapterTitleInput.waitFor({ state: "visible" });
    await chapterTitleInput.fill(title);
    await expect(chapterTitleInput).toHaveValue(title);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(addChapterButton).toBeVisible();
  }

  const freemiumSwitch = /^Freemium - [0-9a-fA-F-]{36}$/;
  await page.getByTestId(freemiumSwitch).nth(0).click();
  await page.getByTestId(freemiumSwitch).nth(1).click();
  await page.getByTestId(freemiumSwitch).nth(2).click();
};

const addLessonsToFirstChapter = async (page: Page) => {
  await page.getByLabel("Notifications (F8)").getByRole("button").click();

  // Text lesson
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const textLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.text lesson type",
  );
  await expect(textLessonType).toBeVisible();
  await textLessonType.click();
  await page.getByPlaceholder("Provide lesson title...").fill(TEST_DATA.lessons.text);
  await page.getByRole("paragraph").click();
  await page.locator("#description div").fill("content");
  await page.getByText("content").click();
  await page.locator("#description div").fill("content\n\nheader");
  await page.getByText("contentheader").click();
  await page.getByText("contentheader").dblclick();
  await page.getByLabel("Curriculum").getByRole("combobox").click();
  await page.getByLabel("H1").getByText("H1").click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Lesson: title")).toBeVisible();

  // Video lesson
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const videoLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.video lesson type",
  );
  await expect(videoLessonType).toBeVisible();
  await videoLessonType.click();
  await page.getByPlaceholder("Provide lesson title...").fill(TEST_DATA.lessons.video.title);
  const videoFileChooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.getByText("Click to upload or drag and", { exact: false }).first().click();
  const videoFileChooser = await videoFileChooserPromise;
  await videoFileChooser.setFiles(TEST_DATA.lessons.video.file);
  await page.locator("html").click();
  await page
    .getByPlaceholder("Provide description about the")
    .fill(TEST_DATA.lessons.video.description);
  const removeVideoButton = page.getByRole("button", { name: "Remove video" });
  await removeVideoButton.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByPlaceholder("Provide lesson title...")).toHaveValue(
    TEST_DATA.lessons.video.title,
  );

  // Presentation lesson
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const presentationLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.presentation lesson type",
  );
  await expect(presentationLessonType).toBeVisible();
  await presentationLessonType.waitFor({ state: "visible" });
  await expect(presentationLessonType).toBeEnabled();
  await presentationLessonType.click({ force: true });
  await page.getByPlaceholder("Provide lesson title...").fill(TEST_DATA.lessons.presentation.title);
  await page.getByLabel("Curriculum").getByRole("combobox").click();
  await page.getByLabel("Upload file").click();
  const presentationFileChooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.getByText("Click to upload or drag and", { exact: false }).first().click();
  await page
    .getByPlaceholder("Provide description about the")
    .fill(TEST_DATA.lessons.presentation.description);
  await page.getByRole("button", { name: "Save" }).click();
  const presentationFileChooser = await presentationFileChooserPromise;
  await presentationFileChooser.setFiles(TEST_DATA.lessons.presentation.file);
  await expect(page.getByRole("button", { name: "Remove presentation" })).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
};

const buildQuiz = async (page: Page) => {
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const quizLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.quiz lesson type",
  );
  await expect(quizLessonType).toBeVisible();
  await quizLessonType.waitFor({ state: "visible" });
  await quizLessonType.click();
  await page.getByLabel("*Title").fill(TEST_DATA.lessons.quiz.title);
  await page.getByPlaceholder("0").fill(TEST_DATA.lessons.quiz.score);
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Single choice" }).click();
  await page.locator('input[name="questions\\.0\\.title"]').fill("A or B");
  await page.getByPlaceholder("Option 1").fill("A");
  await page.getByPlaceholder("Option 2").fill("B");
  await page.locator('input[name="questions\\.0\\.options\\.0\\.isCorrect"]').check();
  await page.getByTestId("add-options-button-0").click();
  await page
    .locator("li")
    .filter({ hasText: /^CorrectOption text is required$/ })
    .getByRole("img")
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Delete question" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Multiple choice" }).click();
  await page.locator('input[name="questions\\.0\\.title"]').fill("2 or 3");
  await page.locator('input[name="questions\\.0\\.options\\.0\\.optionText"]').fill("2");
  await page.locator('input[name="questions\\.0\\.options\\.1\\.optionText"]').fill("3");
  await page.locator("#isCorrect").first().click();
  await page.locator("#isCorrect").nth(1).click();
  await page.getByTestId("add-options-button-0").click();
  await page.locator('input[name="questions\\.0\\.title"]').fill("2 or 3 or 4");
  await page.getByPlaceholder("Option 3").fill("4");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "True or false" }).click();
  await page.locator('input[name="questions\\.1\\.title"]').fill("true or false");
  await page.locator('input[name="questions\\.1\\.options\\.0\\.optionText"]').click();
  await page.locator('input[name="questions\\.1\\.title"]').fill("questions");
  await page.locator('input[name="questions\\.1\\.options\\.0\\.optionText"]').click();
  await page
    .locator('input[name="questions\\.1\\.options\\.0\\.optionText"]')
    .fill("is it dark or light?");
  await page.getByRole("radio").nth(1).check();
  await page.getByText("False").click();
  await page.getByText("True").click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Photo question" }).click();
  await page.locator('input[name="questions\\.2\\.title"]').fill("dark or light");
  await page.getByTestId("imageUpload").setInputFiles("app/assets/thumbnail-e2e.jpg");
  await page.getByLabel("Curriculum").getByRole("combobox").click();
  await page.getByLabel("Single choice").getByText("Single choice").click();
  await page.getByLabel("Curriculum").getByRole("combobox").click();
  await page.getByLabel("Multiple choice").getByText("Multiple choice").click();
  await page.locator('input[name="questions\\.2\\.options\\.0\\.optionText"]').fill("dark");
  await page.locator('input[name="questions\\.2\\.options\\.1\\.optionText"]').fill("light");
  await page.locator("#isCorrect").nth(3).click();
  await page
    .locator("li")
    .filter({ hasText: "*OptionsClick to replaceor" })
    .locator("label")
    .nth(3)
    .click();
  await page
    .locator("li")
    .filter({ hasText: "*OptionsClick to replaceor" })
    .locator("label")
    .nth(3)
    .click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Fill in the blanks" }).click();
  await page.locator('input[name="questions\\.3\\.title"]').click();
  await page.getByRole("button", { name: "Delete question" }).nth(3).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Free text" }).click();
  await page.locator('input[name="questions\\.3\\.title"]').fill("free text");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Short answer" }).click();
  await page.locator('input[name="questions\\.4\\.title"]').fill("short answer");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Gap fill" }).click();
  await page.locator('input[name="questions\\.5\\.title"]').fill("some cars has");
  await page
    .locator("div")
    .filter({ hasText: /^\*SentenceWrite a sentence and drop words in to it\.$/ })
    .getByRole("textbox")
    .getByRole("paragraph")
    .click();
  await page
    .locator("div")
    .filter({ hasText: /^\*SentenceWrite a sentence and drop words in to it\.$/ })
    .getByRole("textbox")
    .fill("some cars has downpipe and some does not");
  await page.locator('input[name="questions\\.5\\.title"]').fill("some cars has and some does not");
  await page.getByText("some cars has downpipe and").dblclick();
  await page
    .locator("div")
    .filter({ hasText: /^some cars has downpipe and some does not$/ })
    .nth(1)
    .press("ArrowLeft");
  await page
    .locator("div")
    .filter({ hasText: /^some cars has downpipe and some does not$/ })
    .nth(1)
    .press("Alt+ArrowLeft");
  await page
    .locator("div")
    .filter({ hasText: /^some cars has downpipe and some does not$/ })
    .nth(1)
    .press("Alt+ArrowLeft");
  await page
    .locator("div")
    .filter({ hasText: /^some cars has downpipe and some does not$/ })
    .nth(1)
    .press("Alt+ArrowLeft");
  await page
    .locator("div")
    .filter({ hasText: /^some cars has downpipe and some does not$/ })
    .nth(1)
    .press("Alt+ArrowLeft");
  await page
    .locator("div")
    .filter({ hasText: /^some cars has downpipe and some does not$/ })
    .nth(1)
    .press("Alt+Shift+ArrowRight");
  await page
    .locator("div")
    .filter({ hasText: /^some cars has downpipe and some does not$/ })
    .nth(1)
    .fill("some cars has and some does not");
  await page.getByRole("button", { name: "Add words" }).click();
  await page.getByTestId("new-word-input").fill("downpipe");
  await page.getByTestId("add-word").click();
  await page.getByRole("button", { name: "Add words" }).click();
  await page.getByTestId("new-word-input").fill("not");
  await page.getByTestId("add-word").click();
  await page.getByRole("button", { name: "Add words" }).click();
  await page.getByTestId("new-word-input").fill("other");
  await page.getByTestId("add-word").click();
  await expect(
    page.locator("li").filter({ hasText: "This question will have" }).getByRole("textbox").nth(2),
  ).toBeVisible();
  await expect(
    page.locator("li").filter({ hasText: "This question will have" }).getByRole("textbox").nth(3),
  ).toBeVisible();
  await expect(
    page.locator("li").filter({ hasText: "This question will have" }).getByRole("textbox").nth(4),
  ).toBeVisible();
  await page.locator(".flex > div:nth-child(3) > .inline-flex").click();
  await page
    .locator("li")
    .filter({ hasText: "This question will have" })
    .getByRole("textbox")
    .nth(2)
    .click();
  await page.getByTestId("drag-downpipe").click();
  await page.getByTestId("drag-downpipe").click();
  await page.getByText("some cars has and some does").click();
  await page.getByText("some cars has and some does").click();
  await page.getByText("some cars has and some does").click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByTestId("drag-downpipe").click();
  await page.getByTestId("drag-downpipe").click();
  await page.getByRole("button", { name: "Delete question" }).nth(3).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByLabel("Lesson: Cars quiz").click();
  await expect(page.locator('input[name="questions\\.0\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.1\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.2\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.3\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.4\\.title"]')).toBeVisible();
  await expect(page.getByLabel("Lesson: presentation title")).toBeVisible();
  await expect(page.getByLabel("Lesson: video title")).toBeVisible();
};

const addRemainingLessons = async (page: Page) => {
  // AI Mentor
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const aiMentorLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.aiMentor lesson type",
  );
  await aiMentorLessonType.waitFor({ state: "visible" });
  await aiMentorLessonType.click();
  await page.getByPlaceholder("Provide lesson title...").fill(TEST_DATA.lessons.aiMentor);
  await page.locator('input[type="text"]').fill("Mentor");
  await page.getByRole("button", { name: "Problem Solving" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel(`Lesson: ${TEST_DATA.lessons.aiMentor}`)).toBeVisible();

  // Embed
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const embedLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.embed lesson type",
  );
  await embedLessonType.waitFor({ state: "visible" });
  await embedLessonType.click();
  await page.getByPlaceholder("Provide lesson title...").fill(TEST_DATA.lessons.embed);
  await page.getByRole("button", { name: "Add resource" }).click();
  await page.getByPlaceholder("Enter the source URL...").click();
  await page.getByLabel("Allow fullscreen").click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel(`Lesson: ${TEST_DATA.lessons.embed}`)).toBeVisible();
};

const publishAndEnroll = async (page: Page) => {
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByRole("button", { name: "Published" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText("Student", { exact: true }).nth(2).click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();

  const enrollmentErrorResponse = await page
    .waitForResponse((response) => response.status() >= 500, { timeout: 3000 })
    .catch(() => null);

  if (enrollmentErrorResponse) {
    throw new Error(
      `Student enrollment failed with ${enrollmentErrorResponse.status()} on ${enrollmentErrorResponse.url()}`,
    );
  }
};

const studentCompletesCourse = async (page: Page) => {
  await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
  await page.getByPlaceholder("user@example.com").fill(TEST_DATA.student.email);
  await page.getByLabel("Password").fill(TEST_DATA.student.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Courses", exact: true }).click();
  await page.getByTestId("title").click();
  await expect(page.getByRole("tab", { name: "Statistics" })).toBeHidden();
  await page.getByTestId("chapter 1").click();
  await page.getByRole("link", { name: "title Text Not Started" }).click();
  await expect(
    page
      .locator("div")
      .filter({ hasText: /^contentheader$/ })
      .nth(1),
  ).toBeVisible();
  await page.getByTestId("next-lesson-button").click();
  await page.getByRole("link", { name: "presentation title" }).click();
  await expect(page.getByText("presentation title").first()).toBeVisible();
  await page.getByTestId("next-lesson-button").click();
  await expect(page.getByText("Cars quiz").first()).toBeVisible();
  await expect(page.locator("div").filter({ hasText: /^Lesson 4\/6 – Quiz$/ })).toBeVisible();
  await page.locator("label").filter({ hasText: "2" }).nth(1).click();
  await page.locator("label").filter({ hasText: "3" }).nth(1).click();
  await page.getByText("True", { exact: true }).click();
  await page.locator("label").filter({ hasText: "dark" }).first().click();
  await page.getByTestId("detailed-response").fill("free text");
  await page.getByTestId("brief-response").fill("short naswer");
  await page.getByTestId("brief-response").press("Alt+Shift+ArrowLeft");
  await page.getByTestId("brief-response").fill("short answer");
  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByTestId("next-lesson-button").click();
  await expect(page.getByText("Lesson 5/6 – Ai MentorBeta")).toBeVisible();
  await expect(page.getByText(TEST_DATA.lessons.aiMentor).first()).toBeVisible();
  const messageInput = page.getByPlaceholder("Write a message...");
  const sendButton = page.getByRole("button", { name: "Send" });

  const firstMessage =
    "I value the effort and results you’ve delivered. I understand why you’re asking, and I want to find a way to recognize your contributions even with our current budget constraints.";
  await messageInput.fill(firstMessage);
  await expect(messageInput).toHaveValue(firstMessage);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  const secondMessage =
    "offer a funded professional development plan (e.g., a course or certification of their choice) with dedicated time to complete it, signaling investment in their growth even before a salary change is possible";
  await messageInput.fill(secondMessage);
  await expect(messageInput).toHaveValue(secondMessage);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  const thirdMessage =
    "Let’s revisit compensation at the next review cycle in X months, or sooner if we hit A/B/C milestones (e.g., revenue target, project delivery, budget reset). I’ll keep you updated quarterly so you’re never in the dark.";
  await messageInput.fill(thirdMessage);
  await expect(messageInput).toHaveValue(thirdMessage);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await page.getByRole("button", { name: "Check" }).click();
  await page.getByRole("link", { name: "embed lesson Embed" }).click();
  await expect(page.locator("div").filter({ hasText: /^Lesson 6\/6 – Embed$/ })).toBeVisible();
  await expect(page.getByText(TEST_DATA.lessons.embed).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "chapter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3" })).toBeVisible();
};

const verifyAdminStats = async (page: Page) => {
  await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
  await page.getByPlaceholder("user@example.com").fill(TEST_DATA.admin.email);
  await page.getByLabel("Password").fill(TEST_DATA.admin.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Courses", exact: true }).click();
  await page.getByTestId("title").click();
  await page.getByRole("tab", { name: "Statistics" }).click();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByText("In Progress")).toBeVisible();
  await expect(page.getByText("Enrolled students count")).toBeVisible();
  await expect(page.locator("p").filter({ hasText: "1" })).toBeVisible();
  await expect(page.getByText("/6")).toBeVisible();
  await page.getByRole("tab", { name: "Quiz Results" }).click();
  await page.getByRole("tab", { name: "AI Mentor Results" }).click();
  await page.getByRole("tab", { name: "Progress" }).click();
  await expect(page.getByRole("cell", { name: "Avatar for email@example.com" })).toBeVisible();
};

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

    const currentUrl = page.url();
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

  test("should create a new course, few chapters with every lesson type", async ({ page }) => {
    await createCourse(page);
    await selectLanguage(page);
    await addChapters(page);
    await addLessonsToFirstChapter(page);
    await buildQuiz(page);
    await addRemainingLessons(page);
    await publishAndEnroll(page);
    await studentCompletesCourse(page);
    await verifyAdminStats(page);
  });
});
