import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { COURSE_LEARNING_STATE_KINDS, COURSE_ENROLLMENT, COURSE_STATUSES } from "@repo/shared";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import {
  aiMentorLessons,
  aiMentorThreads,
  assessmentAttempts,
  assessments,
  chapters,
  courseLearningStates,
  courses,
  lessons,
  lessonVideoProgress,
  scormAttempts,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import { courseLearningContext } from "./course-learning-context";

import type { CourseRepetitionResponse } from "./course-repetition.schema";

export async function activeLearningStateId(db: DatabasePg, studentId: string, lessonId: string) {
  const context = courseLearningContext.getStore();
  if (context) return context.learningStateId;
  const [state] = await db
    .select({ id: courseLearningStates.id })
    .from(courseLearningStates)
    .innerJoin(chapters, eq(chapters.courseId, courseLearningStates.courseId))
    .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
    .where(and(eq(courseLearningStates.studentId, studentId), eq(lessons.id, lessonId)))
    .orderBy(desc(courseLearningStates.kind))
    .limit(1);
  return state?.id ?? null;
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
          eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.CURRENT),
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
        kind: COURSE_LEARNING_STATE_KINDS.CURRENT,
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
          eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.CURRENT),
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
    const courseChapterIds = db
      .select({ id: chapters.id })
      .from(chapters)
      .where(eq(chapters.courseId, courseId));
    const courseLessonIds = db
      .select({ id: lessons.id })
      .from(lessons)
      .where(inArray(lessons.chapterId, courseChapterIds));

    await db
      .update(studentChapterProgress)
      .set({ learningStateId: stateId })
      .where(
        and(
          eq(studentChapterProgress.courseId, courseId),
          eq(studentChapterProgress.studentId, studentId),
          isNull(studentChapterProgress.learningStateId),
        ),
      );
    await db
      .update(studentLessonProgress)
      .set({ learningStateId: stateId })
      .where(
        and(
          inArray(studentLessonProgress.chapterId, courseChapterIds),
          eq(studentLessonProgress.studentId, studentId),
          isNull(studentLessonProgress.learningStateId),
        ),
      );
    await db
      .update(lessonVideoProgress)
      .set({ learningStateId: stateId })
      .where(
        and(
          inArray(lessonVideoProgress.lessonId, courseLessonIds),
          eq(lessonVideoProgress.studentId, studentId),
          isNull(lessonVideoProgress.learningStateId),
        ),
      );
    await db
      .update(assessmentAttempts)
      .set({ learningStateId: stateId })
      .where(
        and(
          inArray(
            assessmentAttempts.assessmentId,
            db
              .select({ id: assessments.id })
              .from(assessments)
              .where(inArray(assessments.lessonId, courseLessonIds)),
          ),
          eq(assessmentAttempts.learnerId, studentId),
          isNull(assessmentAttempts.learningStateId),
        ),
      );
    await db
      .update(scormAttempts)
      .set({ learningStateId: stateId })
      .where(
        and(
          eq(scormAttempts.courseId, courseId),
          eq(scormAttempts.studentId, studentId),
          isNull(scormAttempts.learningStateId),
        ),
      );
    await db
      .update(aiMentorThreads)
      .set({ learningStateId: stateId })
      .where(
        and(
          inArray(
            aiMentorThreads.aiMentorLessonId,
            db
              .select({ id: aiMentorLessons.id })
              .from(aiMentorLessons)
              .where(inArray(aiMentorLessons.lessonId, courseLessonIds)),
          ),
          eq(aiMentorThreads.userId, studentId),
          isNull(aiMentorThreads.learningStateId),
        ),
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
      current: summary(states.find((state) => state.kind === COURSE_LEARNING_STATE_KINDS.CURRENT)),
      repetition: summary(
        states.find((state) => state.kind === COURSE_LEARNING_STATE_KINDS.REPETITION),
      ),
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
      state && (state.kind === COURSE_LEARNING_STATE_KINDS.REPETITION || state.previousStateId),
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
      const current = states.find((state) => state.kind === COURSE_LEARNING_STATE_KINDS.CURRENT);
      const repetition = states.find(
        (state) => state.kind === COURSE_LEARNING_STATE_KINDS.REPETITION,
      );
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
      await db.insert(courseLearningStates).values({
        courseId,
        studentId,
        kind: COURSE_LEARNING_STATE_KINDS.REPETITION,
        previousStateId: current.id,
      });
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
    const repetition = states.find(
      (state) => state.kind === COURSE_LEARNING_STATE_KINDS.REPETITION,
    );
    if (repetition) {
      await db
        .delete(courseLearningStates)
        .where(
          and(
            eq(courseLearningStates.courseId, courseId),
            eq(courseLearningStates.studentId, studentId),
            eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.CURRENT),
          ),
        );
      await db
        .update(courseLearningStates)
        .set({
          kind: COURSE_LEARNING_STATE_KINDS.CURRENT,
          completedAt: sql`now()`,
          finishedChapterCount,
        })
        .where(eq(courseLearningStates.id, repetition.id));
    } else {
      await db
        .update(courseLearningStates)
        .set({ completedAt: sql`now()`, finishedChapterCount })
        .where(
          and(
            eq(courseLearningStates.courseId, courseId),
            eq(courseLearningStates.studentId, studentId),
            eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.CURRENT),
            isNull(courseLearningStates.completedAt),
          ),
        );
    }
    return Boolean(repetition);
  }
}
