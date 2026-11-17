import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { MFA_PAGE_HANDLES, REGISTER_PAGE_HANDLES } from "../../data/auth/handles";
import { PRICE_INPUT_HANDLES } from "../../data/common/handles";
import { COURSE_PRICING_HANDLES, COURSE_TAB_VALUES } from "../../data/courses/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { login } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { openRegisterPageFlow } from "../../flows/auth/open-register-page.flow";
import {
  openCourseOverviewSettingsFlow,
  selectCourseOverviewSettingsTabFlow,
} from "../../flows/courses/open-course-overview-settings.flow";
import { mockStripeEnabledFlow } from "../../flows/settings/mock-settings-env.flow";
import { openOrganizationSettingsFlow } from "../../flows/settings/open-organization-settings.flow";
import { saveMfaEnforcementFlow } from "../../flows/settings/save-mfa-enforcement.flow";
import { toggleMfaEnforcementRoleFlow } from "../../flows/settings/toggle-mfa-enforcement-role.flow";
import { getGlobalSettings } from "../../utils/global-settings";

test("admin enforces MFA for a role and a user of that role must enroll on login", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  let studentEmail = "";

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const student = await userFactory.register({ password: TEST_PASSWORD });
    studentEmail = student.email;
    cleanup.add(() => userFactory.delete(student.id));

    const originalRoles = new Set((await getGlobalSettings(apiClient)).MFAEnforcedRoles);
    const readEnforcedRoles = async () => {
      const enforcedRoles = new Set((await getGlobalSettings(apiClient)).MFAEnforcedRoles);

      return {
        student: enforcedRoles.has(USER_ROLE.student),
        content_creator: enforcedRoles.has(USER_ROLE.contentCreator),
      };
    };

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
        admin: originalRoles.has(USER_ROLE.admin),
        student: originalRoles.has(USER_ROLE.student),
        content_creator: originalRoles.has(USER_ROLE.contentCreator),
        trainer: originalRoles.has(SYSTEM_ROLE_SLUGS.TRAINER),
      });
    });

    await apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
      student: false,
      content_creator: false,
    });

    await openOrganizationSettingsFlow(page);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_SAVE)).toBeDisabled();

    await toggleMfaEnforcementRoleFlow(page, USER_ROLE.student);
    await toggleMfaEnforcementRoleFlow(page, USER_ROLE.contentCreator);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_SAVE)).toBeEnabled();
    await saveMfaEnforcementFlow(page);

    await expect.poll(readEnforcedRoles).toEqual({ student: true, content_creator: true });
  });

  const visitor = await createWorkspacePage();
  cleanup.add(() => visitor.context.close());

  await login(visitor.page, studentEmail, TEST_PASSWORD);
  await expect(visitor.page).toHaveURL("/auth/mfa");
  await expect(visitor.page.getByTestId(MFA_PAGE_HANDLES.SECRET)).toBeVisible();
});

test("admin changes the default course currency and a new course is priced in it", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);
    const targetCurrency = originalSettings.defaultCourseCurrency === "pln" ? "eur" : "pln";

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateDefaultCourseCurrency({
        defaultCourseCurrency: originalSettings.defaultCourseCurrency,
      });
    });

    await mockStripeEnabledFlow(page);
    await openOrganizationSettingsFlow(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.DEFAULT_CURRENCY_SELECT).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.defaultCurrencyOption(targetCurrency)).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.DEFAULT_CURRENCY_SAVE).click();

    await expect
      .poll(async () => (await getGlobalSettings(apiClient)).defaultCourseCurrency)
      .toBe(targetCurrency);

    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Currency category ${Date.now()}`);
    cleanup.add(() => categoryFactory.delete(category.id));
    const course = await courseFactory.create({
      title: `currency-course-${Date.now()}`,
      categoryId: category.id,
    });
    cleanup.add(() => courseFactory.delete(course.id));

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.PRICING);
    await page.getByTestId(COURSE_PRICING_HANDLES.PAID_CARD).click();

    await expect(page.getByTestId(PRICE_INPUT_HANDLES.CURRENCY)).toHaveText(targetCurrency);
  });
});

test("admin sets an age limit and visitors must give their birthday to register", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);
    const targetAgeLimit = originalSettings.ageLimit === 13 ? 16 : 13;

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateAgeLimit({ ageLimit: originalSettings.ageLimit });
    });

    const visitor = await createWorkspacePage();
    cleanup.add(() => visitor.context.close());

    await openOrganizationSettingsFlow(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SELECT).click();
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.ageLimitOption(JSON.stringify(targetAgeLimit)))
      .click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SAVE).click();

    await expect
      .poll(async () => (await getGlobalSettings(apiClient)).ageLimit)
      .toBe(targetAgeLimit);

    await openRegisterPageFlow(visitor.page);
    await expect(visitor.page.getByTestId(REGISTER_PAGE_HANDLES.BIRTHDAY)).toBeVisible();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SELECT).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ageLimitOption("null")).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SAVE).click();

    await expect.poll(async () => (await getGlobalSettings(apiClient)).ageLimit).toBe(null);

    await openRegisterPageFlow(visitor.page);
    await expect(visitor.page.getByTestId(REGISTER_PAGE_HANDLES.BIRTHDAY)).toHaveCount(0);
  });
});
