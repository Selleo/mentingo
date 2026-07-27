import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

test("admin course controls stay in one compact row on a small screen", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Responsive Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `responsive-course-${Date.now()}`,
      categoryId: category.id,
      language: "en",
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await openCourseOverviewFlow(page, course.id);

    const settingsButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON);
    const editMediaButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.EDIT_MEDIA_BUTTON);
    const languageSelect = page.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT);

    await expect(settingsButton).toBeVisible();
    await expect(editMediaButton).toBeVisible();
    await expect(languageSelect).toBeVisible();
    await expect(settingsButton.locator("span")).toBeHidden();
    await expect(editMediaButton.locator("span")).toBeHidden();
    await expect(languageSelect.locator("span.hidden", { hasText: "English" })).toBeHidden();

    const settingsBox = await settingsButton.boundingBox();
    const editMediaBox = await editMediaButton.boundingBox();
    const languageBox = await languageSelect.boundingBox();

    expect(settingsBox).not.toBeNull();
    expect(editMediaBox).not.toBeNull();
    expect(languageBox).not.toBeNull();

    if (!(settingsBox && editMediaBox && languageBox)) {
      throw new Error("Course overview controls must have measurable bounds");
    }

    expect(Math.abs(settingsBox.y - editMediaBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(settingsBox.y - languageBox.y)).toBeLessThanOrEqual(2);
    expect(settingsBox.x + settingsBox.width).toBeLessThanOrEqual(editMediaBox.x);
    expect(editMediaBox.x + editMediaBox.width).toBeLessThanOrEqual(languageBox.x);
    expect(languageBox.width).toBeLessThanOrEqual(60);
  });
});
