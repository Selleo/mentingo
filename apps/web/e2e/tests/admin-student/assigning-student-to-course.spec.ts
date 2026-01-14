import { test, expect, type Locator, type Page } from "@playwright/test";

import { AuthFixture } from "../../fixture/auth.fixture";
import {
  enrollAllStudents,
  enrollSelected,
  findAndClickCell,
  navigateToPage,
  selectCourseAndOpenEnrollmentTab,
  verifyStudentSeesCourse,
} from "../../utils";

import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "./data/assigning-student-data";

const USERS = {
  admin: { email: "admin@example.com", password: "password" },
  student: { email: "student0@example.com", password: "password" },
};

const GROUP = { name: "STUDENTS GROUP" };

const COURSE = {
  title: "Course v1",
  categoryTestId: "category-option-Artificial Intelligence",
  categoryName: "Artificial Intelligence",
  description: "description",
};

const PRIVATE_COURSE = {
  titleTestId: "Advanced English: Mastering Complex Language Skills",
  heading: "Advanced English: Mastering",
  admin: { email: "admin@example.com", password: "password" },
  student: { email: "student@example.com", password: "password", email2: "student0@example.com" },
};

const SEQUENCE_USERS = {
  admin: { email: "admin@example.com", password: "password" },
  student: { email: "student@example.com", password: "password" },
};

const SEQUENCE_COURSE = {
  title: "Test Course",
  categoryTestId: "category-option-Artificial Intelligence",
  categoryName: "Artificial Intelligence",
  description: "desc",
  chapters: ["chapter 1", "chapter 2", "chapter 3", "chapter 4"],
  lessons: {
    intro: "text lessonde",
    lesson2: "test lesson v2",
    lesson3: "test lesson v3",
    lesson2Repeat: "test lesson v2",
    lesson4: "test lesson v4",
    lesson5: "text lesson v5",
  },
  quizTitle: "quiz",
};

const IDS = {
  groupSelect: /^select-group-[a-z0-9-]+$/,
};

const fillWithWait = async (locator: Locator, value: string) => {
  await locator.waitFor({ state: "visible" });
  await locator.click();
  await locator.fill(value);
};

const clickAddLessonButton = async (page: Page, index = 0) => {
  const addLessonButton = page.getByRole("button", { name: "Add lesson" }).nth(index);
  await addLessonButton.waitFor({ state: "visible", timeout: 20000 });
  await addLessonButton.scrollIntoViewIfNeeded();
  await addLessonButton.click();
};

const addChapterWithTitle = async (page: Page, title: string) => {
  await page.getByRole("button", { name: "Add chapter" }).click();
  const chapterTitleInput = page.getByLabel("* Title");
  await chapterTitleInput.click();
  await chapterTitleInput.fill(title);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("heading", { name: title }).waitFor({ state: "visible" });
};

const addTextLesson = async (
  page: Page,
  addButtonIndex: number,
  title: string,
  descriptionEditor: Locator,
  description?: string,
) => {
  const createHeading = page.getByText("Create", { exact: true });
  await createHeading.waitFor({ state: "hidden" });
  await expect(createHeading).not.toBeVisible();
  await clickAddLessonButton(page, addButtonIndex);
  await waitAndSelectTextLessonType(page);
  await fillWithWait(page.getByPlaceholder("Provide lesson title..."), title);

  if (description) {
    await descriptionEditor.click();
    await page.locator("#description").getByRole("paragraph").click();
    await descriptionEditor.fill(description);
  }

  await page.getByRole("button", { name: "Save" }).click();
};

const getDescriptionEditor = (page: Page) => page.locator("#description div");

const startSequenceCourseCreation = async (page: Page) => {
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.locator(".h-min > button:nth-child(2)").click();
  await page.getByRole("button", { name: "Create new" }).click();
  await fillWithWait(page.getByPlaceholder("Enter title"), SEQUENCE_COURSE.title);
  await page.getByLabel("* Category").waitFor({ state: "visible" });
  await page.getByLabel("* Category").click();
  await page
    .getByTestId(SEQUENCE_COURSE.categoryTestId)
    .getByText(SEQUENCE_COURSE.categoryName)
    .click();
  const descriptionEditor = getDescriptionEditor(page);
  await descriptionEditor.waitFor({ state: "visible" });
  await descriptionEditor.click();
  await descriptionEditor.fill(SEQUENCE_COURSE.description);
  await page.getByRole("button", { name: "Proceed" }).click();
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByLabel("Enforce lesson sequence")).toBeVisible();
  return descriptionEditor;
};

