import { createCourseWithCurriculumFactory } from "../factories/composites/course-with-curriculum.factory";
import { CleanupRegistry } from "../factories/core/cleanup-registry";
import { createFactoryContext } from "../factories/core/factory-context";
import { createCourseFactory } from "../factories/primitives/course.factory";

import { cleanupFixture } from "./cleanup.fixture";

import type { CourseWorld } from "../factories/composites/course-with-curriculum.factory";

export const dataFixture = cleanupFixture.extend<{
  createCourseWorld: (input?: {
    courseTitle?: string;
    chapterTitles?: string[];
  }) => Promise<CourseWorld>;
}>({
  createCourseWorld: async ({ apiClient, registerCleanup }, use, testInfo) => {
    const cleanup = new CleanupRegistry();

    registerCleanup({
      label: "factory-cleanup-registry",
      run: () => cleanup.runAll(),
    });

    const ctx = createFactoryContext("example-run", testInfo.workerIndex, testInfo.title);

    const courseFactory = createCourseFactory(ctx, apiClient, cleanup);
    const courseWithCurriculumFactory = createCourseWithCurriculumFactory(apiClient, (input) =>
      courseFactory.create(input),
    );

    await use((input) => courseWithCurriculumFactory.create(input));
  },
});
