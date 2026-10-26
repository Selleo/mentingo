import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { Factory } from "fishery";

import { studentCourses } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type StudentCourseTest = Omit<InferInsertModel<typeof studentCourses>, "tenantId">;

export const createStudentCourseFactory = (db: DatabasePg) =>
  Factory.define<StudentCourseTest, never, InferSelectModel<typeof studentCourses>>(
    ({ onCreate }) => {
      onCreate(async (studentCourse) => {
        const [inserted] = await db.insert(studentCourses).values(studentCourse).returning();

        return inserted;
      });

      return {
        id: faker.string.uuid(),
        studentId: "",
        courseId: "",
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
        finishedChapterCount: 0,
      };
    },
  );
