import path from "path";

import { test, expect, type Page } from "@playwright/test";

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
    content: "title",
    video: {
      file: path.join(process.cwd(), "app/assets/video-e2e.mp4"),
    },
    presentation: {
      file: path.join(process.cwd(), "app/assets/presentation-e2e.pptx"),
    },
    quiz: { title: "Cars quiz", score: "50" },
    aiMentor: "AI Mentor lesson",
    embed: "embed lesson",
  },
  fillInTheBlanks: {
    sentence: "some words are ",
    sentenceExact: "some words are",
    missingWord: "missing",
    gapWord: "missing v2",
  },
  student: { email: "student0@example.com", password: "password" },
  admin: { email: "admin@example.com", password: "password" },
  regex: {
    lessonResource: /.*\/api\/lesson\/lesson-resource.*$/,
  },
};

const waitForGenerateMissingTranslationsOrContent = async (page: Page) => {
  const translationHeading = page.getByRole("heading", { name: "Generate missing translations" });
  const addContentHeading = page.getByRole("heading", { name: "Add content to your chapter" });

  const translationWatcher = translationHeading
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => "translation")
    .catch(() => null);
  const contentWatcher = addContentHeading
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => "content")
    .catch(() => null);

  const firstVisible = await Promise.race([translationWatcher, contentWatcher]);
  if (firstVisible === "translation") {
    await page.getByRole("button", { name: "Confirm" }).click();
  }

  await addContentHeading.waitFor({ state: "visible", timeout: 10000 });
  await expect(addContentHeading).toBeVisible();
};

const selectLanguage = async (page: Page) => {
  await expect(
    page.getByRole("heading", { name: `${TEST_DATA.base.titleEn} Draft` }),
  ).toBeVisible();
  await page.getByRole("combobox").click();
  await page.getByText("Polish").click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await waitForGenerateMissingTranslationsOrContent(page);
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
  await page.waitForURL(/\/admin\/beta-courses\/[0-9a-fA-F-]{36}$/);
};

const addChapters = async (page: Page) => {
  const addChapterButton = page.getByRole("button", { name: "Add chapter" }).first();
  await expect(addChapterButton).toBeVisible();

  for (const title of TEST_DATA.chapters) {
    await addChapterButton.click();
    const chapterTitleInput = page.getByLabel("* Title");
    await chapterTitleInput.waitFor({ state: "visible", timeout: 10000 });
    await chapterTitleInput.fill(title);
    await expect(chapterTitleInput).toHaveValue(title);
    const saveButton = page.getByRole("button", { name: "Save" });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();
    await page.getByLabel("Notifications (F8)").getByRole("button").click();
    await expect(addChapterButton).toBeVisible();
    const addContentHeading = page.getByRole("heading", { name: "Add content to your chapter" });
    await addContentHeading.waitFor({ state: "visible", timeout: 10000 });
    await expect(addContentHeading).toBeVisible();
  }

  const freemiumSwitch = /^Freemium - [0-9a-fA-F-]{36}$/;
  await page.getByTestId(freemiumSwitch).nth(0).click();
  await page.getByTestId(freemiumSwitch).nth(1).click();
  await page.getByTestId(freemiumSwitch).nth(2).click();
};

const addLessonsToFirstChapter = async (page: Page) => {
  await page.getByLabel("Notifications (F8)").getByRole("button").click();

  // Content lesson
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  const contentLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.content lesson type",
  );
  await expect(contentLessonType).toBeVisible();
  await contentLessonType.click();
  await page.getByPlaceholder("Provide lesson title...").fill(TEST_DATA.lessons.content);
  await page.getByRole("paragraph").click();
  await page.locator("#description div").fill("content");
  await page
    .getByText("content", {
      exact: true,
    })
    .click();
  await page.locator("#description div").fill("content header");
  await page.getByText("content header").click();
  await page.getByText("content header").dblclick();
  await page.getByLabel("Curriculum").getByRole("combobox").click();
  await page.getByLabel("Heading 1").getByText("Heading").click();
  await page.getByRole("button", { name: "Save" }).click();
  const addContentHeading = page.getByRole("heading", { name: "Add content to your chapter" });
  await addContentHeading.waitFor({ state: "visible", timeout: 10000 });
  await expect(addContentHeading).toBeVisible();
  await expect(page.getByLabel("Lesson: title")).toBeVisible();

  await page.getByLabel("Lesson: title").click();

  const uploadButton = page.locator("button:nth-child(2) > .inline-flex");
  await uploadButton.waitFor({ state: "visible" });
  await uploadButton.click();
  const videoFileInput = page.locator('input[type="file"]').first();
  await videoFileInput.waitFor({ state: "attached" });
  await videoFileInput.setInputFiles(TEST_DATA.lessons.video.file);
  const removeToastBtn = page.getByLabel("Notifications (F8)").getByRole("button");
  removeToastBtn.waitFor({ state: "visible" });
  removeToastBtn.click();

  const removeVideoBtn = page.getByLabel("Remove video embed");
  await removeVideoBtn.waitFor({ state: "visible" });
  await expect(removeVideoBtn).toBeVisible();
  await expect(removeVideoBtn).toHaveCount(1);

  await uploadButton.click();
  const presentationFileInput = page.locator('input[type="file"]').first();
  await presentationFileInput.waitFor({ state: "attached" });
  await presentationFileInput.setInputFiles(TEST_DATA.lessons.presentation.file);
  const removeToastBtn2 = page.getByLabel("Notifications (F8)").getByRole("button");
  removeToastBtn2.waitFor({ state: "visible" });
  removeToastBtn2.click();
  const removePresentationBtn = page.getByLabel("Remove presentation embed");
  await removePresentationBtn.waitFor({ state: "visible" });
  await expect(removePresentationBtn).toBeVisible();
  await expect(removePresentationBtn).toHaveCount(1);
  await page.getByRole("button", { name: "Save" }).click();
  const addContentHeading2 = page.getByRole("heading", { name: "Add content to your chapter" });
  await addContentHeading2.waitFor({ state: "visible", timeout: 10000 });
  await expect(addContentHeading2).toBeVisible();
};

