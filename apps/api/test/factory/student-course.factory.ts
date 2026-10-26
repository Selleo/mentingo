import { COURSE_ENROLLMENT, COURSE_PROGRESS_STATUSES } from "@repo/shared";
import { Factory } from "fishery";

import { studentCourses } from "src/storage/schema";

import type { InferInsertModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

type StudentCourseTest = Pick<
  InferInsertModel<typeof studentCourses>,
  "studentId" | "courseId" | "status" | "progress"
>;

/** Enrolls a learner in a course; pass `studentId` and `courseId`. */
export const createStudentCourseFactory = (db: DatabasePg) =>
  Factory.define<StudentCourseTest>(({ onCreate }) => {
    onCreate(async (enrollment) => {
      const [inserted] = await db.insert(studentCourses).values(enrollment).returning();

      return inserted;
    });

    return {
      studentId: "",
      courseId: "",
      status: COURSE_ENROLLMENT.ENROLLED,
      progress: COURSE_PROGRESS_STATUSES.NOT_STARTED,
    };
  });
