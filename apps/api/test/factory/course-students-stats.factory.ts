import { Factory } from "fishery";

import { courseStudentsStats } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

type CourseStudentsStatsTest = Omit<InferInsertModel<typeof courseStudentsStats>, "tenantId">;

export const createCourseStudentsStatsFactory = (db: DatabasePg) =>
  Factory.define<CourseStudentsStatsTest, never, InferSelectModel<typeof courseStudentsStats>>(
    ({ onCreate }) => {
      onCreate(async (studentsStats) => {
        const [inserted] = await db.insert(courseStudentsStats).values(studentsStats).returning();

        return inserted;
      });

      return {
        courseId: "",
        authorId: "",
        month: 1,
        year: 2025,
        newStudentsCount: 0,
      };
    },
  );
