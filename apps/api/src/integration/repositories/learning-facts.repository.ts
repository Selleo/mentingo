import { Inject, Injectable } from "@nestjs/common";
import {
  LESSON_TYPES,
  CERTIFICATE_STATUSES,
  CERTIFICATE_ARCHIVE_REASONS,
  COURSE_ENROLLMENT,
} from "@repo/shared";
import { sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { currentLearningState } from "src/course-repetition/course-learning-state.sql";
import { DB } from "src/storage/db/db.providers";

import type { LearningFact } from "@mentingo/competencies-sdk";

@Injectable()
export class LearningFactsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}
  async sourcePairs(subjectIds: string[]) {
    if (!subjectIds.length) return [];
    const subjects = sql.join(
      subjectIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const result = await this.db
      .execute(sql`SELECT DISTINCT student_id AS "subjectId",course_id AS "courseId" FROM student_courses
      WHERE student_id IN (${subjects})
      UNION SELECT DISTINCT p.student_id,ch.course_id FROM student_lesson_progress p JOIN chapters ch ON ch.id=p.chapter_id
      WHERE p.student_id IN (${subjects})`);
    return result.map((row) => ({
      subjectId: String(row.subjectId),
      courseId: String(row.courseId),
    }));
  }
  async snapshot(subjectId: string, courseId: string) {
    const rows = await this.db.execute(sql`
      WITH source_certificate AS (
        SELECT * FROM certificates WHERE user_id=${subjectId} AND course_id=${courseId}
        ORDER BY issued_at DESC,created_at DESC,id DESC LIMIT 1
      ), source_facts AS (
        SELECT jsonb_build_object(
          'id','course:' || e.id::text || ':' || COALESCE(s.id::text,'legacy'),
          'courseId',c.id,'subjectId',e.student_id,'kind','course','resourceId',c.id,'learningStateId',s.id,
          'revision',floor(extract(epoch FROM GREATEST(e.updated_at,c.updated_at,s.updated_at,cert.updated_at,cert.archived_at))*1000000),
          'occurredAt',e.completed_at,'validUntil',CASE WHEN c.has_certificate THEN cert.expires_at ELSE NULL END,
          'outcome',CASE WHEN e.completed_at IS NULL OR e.status <> ${COURSE_ENROLLMENT.ENROLLED} OR c.is_archived THEN 'revoked'
            WHEN c.has_certificate AND (cert.id IS NULL OR (cert.status <> ${CERTIFICATE_STATUSES.ACTIVE} AND cert.archive_reason IS DISTINCT FROM ${CERTIFICATE_ARCHIVE_REASONS.EXPIRED})) THEN 'failed' ELSE 'passed' END,
          'score',NULL) AS fact
        FROM student_courses e JOIN courses c ON c.id=e.course_id
        LEFT JOIN course_learning_states s ON s.student_id=e.student_id AND s.course_id=e.course_id AND s.kind='current'
        LEFT JOIN source_certificate cert ON true
        WHERE e.student_id=${subjectId} AND e.course_id=${courseId} AND e.completed_at IS NOT NULL
        UNION ALL
        SELECT jsonb_build_object(
          'id','lesson:' || p.id::text,'courseId',ch.course_id,'subjectId',p.student_id,
          'kind',CASE WHEN l.type=${LESSON_TYPES.QUIZ} THEN 'quiz' ELSE 'ai-mentor' END,'resourceId',l.id,'learningStateId',p.learning_state_id,
          'revision',floor(extract(epoch FROM GREATEST(p.updated_at,a.updated_at,l.updated_at))*1000000),
          'occurredAt',p.completed_at,'validUntil',NULL,
          'outcome',CASE WHEN l.type=${LESSON_TYPES.QUIZ} AND p.is_quiz_passed THEN 'passed' WHEN l.type=${LESSON_TYPES.AI_MENTOR} AND a.passed THEN 'passed' ELSE 'failed' END,
          'score',CASE WHEN l.type=${LESSON_TYPES.QUIZ} THEN p.quiz_score ELSE a.percentage END) AS fact
        FROM student_lesson_progress p JOIN lessons l ON l.id=p.lesson_id JOIN chapters ch ON ch.id=p.chapter_id
        LEFT JOIN ai_mentor_student_lesson_progress a ON a.student_lesson_progress_id=p.id
        WHERE p.student_id=${subjectId} AND ch.course_id=${courseId} AND p.completed_at IS NOT NULL AND l.type IN (${LESSON_TYPES.QUIZ},${LESSON_TYPES.AI_MENTOR})
          AND ${currentLearningState(sql`p.learning_state_id`)}
      ) SELECT fact, floor(extract(epoch FROM statement_timestamp())*1000000) AS snapshot_revision FROM source_facts
      UNION ALL SELECT NULL, floor(extract(epoch FROM statement_timestamp())*1000000) WHERE NOT EXISTS(SELECT 1 FROM source_facts)`);
    const facts = rows
      .filter((row) => row.fact !== null)
      .map((row) => {
        const value = row.fact as LearningFact;
        return {
          ...value,
          revision: Number(value.revision),
          occurredAt: new Date(value.occurredAt).toISOString(),
          validUntil: value.validUntil ? new Date(value.validUntil).toISOString() : null,
        };
      });
    return { subjectId, courseId, revision: Number(rows[0].snapshot_revision), facts };
  }
}