const buildQuiz = async (page: Page) => {
  await page.getByRole("button", { name: "Add lesson" }).first().click();
  await page.waitForTimeout(500);
  const quizLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.quiz lesson type",
  );
  await expect(quizLessonType).toBeVisible();
  await quizLessonType.waitFor({ state: "visible" });
  await quizLessonType.click();
  await page.getByLabel("*Title").fill(TEST_DATA.lessons.quiz.title);
  await page.getByPlaceholder("0").fill(TEST_DATA.lessons.quiz.score);
  await page.getByRole("button", { name: "Add question" }).waitFor({ state: "visible" });

  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Single choice" }).click();
  await page.locator('input[name="questions\\.0\\.title"]').click();
  await page.locator('input[name="questions\\.0\\.title"]').fill("single choice?");
  await page.getByPlaceholder("Option 1").click();
  await page.getByPlaceholder("Option 1").fill("yes");
  await page.getByPlaceholder("Option 2").click();
  await page.getByPlaceholder("Option 2").fill("no");
  await expect(page.getByText("At least one option must be")).toBeVisible();
  await page.locator('input[name="questions\\.0\\.options\\.0\\.isCorrect"]').check();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Multiple choice" }).click();
  await page.locator('input[name="questions\\.1\\.title"]').click();
  await page.locator('input[name="questions\\.1\\.title"]').fill("what kind of cars are good?");
  await page.locator('input[name="questions\\.1\\.options\\.0\\.optionText"]').click();
  await page.locator('input[name="questions\\.1\\.options\\.0\\.optionText"]').click();
  await page.locator('input[name="questions\\.1\\.options\\.0\\.optionText"]').fill("black");
  await page.locator('input[name="questions\\.1\\.options\\.1\\.optionText"]').click();
  await page.locator('input[name="questions\\.1\\.options\\.1\\.optionText"]').fill("white");
  await page.locator("#isCorrect").first().click();
  await page.locator("#isCorrect").nth(1).click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "True or false" }).click();
  await page.locator('input[name="questions\\.2\\.title"]').click();
  await page.locator('input[name="questions\\.2\\.title"]').fill("true or false");
  await page.locator('input[name="questions\\.2\\.options\\.0\\.optionText"]').click();
  await page
    .locator('input[name="questions\\.2\\.options\\.0\\.optionText"]')
    .fill("true or false v2");
  await page.getByRole("radio").nth(2).check();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Fill in the blanks" }).click();
  await page.locator('input[name="questions\\.3\\.title"]').click();
  await page.locator('input[name="questions\\.3\\.title"]').fill("fill in the blanks");
  await page
    .locator("div")
    .filter({ hasText: /^\*SentenceWrite a sentence and drop words in to it\.$/ })
    .getByRole("textbox")
    .click();
  await page
    .locator("div")
    .filter({ hasText: /^\*SentenceWrite a sentence and drop words in to it\.$/ })
    .getByRole("textbox")
    .fill(TEST_DATA.fillInTheBlanks.sentence);
  await page.getByRole("button", { name: "Add words" }).click();
  await page.getByTestId("new-word-input").click();
  await page.getByTestId("new-word-input").fill(TEST_DATA.fillInTheBlanks.missingWord);
  await page.getByTestId("add-word").click();
  await page.getByTestId("drag-missing").click();
  await page
    .locator("li")
    .filter({ hasText: "This question contains a" })
    .getByRole("textbox")
    .nth(2)
    .click();
  const dragHandle = page.getByTestId("drag-missing");
  await dragHandle.click();
  const sourceCard = page.locator("div:nth-child(4) > div > div");
  const destinationInput = page
    .locator("li")
    .filter({ hasText: "This question contains a" })
    .getByRole("textbox")
    .nth(1);
  await sourceCard.dragTo(destinationInput);
  await dragHandle.click();
  await page
    .locator("li")
    .filter({ hasText: "This question contains a" })
    .getByRole("textbox")
    .nth(2)
    .click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Gap fill" }).click();
  await page.locator('input[name="questions\\.4\\.title"]').click();
  await page.locator('input[name="questions\\.4\\.title"]').fill("gap fill");
  const gapSentenceParagraph = page
    .locator("div")
    .filter({ hasText: /^\*SentenceWrite a sentence and drop words in to it\.$/ })
    .getByRole("textbox")
    .getByRole("paragraph");
  await gapSentenceParagraph.fill(TEST_DATA.fillInTheBlanks.sentenceExact);
  await page.getByRole("button", { name: "Add words" }).nth(1).click();
  await page.getByTestId("new-word-input").click();
  await page.getByTestId("new-word-input").fill(TEST_DATA.fillInTheBlanks.gapWord);
  await page.getByTestId("add-word").click();
  const gapDragHandle = page.locator('[data-testid^="drag-missing"]').last();
  const gapDropTarget = page
    .locator("p")
    .filter({ hasText: new RegExp(`^${TEST_DATA.fillInTheBlanks.sentenceExact}$`) });
  await gapDragHandle.dragTo(gapDropTarget);
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Short answer" }).click();
  await page.locator('input[name="questions\\.5\\.title"]').click();
  await page.locator('input[name="questions\\.5\\.title"]').fill("short answer");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Free text" }).click();
  await page.locator('input[name="questions\\.6\\.title"]').click();
  await page.locator('input[name="questions\\.6\\.title"]').fill("free text");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByLabel("Add question").press("Escape");
  await page.getByRole("button", { name: "Add question" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Photo question" }).click();
  await page.locator('input[name="questions\\.7\\.title"]').fill("dark or light");
  await page.getByTestId("imageUpload").setInputFiles("app/assets/thumbnail-e2e.jpg");
  await page.getByLabel("Curriculum").getByRole("combobox").click();
  await page.getByLabel("Single choice").getByText("Single choice").click();
  await page.getByLabel("Curriculum").getByRole("combobox").click();
  await page.getByLabel("Multiple choice").getByText("Multiple choice").click();
  await page.locator('input[name="questions\\.7\\.options\\.0\\.optionText"]').fill("dark");
  await page.locator('input[name="questions\\.7\\.options\\.1\\.optionText"]').fill("light");
  await page.locator("#isCorrect").nth(2).click();
  const isChecked = await page.locator("#isCorrect").nth(2).isChecked();
  expect(isChecked).toBeTruthy();

  await expect(page.locator('input[name="questions\\.0\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.1\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.2\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.3\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.4\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.5\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.6\\.title"]')).toBeVisible();
  await expect(page.locator('input[name="questions\\.7\\.title"]')).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
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
  const addContentHeading = page.getByRole("heading", { name: "Add content to your chapter" });
  await addContentHeading.waitFor({ state: "visible" });
  await expect(addContentHeading).toBeVisible();
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
  const addContentHeading2 = page.getByRole("heading", { name: "Add content to your chapter" });
  await addContentHeading2.waitFor({ state: "visible" });
  await expect(addContentHeading2).toBeVisible();
  await expect(page.getByLabel(`Lesson: ${TEST_DATA.lessons.embed}`)).toBeVisible();
};

const publishAndEnroll = async (page: Page) => {
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByRole("button", { name: "Published" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByRole("cell", { name: "student0@example.com" }).click();
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

const waitForStudentLessonProgress = async (page: Page) => {
  await page.waitForResponse(
    (response) =>
      response.url().includes("api/studentLessonProgress") &&
      response.request().method() === "POST" &&
      response.status() === 201,
    {
      timeout: 15000,
    },
  );
};

const waitForQuizCompletion = async (page: Page) => {
  await page.waitForResponse(
    (response) =>
      response.url().includes("api/lesson/evaluation-quiz") &&
      response.request().method() === "POST" &&
      response.status() === 201,
    {
      timeout: 15000,
    },
  );
};

const studentCompletesCourse = async (page: Page) => {
  await page
    .getByRole("button", { name: /Avatar for email@example.com|Test Admin profile Test Admin/i })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
  await page.getByPlaceholder("user@example.com").fill(TEST_DATA.student.email);
  await page.getByLabel("Password").fill(TEST_DATA.student.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.getByTestId("title").last().click();
  await expect(page.getByRole("tab", { name: "Statistics" })).toBeHidden();
  await page.getByTestId("chapter 1").click();
  await page.getByRole("link", { name: "title Content Not Started" }).click();
  await waitForStudentLessonProgress(page);
  await expect(page.getByRole("heading", { name: "content header" })).toBeVisible();
  await page.getByTestId("next-lesson-button").click();
  await expect(page.getByText("Cars quiz").first()).toBeVisible();
  await expect(page.getByText("Lesson 2/4 – Quiz")).toBeVisible();
  await expect(page.getByText("Score: 0% (0 of 8 questions)")).toBeVisible();
  await expect(page.getByText("Passing threshold: 50% (4 of")).toBeVisible();
  await page.getByLabel("yes").check();
  await page.getByLabel("black").check();
  await page.getByLabel("white").check();
  await page.getByLabel("False").check();
  const targetBlank = page.getByTestId("1");
  const draggedWord = page.getByRole("button", { name: TEST_DATA.fillInTheBlanks.missingWord });
  const sourceBox = await draggedWord.boundingBox();
  const targetBox = await targetBlank.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Missing bounding box for drag + drop elements");
  }
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 15,
  });
  await page.mouse.up();
  await page.waitForTimeout(100);
  await page
    .getByText(`${TEST_DATA.fillInTheBlanks.sentenceExact}${TEST_DATA.fillInTheBlanks.missingWord}`)
    .waitFor({ state: "visible" });
  const textBlankInput = page.getByTestId("text-blank-1");
  await textBlankInput.fill(TEST_DATA.fillInTheBlanks.missingWord);
  await textBlankInput.waitFor({ state: "visible" });
  await expect(textBlankInput).toHaveValue(TEST_DATA.fillInTheBlanks.missingWord);
  const briefResponseInput = page.getByTestId("brief-response");
  await briefResponseInput.click();
  await briefResponseInput.fill("short answer");
  const detailedResponseInput = page.getByTestId("detailed-response");
  await detailedResponseInput.click();
  await detailedResponseInput.fill("free text");
  await page.getByLabel("dark").check();
  await page.getByRole("button", { name: "Submit" }).click();
  await waitForQuizCompletion(page);
  await page.getByTestId("next-lesson-button").click();
  await expect(page.getByText("Lesson 3/4 – Ai MentorBeta")).toBeVisible();
  await expect(page.getByText(TEST_DATA.lessons.aiMentor).first()).toBeVisible();
  const messageInput = page.getByPlaceholder("Write a message...");
  const sendButton = page.getByRole("button", { name: "Send" });
  const mentorMessage = page.getByText("Hello! I’m Mentor, here to");
  await expect(messageInput).toBeVisible();
  await expect(sendButton).toBeVisible();
  await expect(mentorMessage).toBeVisible();

  await page.getByRole("link", { name: "embed lesson Embed" }).click();
  await expect(page.locator("div").filter({ hasText: /^Lesson 4\/4 – Embed$/ })).toBeVisible();
  await expect(page.getByText(TEST_DATA.lessons.embed).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "chapter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3" })).toBeVisible();
};

