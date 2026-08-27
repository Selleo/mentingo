import { USER_ROLE } from "~/config/userRoles";

import {
  COURSE_OVERVIEW_HANDLES,
  COURSE_SETTINGS_HANDLES,
  COURSE_TAB_VALUES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewSettingsFlow } from "../../flows/courses/open-course-overview-settings.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

test("shared course metadata and learning outcomes are read-only for recipient admins", async ({
  cleanup,
  factories,
  createIsolatedWorkspace,
  withWorkerPage,
}) => {
  const recipientWorkspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  let targetCourseId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      const categoryFactory = factories.createCategoryFactory();
      const courseFactory = factories.createCourseFactory();
      const category = await categoryFactory.create(`Shared Course Category ${Date.now()}`);
      const sourceCourse = await courseFactory.create({
        categoryId: category.id,
        description: "Centrally managed description",
        title: `Shared Course ${Date.now()}`,
      });

      await courseFactory.update(sourceCourse.id, {
        language: "en",
        learningOutcomes: ["Centrally managed learning outcome"],
      });

      cleanup.add(async () => {
        await courseFactory.delete(sourceCourse.id);
        await categoryFactory.delete(category.id);
      });

      await courseFactory.shareWithTenant(sourceCourse.id, recipientWorkspace.tenant.id);

      await expect
        .poll(
          async () => {
            const exports = await courseFactory.getMasterCourseExports(sourceCourse.id);
            targetCourseId = exports[0]?.targetCourseId ?? "";
            return targetCourseId || null;
          },
          { timeout: 30_000 },
        )
        .not.toBeNull();
    },
    { root: true },
  );

  await expect
    .poll(
      async () => {
        if (!targetCourseId) return null;

        try {
          const course = await recipientWorkspace.apiClient.api.courseControllerGetBetaCourseById({
            id: targetCourseId,
            language: "en",
          });
          return course.data.data.originType;
        } catch {
          return null;
        }
      },
      { timeout: 30_000 },
    )
    .toBe("exported");

  await openCourseOverviewFlow(recipientWorkspace.page, targetCourseId);

  await expect(
    recipientWorkspace.page.getByTestId(COURSE_OVERVIEW_HANDLES.EDIT_MEDIA_BUTTON),
  ).toHaveCount(0);
  await expect(
    recipientWorkspace.page.getByTestId(COURSE_SETTINGS_HANDLES.TITLE_INPUT),
  ).toHaveCount(0);
  await expect(
    recipientWorkspace.page.getByTestId(COURSE_SETTINGS_HANDLES.CATEGORY_SELECT),
  ).toBeDisabled();
  await expect(
    recipientWorkspace.page.getByText("Centrally managed learning outcome"),
  ).toBeVisible();
  await expect(
    recipientWorkspace.page.getByRole("button", { name: "Add learning outcome" }),
  ).toHaveCount(0);
  await expect(
    recipientWorkspace.page.getByRole("button", { name: "Remove learning outcome" }),
  ).toHaveCount(0);
  await expect(recipientWorkspace.page.getByRole("button", { name: "Edit content" })).toHaveCount(
    0,
  );

  await recipientWorkspace.page.getByTestId(EDIT_COURSE_PAGE_HANDLES.LANGUAGE_SELECT).click();
  await expect(
    recipientWorkspace.page.getByTestId(EDIT_COURSE_PAGE_HANDLES.languageOption("de")),
  ).toHaveCount(0);

  await openCourseOverviewSettingsFlow(recipientWorkspace.page, targetCourseId);
  await expect(
    recipientWorkspace.page.getByTestId(
      COURSE_OVERVIEW_HANDLES.settingsTab(COURSE_TAB_VALUES.STATUS.toLowerCase()),
    ),
  ).toBeVisible();
  await expect(
    recipientWorkspace.page.getByTestId(
      COURSE_OVERVIEW_HANDLES.settingsTab(COURSE_TAB_VALUES.ENROLLED.toLowerCase()),
    ),
  ).toBeVisible();
  await expect(
    recipientWorkspace.page.getByTestId(
      COURSE_OVERVIEW_HANDLES.settingsTab(COURSE_TAB_VALUES.SETTINGS.toLowerCase()),
    ),
  ).toHaveCount(0);
  await expect(
    recipientWorkspace.page.getByTestId(
      COURSE_OVERVIEW_HANDLES.settingsTab(COURSE_TAB_VALUES.PRICING.toLowerCase()),
    ),
  ).toHaveCount(0);
  await expect(
    recipientWorkspace.page.getByTestId(
      COURSE_OVERVIEW_HANDLES.settingsTab(COURSE_TAB_VALUES.EXPORTS.toLowerCase()),
    ),
  ).toHaveCount(0);
});
