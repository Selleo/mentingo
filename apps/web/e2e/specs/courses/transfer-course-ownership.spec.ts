import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";

test("admin can transfer course ownership", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const userFactory = factories.createUserFactory();
    const category = await categoryFactory.create(`Transfer Course Category ${Date.now()}`);
    const candidate = await userFactory.create({
      firstName: "Course",
      lastName: "Owner",
      email: `course-owner-${Date.now()}@example.com`,
      roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
    });
    const course = await courseFactory.create({
      title: `transfer-course-${Date.now()}`,
      categoryId: category.id,
      status: "private",
    });
    const originalOwnership = await courseFactory.getOwnership(course.id);

    cleanup.add(async () => {
      const ownership = await courseFactory.getOwnership(course.id);
      if (ownership.currentAuthor.id !== originalOwnership.currentAuthor.id) {
        await courseFactory.transferOwnership(course.id, originalOwnership.currentAuthor.id);
      }
      await courseFactory.delete(course.id);
      await userFactory.delete(candidate.id);
      await categoryFactory.delete(category.id);
    });

    await courseFactory.transferOwnership(course.id, candidate.id);

    await expect
      .poll(async () => {
        const ownership = await courseFactory.getOwnership(course.id);
        return ownership.currentAuthor.id;
      })
      .toBe(candidate.id);
  });
});