const enrollSequenceStudent = async (page: Page) => {
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText(SEQUENCE_USERS.student.email).click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

const buildInitialSequenceCurriculum = async (page: Page, descriptionEditor: Locator) => {
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Curriculum" }).click();
  await addChapterWithTitle(page, SEQUENCE_COURSE.chapters[0]);
  await addChapterWithTitle(page, SEQUENCE_COURSE.chapters[1]);
  await addChapterWithTitle(page, SEQUENCE_COURSE.chapters[2]);
  await addTextLesson(page, 0, SEQUENCE_COURSE.lessons.intro, descriptionEditor, "s");
  await addTextLesson(page, 0, SEQUENCE_COURSE.lessons.lesson2, descriptionEditor, "desc");
  await addTextLesson(page, 1, SEQUENCE_COURSE.lessons.lesson3, descriptionEditor, "desc");
  await page.getByText("chapter 3Chapter 3 • Number of lessons 0Add lessonFree chapter").click();
  await addTextLesson(page, 2, SEQUENCE_COURSE.lessons.lesson4, descriptionEditor, "desc");
};

const publishSequenceCourse = async (page: Page) => {
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByRole("button", { name: "Published Students can" }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

const openSequenceCourse = async (page: Page) => {
  await page.getByTestId(SEQUENCE_COURSE.title).click();
};

const loginSequenceUser = async (page: Page, role: "admin" | "student") => {
  const { email, password } = SEQUENCE_USERS[role];
  await page.getByPlaceholder("user@example.com").click();
  await page.getByPlaceholder("user@example.com").fill(email);
  await page.getByLabel("Password").click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
};

const loginAndOpenSequenceCourse = async (page: Page, role: "admin" | "student") => {
  await loginSequenceUser(page, role);
  await openSequenceCourse(page);
};
const studentInitialSequenceView = async (page: Page) => {
  await loginAndOpenSequenceCourse(page, "student");
  await page.getByTestId("chapter 3").click();
  await expect(
    page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.lesson4} Text Not` }),
  ).toBeVisible();
  await page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.lesson4} Text Not` }).click();
  await expect(page.getByText(SEQUENCE_COURSE.lessons.lesson4).first()).toBeVisible();
  const chapter2 = page.getByRole("button", { name: /chapter 2/i });
  if ((await chapter2.getAttribute("data-state")) !== "open") {
    await chapter2.click();
  }
  const lesson3 = page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.lesson3} Text` });
  await lesson3.waitFor({ state: "visible" });
  const previousUrl = page.url();
  await lesson3.scrollIntoViewIfNeeded();
  await lesson3.click({ force: true, timeout: 10000 });
  await page
    .waitForURL((url) => url.toString() !== previousUrl, { timeout: 10000 })
    .catch(() => undefined);
  await expect(page.getByText("Chapter 2: chapter")).toBeVisible();
  expect(await page.getByText(SEQUENCE_COURSE.lessons.lesson3).count()).toBe(2);
  await expect(page.getByText(SEQUENCE_COURSE.lessons.lesson3).first()).toBeVisible();
  await logoutStudent(page);
};

const adminEnableSequenceSetting = async (page: Page) => {
  await loginAndOpenSequenceCourse(page, "admin");
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Enforce lesson sequence").click();
  await logoutAdmin(page);
};

const studentBlockedProgressFlow = async (page: Page) => {
  await loginAndOpenSequenceCourse(page, "student");
  await page.getByTestId("chapter 1").click();
  await expect(
    page.getByRole("button", { name: `${SEQUENCE_COURSE.lessons.lesson2} Text Blocked` }).first(),
  ).toBeVisible();
  await page.getByTestId("chapter 3").click();
  await expect(
    page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.intro} Text Not Started` }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `${SEQUENCE_COURSE.lessons.lesson2} Text Blocked` })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.intro} Text Not Started` }).first(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: `${SEQUENCE_COURSE.lessons.intro} Text Not Started` })
    .first()
    .click();
  await page.waitForResponse(
    (res) =>
      res.url().includes("/api/lesson") && res.request().method() === "GET" && res.status() === 200,
    { timeout: 30000 },
  );
  const lesson2Link = page
    .getByRole("link", { name: `${SEQUENCE_COURSE.lessons.lesson2} Text` })
    .first();

  await expect(lesson2Link).toBeEnabled();
  await lesson2Link.click();
  await lesson2Link.click();
  await logoutStudent(page);
};

const adminAddChapterFourWithQuizAndLesson = async (page: Page) => {
  await loginAndOpenSequenceCourse(page, "admin");
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Curriculum" }).click();
  await addChapterWithTitle(page, SEQUENCE_COURSE.chapters[3]);
  await clickAddLessonButton(page, 3);
  await page.getByLabel("Choose adminCourseView.curriculum.lesson.other.quiz lesson type").click();
  await fillWithWait(page.getByLabel("*Title"), SEQUENCE_COURSE.quizTitle);
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Single choice" }).click();
  await fillWithWait(page.locator('input[name="questions\\.0\\.title"]'), "bmw or audi");
  await fillWithWait(page.getByPlaceholder("Option 1"), "bmw");
  await fillWithWait(page.getByPlaceholder("Option 2"), "audi");
  await page.locator('input[name="questions\\.0\\.options\\.0\\.isCorrect"]').check();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Single choice" }).click();
  await page.getByRole("button", { name: "Delete question" }).nth(1).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await clickAddLessonButton(page, 3);
  const descriptionEditor = getDescriptionEditor(page);
  await addTextLesson(page, 3, SEQUENCE_COURSE.lessons.lesson5, descriptionEditor, "desc");
  await logoutAdmin(page);
};

const studentCompletesFinalLessons = async (page: Page) => {
  await loginAndOpenSequenceCourse(page, "student");
  await page.getByTestId("chapter 4").click();
  await expect(page.getByRole("link", { name: "quiz (1) Quiz Not Started" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${SEQUENCE_COURSE.lessons.lesson5} Text Blocked` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue learning" }).click();
  await page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.lesson5} Text` }).click();
  await expect(page.getByText("Lesson 1/2 – Quiz")).toBeVisible();
  await page.locator("label").nth(1).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(
    page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.lesson5} Text` }),
  ).toBeVisible();
  await page.getByRole("link", { name: `${SEQUENCE_COURSE.lessons.lesson5} Text` }).click();
  await expect(page.getByText(SEQUENCE_COURSE.lessons.lesson5).first()).toBeVisible();
};

