import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TAB_VALUES, EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";
import { updateCoursePricingFlow } from "../../flows/courses/update-course-pricing.flow";

test("admin can update course pricing when pricing is enabled", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
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

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.PRICING);

    const pricingTab = page.getByTestId(EDIT_COURSE_PAGE_HANDLES.tab(COURSE_TAB_VALUES.PRICING));
    test.skip((await pricingTab.count()) === 0, "Pricing tab is hidden when Stripe is disabled.");

    await updateCoursePricingFlow(page, { isFree: false, price: "12.34" });

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.priceInCents;
      })
      .toBe(1234);

    await updateCoursePricingFlow(page, { isFree: true });

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.priceInCents;
      })
      .toBe(0);
  });
});
