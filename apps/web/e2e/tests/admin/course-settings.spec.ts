import { expect, type Page, test } from "@playwright/test";

const TEST_COURSE = {
  name: "E2E Test: Automated Course for Full-Stack Development",
  course_description:
    "This course is specifically generated for end-to-end testing purposes. It includes mock content to simulate a comprehensive learning experience in full-stack web development. Topics cover front-end frameworks like React and Next.js, back-end technologies such as Node.js and Nest.js, and database integration. This course ensures thorough testing of user interactions, workflows, and application features.",
} as const;

const URL_PATTERNS = {
  course:
    /admin\/beta-courses\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
  course2:
    /course\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
} as const;

class CourseActions {
  constructor(private readonly page: Page) {}

  async searchCourse(): Promise<void> {
    await this.page.getByRole("button", { name: "Courses" }).getByRole("link").click();
    await expect(this.page.getByRole("button", { name: "Manage courses" })).toBeVisible();
    await this.page.getByRole("button", { name: "Manage courses" }).click();
    await this.page.getByPlaceholder(/Search by title/).fill(TEST_COURSE.name);
    await expect(this.page.getByRole("button", { name: "Clear All" })).toBeVisible();
  }

  async openCourse(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Manage Courses" })).toBeVisible();
    await this.page.getByText(TEST_COURSE.name).click();
    const combinedRegex = new RegExp(
      [URL_PATTERNS.course.source, URL_PATTERNS.course2.source].join("|"),
    );
    await this.page.waitForURL(combinedRegex);
    await expect(this.page).toHaveURL(combinedRegex);
    await this.verifyCourseContent();
  }

  private async verifyCourseContent(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: TEST_COURSE.name })).toBeVisible();
  }
}

test.describe.serial("Course E2E", () => {
  let courseActions: CourseActions;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    courseActions = new CourseActions(page);
    await courseActions.searchCourse();
    await courseActions.openCourse();
  });

  test("should change course price to free", async ({ page }) => {
    await page
      .getByTestId(/^Freemium\s*-\s*[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/i)
      .click();

    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Course updated successfully", { exact: true }),
    ).toBeVisible();
  });

  test("should change course price to paid", async ({ page }) => {
    await page.getByRole("tab", { name: "Pricing" }).click();
    await page.getByText("Paid course").click();
    await page.getByPlaceholder("Amount").fill("42069");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Course updated successfully", { exact: true }),
    ).toBeVisible();

    await page.getByText("Free").click();
    await page.getByText("Paid course").click();
    await expect(page.getByPlaceholder("Amount")).toHaveValue("42,069");
  });

  test("should change course status to draft", async ({ page }) => {
    await page.getByRole("tab", { name: "Status" }).click();
    await page.getByText("Draft").click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Course updated successfully", { exact: true }),
    ).toBeVisible();
  });

  test("should change course status to published", async ({ page }) => {
    await page.getByRole("tab", { name: "Status" }).click();
    await page.getByLabel("Published").click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Course updated successfully", { exact: true }),
    ).toBeVisible();
  });

  test("should change course title", async ({ page }) => {
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByLabel("Course title").fill(`${TEST_COURSE.name} test`);

    await page.getByRole("button", { name: "Save" }).click();
    await page.reload();

    await expect(
      page.getByRole("heading", { name: `${TEST_COURSE.name} test`, level: 4 }),
    ).toBeVisible();
  });

  test("should change course description", async ({ page }) => {
    await page.getByRole("tab", { name: "Settings" }).click();

    const descriptionField = page.locator("#description .tiptap");

    await descriptionField.fill(`${TEST_COURSE.course_description} test`);

    await page.getByRole("button", { name: "Save" }).click();
    await page.reload();

    await expect(descriptionField).toHaveText(`${TEST_COURSE.course_description} test`);
  });

  test("should change course values to defults all at once", async ({ page }) => {
    await page.getByRole("tab", { name: "Settings" }).click();

    await page.getByLabel("Course title").fill(TEST_COURSE.name);
    const descriptionField = page.locator("#description .tiptap");
    await descriptionField.fill(TEST_COURSE.course_description);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Course updated successfully", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: TEST_COURSE.name, level: 4 })).toBeVisible();
    await expect(descriptionField).toHaveText(TEST_COURSE.course_description);

    await page.getByRole("tab", { name: "Pricing" }).click();
    await page.getByText("Free").click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Course updated successfully", { exact: true }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Status" }).click();
    await page.getByLabel("Published").click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .getByText("Course updated successfully", { exact: true }),
    ).toBeVisible();
  });
});