const waitAndSelectTextLessonType = async (page: Page) => {
  const textLessonType = page.getByLabel(
    "Choose adminCourseView.curriculum.lesson.other.text lesson type",
  );
  await textLessonType.waitFor({ state: "visible" });
  await expect(textLessonType).toBeVisible();
  await textLessonType.click();
  return textLessonType;
};

export const login = async (page: Page, email: string, password: string) => {
  const authFixture = new AuthFixture(page);
  await authFixture.login(email, password);
};

const logoutAdmin = async (page: Page) => {
  await page
    .getByRole("button", { name: /Test Admin profile Test Admin|Avatar for email@example.com/i })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const logoutStudent = async (page: Page) => {
  await page
    .getByRole("button", { name: /test Student profile test|Avatar for email@example.com/i })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const createGroup = async (page: Page) => {
  await page.getByRole("button", { name: "Manage" }).nth(1).click();
  await page.getByRole("link", { name: "Groups" }).click();

  await page.getByRole("button", { name: "Group name" }).waitFor({ state: "visible" });
  const selectRowCell = page.getByRole("cell", { name: "Select row" }).first();
  if (await selectRowCell.isVisible()) {
    await page.getByLabel("Select all").click();
    await page.getByRole("button", { name: "Delete selected" }).nth(1).click();
    await page.getByRole("button", { name: "Delete" }).click();
  }

  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByTestId("groupName").fill(GROUP.name);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("cell", { name: GROUP.name }).first()).toBeVisible();
};

const assignGroupToStudent = async (page: Page) => {
  await page.getByRole("link", { name: "Users" }).click();
  await page.getByTestId(USERS.student.email).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Change group" }).click();
  const groupOption = page.getByRole("option", { name: GROUP.name }).first();
  await groupOption.click();
  await expect(groupOption).toHaveAttribute("aria-selected", "true");
  await page.getByRole("heading", { name: "Modify groups (1)" }).click();
  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.getByRole("button", { name: "Confirm" }).click();
};

const createCourse = async (page: Page) => {
  await page.getByRole("link", { name: "Courses" }).click();
  await page.locator(".h-min > button:nth-child(2)").click();
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByPlaceholder("Enter title").fill(COURSE.title);
  await page.getByLabel("* Category").click();
  await page.getByTestId(COURSE.categoryTestId).getByText(COURSE.categoryName).click();
  await page.locator("#description div").fill(COURSE.description);
  await page.getByRole("button", { name: "Proceed" }).click();
};

const publishCourse = async (page: Page) => {
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByRole("button", { name: "Published Students can" }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

const enrollStudentIndividually = async (page: Page) => {
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText("student0@example.com").click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

const expectIndividualEnrollment = async (page: Page) => {
  await expect(page.getByRole("cell", { name: "Individually enrolled" })).toBeVisible();
};

const changeLanguageToEn = async (page: Page) => {
  await page
    .getByRole("button", {
      name: /Avatar for email@example.com|Test Admin profile Test Admin/i,
    })
    .click();
  await page.getByRole("link", { name: /Settings|Ustawienia/i }).click();
  await page.waitForURL("/settings");
  await page
    .getByText(/LanguageEnglish|JęzykPolski/)
    .getByRole("combobox")
    .click();

  await page
    .getByLabel("English")
    .getByText("English")
    .or(page.getByRole("option", { name: "Angielski" }))
    .click();
  await page.getByLabel("Go to homepage").click();
};

const studentSeesCourse = async (page: Page) => {
  await login(page, USERS.student.email, USERS.student.password);
  await changeLanguageToEn(page);
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await expect(page.getByTestId(COURSE.title)).toBeVisible();
  await page.getByTestId(COURSE.title).click();
  await expect(
    page
      .locator("div")
      .filter({ hasText: /^Artificial Intelligence$/ })
      .nth(1),
  ).toBeVisible();
  await logoutStudent(page);
};

const unenrollStudent = async (page: Page) => {
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.getByTestId(COURSE.title).first().click();
  const editCourseButton = page.getByRole("button", { name: "Edit Course" });
  await editCourseButton.waitFor({ state: "visible", timeout: 15000 });
  await expect(editCourseButton).toBeVisible();
  await editCourseButton.click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText("student0@example.com").click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Unenroll selected" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await logoutAdmin(page);
};

const expectCourseHiddenForStudent = async (page: Page) => {
  await login(page, USERS.student.email, USERS.student.password);
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await expect(page.getByTestId(COURSE.title)).toBeHidden();
  await logoutStudent(page);
};

const enrollGroupToCourse = async (page: Page) => {
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.getByTestId(COURSE.title).last().click();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText(USERS.student.email).click();
  await page.getByRole("button", { name: "Enroll groups" }).click();
  await page.getByRole("button", { name: "Enroll groups", exact: true }).click();
  await page.getByLabel("Enroll groups to course").getByText(GROUP.name).first().click();
  await page.getByLabel(IDS.groupSelect).first().click();
  await page.getByRole("button", { name: "Enroll groups" }).click();
  await expect(page.getByRole("cell", { name: "Enrolled by group" })).toBeVisible();
  await logoutAdmin(page);
};

const studentSeesCourseByGroup = async (page: Page) => {
  await login(page, USERS.student.email, USERS.student.password);
  await changeLanguageToEn(page);
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.getByTestId(COURSE.title).last().click();
  await expect(page.getByRole("heading", { name: COURSE.title })).toBeVisible();
  await logoutStudent(page);
};

const unenrollGroup = async (page: Page) => {
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.getByTestId(COURSE.title).last().click();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText("student0@example.com").click();
  await page.getByRole("button", { name: "Enroll groups" }).click();
  await page.getByRole("button", { name: "Unenroll groups" }).click();
  // await page.getByText(`${GROUP.name}Enrolled`, { exact: true }).first().click();
  // await page.getByLabel(IDS.groupSelect).click();
  await page
    .getByRole("checkbox", { name: /select-group-.*/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Unenroll selected" }).click();
  // await logoutAdmin(page);
};

const setCourseAsPrivate = async (page: Page) => {
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
  await page.getByTestId(PRIVATE_COURSE.titleTestId).click();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByRole("button", { name: "Private Students cannot" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: PRIVATE_COURSE.heading }).locator("div"),
  ).toBeVisible();
  await logoutAdmin(page);
};

const expectCourseHiddenForPrivateStudent = async (page: Page) => {
  await login(page, PRIVATE_COURSE.student.email2, PRIVATE_COURSE.student.password);
  await expect(page.getByTestId(PRIVATE_COURSE.titleTestId)).toBeHidden();
  await logoutStudent(page);
};

const enrollStudentToPrivateCourse = async (page: Page) => {
  await login(page, PRIVATE_COURSE.admin.email, PRIVATE_COURSE.admin.password);
  await page.locator(".h-min > button:nth-child(2)").click();
  await page
    .getByRole("button", { name: new RegExp("create new", "i") })
    .waitFor({ state: "visible" });
  await page.getByText(PRIVATE_COURSE.heading).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByRole("cell", { name: PRIVATE_COURSE.student.email2 }).click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await logoutAdmin(page);
};

const expectCourseVisibleForPrivateStudent = async (page: Page) => {
  await login(page, PRIVATE_COURSE.student.email2, PRIVATE_COURSE.student.password);
  await expect(page.getByTestId(PRIVATE_COURSE.titleTestId)).toBeVisible();
  await page.getByTestId(PRIVATE_COURSE.titleTestId).click();
  await expect(page.getByRole("heading", { name: PRIVATE_COURSE.heading })).toBeVisible();
};

const unenrollStudentFromCourse = async (page: Page) => {
  await page.locator(".h-min > button:nth-child(2)").click();
  await page
    .getByRole("button", { name: new RegExp("create new", "i") })
    .waitFor({ state: "visible" });
  await page.getByText(PRIVATE_COURSE.heading).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  const studentCell = page.getByRole("cell", { name: PRIVATE_COURSE.student.email2 });
  await studentCell.waitFor({ state: "visible" });
  await studentCell.click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Unenroll selected" }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

test.describe.serial("Assigning students to course flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should set course as private and verify student course visibility", async ({ page }) => {
    // Unenroll student from private course before running this test to ensure a clean state
    await unenrollStudentFromCourse(page);

    await setCourseAsPrivate(page);
    await expectCourseHiddenForPrivateStudent(page);
    await enrollStudentToPrivateCourse(page);
    await expectCourseVisibleForPrivateStudent(page);
  });

  test("should assign student to course and student sees enrollment", async ({ page }) => {
    await test.step("admin enrolls the student", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
      );

      await findAndClickCell(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail);

      await enrollSelected(page);

      await expect(
        page.getByTestId(
          new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail, "i"),
        ),
      ).toHaveText(new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.enrolled, "i"));
    });

    await test.step("student verifies enrollment", async () => {
      await page
        .getByRole("button", {
          name: /Test Admin profile Test Admin|Avatar for email@example.com/i,
        })
        .click();
      await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
      await page.waitForURL("/auth/login");

      await login(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.password,
      );

      await navigateToPage(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.browseCourses,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses,
        page.getByRole("heading", {
          name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses, "i"),
        }),
      );

      expect(
        await verifyStudentSeesCourse(
          page,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.secondCourseToAssign,
        ),
      ).toBeTruthy();
    });
  });

  test("should assign multiple students to course and verify their enrollment", async ({
    page,
  }) => {
    await selectCourseAndOpenEnrollmentTab(
      page,
      ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
    );

    await enrollAllStudents(page);
  });

  test("should assign student/group to course and student/group sees enrollment", async ({
    page,
  }) => {
    await test.step("setup group and course", async () => {
      await createGroup(page);
      await assignGroupToStudent(page);
      await createCourse(page);
      await publishCourse(page);
    });

    await test.step("enroll student individually and verify", async () => {
      await enrollStudentIndividually(page);
      await expectIndividualEnrollment(page);
      await logoutAdmin(page);
    });

    await test.step("student sees course individually then gets unenrolled", async () => {
      await studentSeesCourse(page);
      await unenrollStudent(page);
      await expectCourseHiddenForStudent(page);
    });

    await test.step("enroll group and verify", async () => {
      await enrollGroupToCourse(page);
      await studentSeesCourseByGroup(page);
      await unenrollGroup(page);
    });
  });

  test("should check if enforcing lesson sequence works", async ({ page }) => {
    const descriptionEditor = await startSequenceCourseCreation(page);
    await enrollSequenceStudent(page);
    await buildInitialSequenceCurriculum(page, descriptionEditor);
    await publishSequenceCourse(page);
    await logoutAdmin(page);
    await studentInitialSequenceView(page);
    await adminEnableSequenceSetting(page);
    await studentBlockedProgressFlow(page);
    await adminAddChapterFourWithQuizAndLesson(page);
    await studentCompletesFinalLessons(page);
  });
});
