import { deterministicName } from "../core/factory-context";

import type { FixtureApiClient } from "../../api/client";
import type { CleanupRegistry } from "../core/cleanup-registry";
import type { FactoryContext } from "../core/factory-context";

export type CourseEntity = {
  id: string;
  title: string;
};

export const createCourseFactory = (
  ctx: FactoryContext,
  api: FixtureApiClient,
  cleanup: CleanupRegistry,
) => {
  return {
    async create(input?: { title?: string }): Promise<CourseEntity> {
      const title = input?.title ?? deterministicName(ctx, "course");
      const course = await api.createCourse({ title });

      cleanup.register({
        label: `delete-course-${course.id}`,
        run: () => api.deleteCourse(course.id),
      });

      return course;
    },
  };
};
