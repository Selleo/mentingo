import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { COURSE_ENROLLMENT, COURSE_STATUSES } from "@repo/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { courseLearningStates, courses, studentCourses } from "src/storage/schema";

import { courseLearningContext } from "./course-learning-context";

import type { CourseRepetitionResponse } from "./course-repetition.schema";

export async function activeLearningStateId(db: DatabasePg, studentId: string, lessonId: string) {
  const context = courseLearningContext.getStore();
  if (context) return context.learningStateId;
  const rows = await db.execute<{ id: string }>(sql`
    SELECT cls.id FROM course_learning_states cls
    JOIN chapters ch ON ch.course_id = cls.course_id
    JOIN lessons l ON l.chapter_id = ch.id
    WHERE cls.student_id = ${studentId} AND l.id = ${lessonId}
    ORDER BY cls.kind DESC LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

export async function activeCourseLearningStateId(
  db: DatabasePg,
  studentId: string,
  courseId: string,
) {
  const context = courseLearningContext.getStore();
  if (context) return context.learningStateId;
  const [state] = await db
    .select({ id: courseLearningStates.id })
    .from(courseLearningStates)
    .where(
      and(
        eq(courseLearningStates.studentId, studentId),
        eq(courseLearningStates.courseId, courseId),
      ),
    )
    .orderBy(desc(courseLearningStates.kind))
    .limit(1);
  return state?.id ?? null;
}

@Injectable()
export class CourseRepetitionService {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async lock(courseId: string, studentId: string, db: DatabasePg) {
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${studentId}:${courseId}`}, 0))`,
    );
  }

  async ensureCurrent(courseId: string, studentId: string, db: DatabasePg = this.db) {
    const [existing] = await db
      .select()
      .from(courseLearningStates)
      .where(
        and(
          eq(courseLearningStates.courseId, courseId),
          eq(courseLearningStates.studentId, studentId),
          eq(courseLearningStates.kind, "current"),
        ),
      );
    if (existing) return existing;
    await this.lock(courseId, studentId, db);
    const [enrollment] = await db
      .select()
      .from(studentCourses)
      .where(and(eq(studentCourses.courseId, courseId), eq(studentCourses.studentId, studentId)));
    await db
      .insert(courseLearningStates)
      .values({
        courseId,
        studentId,
        kind: "current",
        completedAt: enrollment?.completedAt ?? null,
        finishedChapterCount: enrollment?.finishedChapterCount ?? 0,
      })
      .onConflictDoNothing();
    const [current] = await db
      .select()
      .from(courseLearningStates)
      .where(
        and(
          eq(courseLearningStates.courseId, courseId),
          eq(courseLearningStates.studentId, studentId),
          eq(courseLearningStates.kind, "current"),
        ),
      );
    await this.bindLegacyProgress(courseId, studentId, current.id, db);
    return current;
  }

  private async bindLegacyProgress(
    courseId: string,
    studentId: string,
    stateId: string,
    db: DatabasePg,
  ) {
    await db.execute(
      sql`UPDATE student_chapter_progress SET learning_state_id = ${stateId} WHERE course_id = ${courseId} AND student_id = ${studentId} AND learning_state_id IS NULL`,
    );
    await db.execute(
      sql`UPDATE student_lesson_progress p SET learning_state_id = ${stateId} FROM chapters ch WHERE ch.id = p.chapter_id AND ch.course_id = ${courseId} AND p.student_id = ${studentId} AND p.learning_state_id IS NULL`,
    );
    await db.execute(
      sql`UPDATE lesson_video_progress p SET learning_state_id = ${stateId} FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id WHERE l.id = p.lesson_id AND ch.course_id = ${courseId} AND p.student_id = ${studentId} AND p.learning_state_id IS NULL`,
    );
    await db.execute(
      sql`UPDATE assessment_attempts a SET learning_state_id = ${stateId} FROM assessments q JOIN lessons l ON l.id = q.lesson_id JOIN chapters ch ON ch.id = l.chapter_id WHERE a.assessment_id = q.id AND ch.course_id = ${courseId} AND a.learner_id = ${studentId} AND a.learning_state_id IS NULL`,
    );
    await db.execute(
      sql`UPDATE scorm_attempts SET learning_state_id = ${stateId} WHERE course_id = ${courseId} AND student_id = ${studentId} AND learning_state_id IS NULL`,
    );
    await db.execute(
      sql`UPDATE ai_mentor_threads t SET learning_state_id = ${stateId} FROM ai_mentor_lessons a JOIN lessons l ON l.id = a.lesson_id JOIN chapters ch ON ch.id = l.chapter_id WHERE t.ai_mentor_lesson_id = a.id AND ch.course_id = ${courseId} AND t.user_id = ${studentId} AND t.learning_state_id IS NULL`,
    );
  }

  async getInfo(
    courseId: string,
    studentId: string,
    db: DatabasePg = this.db,
  ): Promise<CourseRepetitionResponse> {
    const [course] = await db
      .select({ settings: courses.settings })
      .from(courses)
      .where(eq(courses.id, courseId));
    const states = await db
      .select()
      .from(courseLearningStates)
      .where(
        and(
          eq(courseLearningStates.courseId, courseId),
          eq(courseLearningStates.studentId, studentId),
        ),
      );
    const summary = (state: typeof courseLearningStates.$inferSelect | undefined) =>
      state
        ? {
            id: state.id,
            completedAt: state.completedAt,
            finishedChapterCount: state.finishedChapterCount,
          }
        : null;
    return {
      enabled: course?.settings.repetitionEnabled ?? false,
      current: summary(states.find((state) => state.kind === "current")),
      repetition: summary(states.find((state) => state.kind === "repetition")),
    };
  }

  async resolveWritableState(
    courseId: string,
    studentId: string,
    supplied: unknown,
    db: DatabasePg = this.db,
  ) {
    const [state] = await db
      .select()
      .from(courseLearningStates)
      .where(
        and(
          eq(courseLearningStates.courseId, courseId),
          eq(courseLearningStates.studentId, studentId),
        ),
      )
      .orderBy(desc(courseLearningStates.kind))
      .limit(1);
    const requiresIdentity = Boolean(
      state && (state.kind === "repetition" || state.previousStateId),
    );
    if ((supplied && supplied !== state?.id) || (requiresIdentity && !supplied))
      throw new ConflictException("courseRepetition.errors.staleState");
    return state?.id ?? null;
  }

  async repeat(courseId: UUIDType, studentId: UUIDType, currentStateId: UUIDType) {
    return this.db.transaction(async (db) => {
      await this.lock(courseId, studentId, db);
      const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
      const [enrollment] = await db
        .select()
        .from(studentCourses)
        .where(
          and(
            eq(studentCourses.courseId, courseId),
            eq(studentCourses.studentId, studentId),
            eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          ),
        );
      if (
        !course ||
        !enrollment ||
        (course.status !== COURSE_STATUSES.PUBLISHED && course.status !== COURSE_STATUSES.PRIVATE)
      ) {
        throw new ForbiddenException("courseRepetition.errors.accessDenied");
      }
      const states = await db
        .select()
        .from(courseLearningStates)
        .where(
          and(
            eq(courseLearningStates.courseId, courseId),
            eq(courseLearningStates.studentId, studentId),
          ),
        )
        .orderBy(desc(courseLearningStates.kind));
      const current = states.find((state) => state.kind === "current");
      const repetition = states.find((state) => state.kind === "repetition");
      if (
        repetition?.previousStateId === currentStateId ||
        current?.previousStateId === currentStateId
      )
        return this.getInfo(courseId, studentId, db);
      if (current?.id !== currentStateId)
        throw new ConflictException("courseRepetition.errors.staleState");
      if (!course.settings.repetitionEnabled || !enrollment.completedAt || repetition)
        throw new BadRequestException("courseRepetition.errors.unavailable");
      await this.bindLegacyProgress(courseId, studentId, current.id, db);
      await db
        .insert(courseLearningStates)
        .values({ courseId, studentId, kind: "repetition", previousStateId: current.id });
      return this.getInfo(courseId, studentId, db);
    });
  }

  async complete(
    courseId: string,
    studentId: string,
    finishedChapterCount: number,
    db: DatabasePg,
  ) {
    await this.lock(courseId, studentId, db);
    const states = await db
      .select()
      .from(courseLearningStates)
      .where(
        and(
          eq(courseLearningStates.courseId, courseId),
          eq(courseLearningStates.studentId, studentId),
        ),
      );
    const repetition = states.find((state) => state.kind === "repetition");
    if (repetition) {
      await db
        .delete(courseLearningStates)
        .where(
          and(
            eq(courseLearningStates.courseId, courseId),
            eq(courseLearningStates.studentId, studentId),
            eq(courseLearningStates.kind, "current"),
          ),
        );
      await db
        .update(courseLearningStates)
        .set({ kind: "current", completedAt: sql`now()`, finishedChapterCount })
        .where(eq(courseLearningStates.id, repetition.id));
    } else {
      await db
        .update(courseLearningStates)
        .set({ completedAt: sql`now()`, finishedChapterCount })
        .where(
          and(
            eq(courseLearningStates.courseId, courseId),
            eq(courseLearningStates.studentId, studentId),
            eq(courseLearningStates.kind, "current"),
            isNull(courseLearningStates.completedAt),
          ),
        );
    }
    return Boolean(repetition);
  }
}
