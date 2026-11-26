import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { courseStudentMode } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type CourseStudentModeTest = Omit<InferInsertModel<typeof courseStudentMode>, "tenantId">;

/** Turns learning mode on for the user in the course. */
export const createCourseStudentModeFactory = (db: DatabasePg) =>
  Factory.define<CourseStudentModeTest, never, InferSelectModel<typeof courseStudentMode>>(
    ({ onCreate }) => {
      onCreate(async (studentMode) => {
        const [inserted] = await db.insert(courseStudentMode).values(studentMode).returning();

        return inserted;
      });

      return {
        id: faker.string.uuid(),
        userId: "",
        courseId: "",
      };
    },
  );
