import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { coursesSummaryStats } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type CourseSummaryStatsTest = Omit<InferInsertModel<typeof coursesSummaryStats>, "tenantId">;

export const createCourseSummaryStatsFactory = (db: DatabasePg) =>
  Factory.define<CourseSummaryStatsTest, never, InferSelectModel<typeof coursesSummaryStats>>(
    ({ onCreate }) => {
      onCreate(async (summaryStats) => {
        const [inserted] = await db.insert(coursesSummaryStats).values(summaryStats).returning();

        return inserted;
      });

      return {
        id: faker.string.uuid(),
        courseId: "",
        authorId: "",
        freePurchasedCount: 0,
        paidPurchasedCount: 0,
        paidPurchasedAfterFreemiumCount: 0,
        completedFreemiumStudentCount: 0,
        completedCourseStudentCount: 0,
      };
    },
  );
