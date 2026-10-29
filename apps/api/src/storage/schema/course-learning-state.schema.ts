import { COURSE_LEARNING_STATE_KINDS, type CourseLearningStateKind } from "@repo/shared";
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { id, tenantId, timestamps, timestampWithTimezone, withTenantIdIndex } from "./utils";

import { courses, users } from ".";

export const courseLearningStates = pgTable(
  "course_learning_states",
  {
    ...id,
    ...timestamps,
    tenantId,
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind")
      .$type<CourseLearningStateKind>()
      .notNull()
      .default(COURSE_LEARNING_STATE_KINDS.CURRENT),
    previousStateId: uuid("previous_state_id"),
    completedAt: timestampWithTimezone({ name: "completed_at" }),
    finishedChapterCount: integer("finished_chapter_count").notNull().default(0),
  },
  withTenantIdIndex("course_learning_states", (table) => ({
    learnerCourseKind: unique("course_learning_states_learner_course_kind").on(
      table.studentId,
      table.courseId,
      table.kind,
    ),
    kindCheck: check(
      "course_learning_states_kind_check",
      sql`${table.kind} IN ('current', 'repetition')`,
    ),
  })),
);