const verifyAdminStats = async (page: Page) => {
  await page
    .getByRole("button", { name: /Test Admin profile Test Admin|Avatar for email@example.com/i })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
  await page.getByPlaceholder("user@example.com").fill(TEST_DATA.admin.email);
  await page.getByLabel("Password").fill(TEST_DATA.admin.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.getByTestId("title").last().click();
  await page.getByRole("tab", { name: "Statistics" }).click();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByText("In Progress")).toBeVisible();
  await expect(page.getByText("Enrolled students count")).toBeVisible();
  await expect(page.locator("p").filter({ hasText: /^1$/ })).toBeVisible();
  await expect(page.getByText("/4")).toBeVisible();
  const lastLesson = page.getByRole("cell", { name: "embed lesson" });
  await expect(lastLesson).toBeVisible();

  await page.getByRole("tab", { name: "Quiz Results" }).click();
  await expect(page.getByText("Cars quiz")).toBeVisible();
  await expect(page.getByLabel("Quiz Results").getByText("75%")).toBeVisible();
  const attemptsEl = page.getByRole("cell", { name: "1", exact: true });
  await expect(attemptsEl).toBeVisible();

  await page.getByRole("tab", { name: "AI Mentor Results" }).click();
  await page.getByRole("tab", { name: "Progress" }).click();
  await expect(
    page.getByRole("cell", { name: /Test Admin profile Test Admin|Avatar for email@example.com/i }),
  ).toBeVisible();
};

test.describe("Course flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should create a new course, few chapters with every lesson type with student completing the course and admin verifying the stats", async ({
    page,
  }) => {
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
