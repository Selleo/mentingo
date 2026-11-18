import { USER_ROLE } from "~/config/userRoles";

import { COURSE_PRICING_HANDLES, COURSE_TAB_VALUES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import {
  openCourseOverviewSettingsFlow,
  selectCourseOverviewSettingsTabFlow,
} from "../../flows/courses/open-course-overview-settings.flow";
import { updateCoursePricingFlow } from "../../flows/courses/update-course-pricing.flow";

test("admin can update course pricing when pricing is enabled", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const stripeConfig = await apiClient.api.envControllerGetStripeConfigured();
    // Paid courses need real Stripe keys (CI sets STRIPE_* secrets); without them the pricing tab is hidden.
    test.skip(!stripeConfig.data.data.enabled, "requires Stripe keys (STRIPE_*) in the API env");

    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Pricing Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `pricing-course-${Date.now()}`,
      categoryId: category.id,
      priceInCents: 0,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.PRICING);
    await updateCoursePricingFlow(page, { isFree: false, price: "12.34" });

    await expect.poll(async () => (await courseFactory.getById(course.id)).priceInCents).toBe(1234);

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.PRICING);
    await expect(page.getByTestId(COURSE_PRICING_HANDLES.PRICE_INPUT)).toHaveValue("12.34");

    await updateCoursePricingFlow(page, { isFree: true });

    await expect.poll(async () => (await courseFactory.getById(course.id)).priceInCents).toBe(0);
  });
});
