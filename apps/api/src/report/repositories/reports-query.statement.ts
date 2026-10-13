import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { sql } from "drizzle-orm";

import { REPORT_VIEWS } from "../constants/reports.constants";

import type { ReportStatementContext } from "./reports-query.types";
import type { SQL } from "drizzle-orm";

function uuidArray(values: readonly string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::uuid[]`;
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}::uuid`),
    sql`, `,
  )}]`;
}

export function buildReportStatement(
  context: ReportStatementContext,
  foundationalCtes: SQL[],
): SQL {
  const ctes = [
    ...foundationalCtes,
    buildLearnerPopulationCte(context),
    buildQuizFactsCtes(context),
    buildCourseFactsCte(context),
    buildPathFactsCtes(context),
    buildFilteredRowsCtes(context),
    buildSummaryCte(context),
    buildBreakdownCtes(context),
    buildPageRowsCte(context),
  ];
  return sql`WITH ${sql.join(ctes, sql`, `)} ${buildResultProjection()}`;
}

function buildLearnerPopulationCte(context: ReportStatementContext): SQL {
  return sql`
          scoped_learners AS (
            SELECT u.tenant_id, u.id AS learner_id, u.email AS learner_email,
              CONCAT_WS(' ', u.first_name, u.last_name) AS learner_name,
              NULL::uuid AS course_id, NULL::text AS course_title, NULL::uuid AS path_id,
              NULL::text AS path_title, NULL::uuid AS author_id, NULL::text AS status,
              NULL::numeric AS progress, NULL::numeric AS score, 0::int AS attempts,
              NULL::text AS certificate_status, NULL::timestamptz AS certificate_issued_at,
              NULL::timestamptz AS enrolled_at, NULL::timestamptz AS completed_at,
              NULL::timestamptz AS last_activity_at,
              COALESCE(group_data.group_ids, ARRAY[]::uuid[]) AS group_ids,
              '[]'::jsonb AS path_courses
            FROM users u
            JOIN permission_user_roles pur ON pur.user_id = u.id AND pur.tenant_id = u.tenant_id
            JOIN permission_roles pr ON pr.id = pur.role_id AND pr.tenant_id = pur.tenant_id
              AND pr.slug = ${SYSTEM_ROLE_SLUGS.STUDENT}
            LEFT JOIN learner_groups group_data ON group_data.tenant_id = u.tenant_id AND group_data.user_id = u.id
            WHERE u.tenant_id = ${context.access.tenantId} AND u.deleted_at IS NULL
              AND (
                ${context.access.canReadOrganisation}
                OR (${context.access.canReadManagedGroups} AND EXISTS (
                  SELECT 1 FROM group_users gu_scope WHERE gu_scope.tenant_id = u.tenant_id
                    AND gu_scope.user_id = u.id AND gu_scope.group_id = ANY(${uuidArray(
                      context.managedGroupIds,
                    )})
                ))
                OR (${context.access.ownedCoursesOnly} AND EXISTS (
                  SELECT 1 FROM scoped_enrollments own_enrollment
                  JOIN courses own_course ON own_course.tenant_id = own_enrollment.tenant_id
                    AND own_course.id = own_enrollment.course_id
                  WHERE own_enrollment.student_id = u.id AND own_course.author_id = ${
                    context.access.userId
                  }
                ))
              )
              ${
                context.query.groupIds.length
                  ? sql`AND EXISTS (
                SELECT 1 FROM group_users gu_group WHERE gu_group.tenant_id = u.tenant_id
                  AND gu_group.user_id = u.id AND gu_group.group_id = ANY(${uuidArray(
                    context.query.groupIds,
                  )})
              )`
                  : sql``
              }
              ${
                context.query.view === REPORT_VIEWS.LEARNER
                  ? sql`AND u.id = ${context.query.subjectId}`
                  : sql``
              }
          )
  `;
}

function buildQuizFactsCtes(context: ReportStatementContext): SQL {
  return sql`
          submitted_quiz_attempts AS MATERIALIZED (
            SELECT aa.tenant_id, aa.learner_id, aa.assessment_id, ch.course_id,
              aa.score_percentage, aa.grading_status, aa.submitted_at, aa.attempt_number, aa.graded_at
            FROM assessment_attempts aa
            JOIN assessments a ON a.id = aa.assessment_id AND a.tenant_id = aa.tenant_id
            JOIN lessons l ON l.id = a.lesson_id AND l.tenant_id = aa.tenant_id
            JOIN chapters ch ON ch.id = l.chapter_id AND ch.tenant_id = aa.tenant_id
            WHERE aa.tenant_id = ${context.access.tenantId} AND aa.submission_status = 'submitted'
          ),
          scoped_quiz_attempts AS MATERIALIZED (
            SELECT qa.*
            FROM submitted_quiz_attempts qa
            JOIN scoped_enrollments se ON se.tenant_id = qa.tenant_id
              AND se.student_id = qa.learner_id AND se.course_id = qa.course_id
          ),
          latest_quiz_scores AS (
            SELECT DISTINCT ON (aa.learner_id, aa.assessment_id)
              aa.learner_id AS student_id,
              aa.course_id,
              aa.assessment_id,
              aa.score_percentage::numeric AS score_percentage
            FROM scoped_quiz_attempts aa
            WHERE aa.grading_status = 'graded'
              AND aa.score_percentage IS NOT NULL
            ORDER BY aa.learner_id, aa.assessment_id, aa.submitted_at DESC,
              aa.attempt_number DESC, aa.graded_at DESC
          ),
          quiz_scores AS (
            SELECT student_id, course_id, AVG(score_percentage)::numeric AS average_score
            FROM latest_quiz_scores
            GROUP BY student_id, course_id
          ),
          quiz_attempt_counts AS (
            SELECT aa.learner_id AS student_id, aa.course_id,
              COUNT(*)::int AS submitted_attempts, MAX(aa.submitted_at) AS last_submitted_at
            FROM scoped_quiz_attempts aa
            GROUP BY aa.learner_id, aa.course_id
          ),
          quiz_attempts AS (
            SELECT COALESCE(qs.student_id, qc.student_id) AS student_id,
              COALESCE(qs.course_id, qc.course_id) AS course_id,
              qs.average_score,
              COALESCE(qc.submitted_attempts, 0)::int AS submitted_attempts,
              qc.last_submitted_at
            FROM quiz_scores qs
            FULL JOIN quiz_attempt_counts qc
              ON qc.student_id = qs.student_id AND qc.course_id = qs.course_id
          )
  `;
}

function buildCourseFactsCte(context: ReportStatementContext): SQL {
  return sql`
          course_facts AS (
            SELECT
              sc.tenant_id,
              sc.student_id AS learner_id,
              sc.course_id,
              sc.enrolled_at,
              sc.completed_at,
              u.email AS learner_email,
              CONCAT_WS(' ', u.first_name, u.last_name) AS learner_name,
              c.author_id,
              ${context.localizedCourseTitle} AS course_title,
              CASE
                WHEN sc.completed_at IS NOT NULL OR sc.progress = 'completed' THEN 'completed'
                WHEN sc.progress IN ('in_progress', 'blocked') OR COALESCE(progress.started, FALSE) THEN 'inProgress'
                ELSE 'notStarted'
              END AS status,
              CASE WHEN COALESCE(lesson_counts.total_lessons, 0) = 0 THEN NULL
                ELSE ROUND(COALESCE(progress.completed_lessons, 0)::numeric * 100 / lesson_counts.total_lessons, 2)
              END AS progress,
              quiz.average_score AS score,
              COALESCE(quiz.submitted_attempts, 0)::int AS attempts,
              CASE
                WHEN cert.id IS NULL THEN 'notEarned'
                WHEN cert.status = 'active' AND (cert.expires_at IS NULL OR cert.expires_at > CURRENT_TIMESTAMP) THEN 'active'
                WHEN cert.archive_reason = 'expired' OR cert.expires_at <= CURRENT_TIMESTAMP THEN 'expired'
                ELSE 'revoked'
              END AS certificate_status,
              cert.issued_at AS certificate_issued_at,
              GREATEST(sc.last_opened_at, sc.completed_at, progress.last_completed_at,
                quiz.last_submitted_at) AS last_activity_at,
              COALESCE(group_data.group_ids, ARRAY[]::uuid[]) AS group_ids,
              NULL::uuid AS path_id,
              NULL::text AS path_title,
              '[]'::jsonb AS path_courses
            FROM scoped_enrollments sc
            JOIN users u ON u.id = sc.student_id AND u.tenant_id = sc.tenant_id AND u.deleted_at IS NULL
            JOIN courses c ON c.id = sc.course_id AND c.tenant_id = sc.tenant_id
            LEFT JOIN learner_course_progress progress ON progress.tenant_id = sc.tenant_id
              AND progress.learner_id = sc.student_id AND progress.course_id = sc.course_id
            LEFT JOIN course_lesson_counts lesson_counts ON lesson_counts.tenant_id = sc.tenant_id
              AND lesson_counts.course_id = sc.course_id
            LEFT JOIN quiz_attempts quiz ON quiz.student_id = sc.student_id AND quiz.course_id = sc.course_id
            LEFT JOIN latest_course_certificates cert ON cert.tenant_id = sc.tenant_id
              AND cert.user_id = sc.student_id AND cert.course_id = sc.course_id
            LEFT JOIN learner_groups group_data ON group_data.tenant_id = sc.tenant_id AND group_data.user_id = sc.student_id
          )
  `;
}

function buildPathFactsCtes(context: ReportStatementContext): SQL {
  return sql`
          path_course_facts AS (
            SELECT slpc.tenant_id, slpc.student_id AS learner_id, slpc.learning_path_id AS path_id,
              cf.course_id, cf.course_title, cf.status, cf.progress, cf.score, cf.attempts,
              cf.certificate_status, cf.certificate_issued_at, cf.enrolled_at, cf.completed_at,
              cf.last_activity_at, cf.author_id
            FROM student_learning_path_courses slpc
            JOIN course_facts cf ON cf.tenant_id = slpc.tenant_id
              AND cf.learner_id = slpc.student_id AND cf.course_id = slpc.course_id
            WHERE slpc.tenant_id = ${context.access.tenantId}
          ),
          path_facts AS (
            SELECT slp.tenant_id, slp.student_id AS learner_id, NULL::uuid AS course_id,
              NULL::text AS course_title, slp.enrolled_at, slp.completed_at, u.email AS learner_email,
              CONCAT_WS(' ', u.first_name, u.last_name) AS learner_name,
              lp.author_id, ${context.localizedPathTitle} AS path_title,
              lp.id AS path_id,
              CASE WHEN slp.completed_at IS NOT NULL OR slp.progress = 'completed' THEN 'completed'
                WHEN slp.progress <> 'not_started' OR BOOL_OR(pcf.status IN ('inProgress', 'completed')) THEN 'inProgress'
                ELSE 'notStarted' END AS status,
              CASE WHEN COUNT(pcf.course_id) = 0 THEN NULL
                ELSE ROUND(COUNT(*) FILTER (WHERE pcf.status = 'completed')::numeric * 100 / COUNT(pcf.course_id), 2)
              END AS progress,
              AVG(pcf.score)::numeric AS score,
              COALESCE(SUM(pcf.attempts), 0)::int AS attempts,
              CASE
                WHEN path_cert.id IS NULL THEN 'notEarned'
                WHEN path_cert.status = 'active' AND (path_cert.expires_at IS NULL OR path_cert.expires_at > CURRENT_TIMESTAMP) THEN 'active'
                WHEN path_cert.status = 'expired' OR path_cert.expires_at <= CURRENT_TIMESTAMP THEN 'expired'
                ELSE 'revoked'
              END AS certificate_status,
              path_cert.issued_at AS certificate_issued_at,
              MAX(pcf.last_activity_at) AS last_activity_at,
              COALESCE(group_data.group_ids, ARRAY[]::uuid[]) AS group_ids,
              COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
                'courseId', pcf.course_id, 'courseTitle', pcf.course_title, 'status', pcf.status,
                'progress', pcf.progress,
                'enrolledAt', CASE WHEN pcf.enrolled_at IS NULL THEN NULL ELSE
                  TO_CHAR(pcf.enrolled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
                'completedAt', CASE WHEN pcf.completed_at IS NULL THEN NULL ELSE
                  TO_CHAR(pcf.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
                'score', pcf.score, 'attempts', pcf.attempts, 'certificateStatus', pcf.certificate_status,
                'lastActivityAt', CASE WHEN pcf.last_activity_at IS NULL THEN NULL ELSE
                  TO_CHAR(pcf.last_activity_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
              ) ORDER BY lpc.display_order) FILTER (WHERE pcf.course_id IS NOT NULL), '[]'::jsonb) AS path_courses
            FROM student_learning_paths slp
            JOIN users u ON u.id = slp.student_id AND u.tenant_id = slp.tenant_id AND u.deleted_at IS NULL
            JOIN learning_paths lp ON lp.id = slp.learning_path_id AND lp.tenant_id = slp.tenant_id
            LEFT JOIN path_course_facts pcf ON pcf.tenant_id = slp.tenant_id
              AND pcf.learner_id = slp.student_id AND pcf.path_id = slp.learning_path_id
            LEFT JOIN learning_path_courses lpc ON lpc.tenant_id = pcf.tenant_id
              AND lpc.learning_path_id = pcf.path_id AND lpc.course_id = pcf.course_id
            LEFT JOIN LATERAL (
              SELECT cert.id, cert.status, cert.issued_at, cert.expires_at
              FROM learning_path_certificates cert
              WHERE cert.tenant_id = slp.tenant_id AND cert.user_id = slp.student_id
                AND cert.learning_path_id = slp.learning_path_id
              ORDER BY cert.issued_at DESC LIMIT 1
            ) path_cert ON TRUE
            LEFT JOIN learner_groups group_data ON group_data.tenant_id = slp.tenant_id AND group_data.user_id = slp.student_id
            WHERE slp.tenant_id = ${context.access.tenantId} AND ${context.pathPopulationSql}
            GROUP BY slp.tenant_id, slp.student_id, slp.enrolled_at, slp.completed_at, slp.progress,
              u.email, u.first_name, u.last_name, lp.author_id, lp.title, lp.base_language, lp.available_locales, lp.id,
              path_cert.id, path_cert.status, path_cert.issued_at, path_cert.expires_at, group_data.group_ids
          )
  `;
}

function buildFilteredRowsCtes(context: ReportStatementContext): SQL {
  return sql`
          view_rows AS (
            ${context.fromSql}
          ),
          filtered AS (
            SELECT r.* FROM view_rows r
            WHERE ${context.filterSql}
          ),
          filtered_course_keys AS MATERIALIZED (
            SELECT DISTINCT tenant_id, learner_id, course_id
            FROM filtered
            WHERE course_id IS NOT NULL
          ),
          population_filtered AS (
            SELECT r.* FROM scoped_learners r
            WHERE ${context.includeNoEnrollmentLearners ? context.filterSql : sql`FALSE`}
          ),
          matching_learners AS (
            SELECT learner_id FROM filtered
            UNION
            SELECT learner_id FROM population_filtered
          )
  `;
}

function buildSummaryCte(context: ReportStatementContext): SQL {
  return sql`
          summary AS (
            SELECT COUNT(*)::int AS total, (SELECT COUNT(*)::int FROM matching_learners) AS learners,
              ${
                context.query.view === REPORT_VIEWS.DEVELOPMENT_PATHS
                  ? sql`COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(r.path_courses) pc WHERE pc ->> 'status' = 'completed')), 0)::int`
                  : sql`COUNT(*) FILTER (WHERE r.status = 'completed')::int`
              } AS course_completions,
              COUNT(DISTINCT learner_id) FILTER (WHERE last_activity_at >= CURRENT_TIMESTAMP - INTERVAL '30 days')::int AS active_learners_30d,
              COUNT(*) FILTER (WHERE certificate_status = 'active')::int AS active_certificates,
              COUNT(*) FILTER (WHERE certificate_issued_at IS NOT NULL)::int AS certificates_issued,
              COUNT(*) FILTER (WHERE score IS NOT NULL)::int AS scored_enrollments,
              ${
                context.query.view === REPORT_VIEWS.DEVELOPMENT_PATHS
                  ? sql`COUNT(*) FILTER (WHERE status = 'completed')::int`
                  : sql`COALESCE((SELECT COUNT(DISTINCT (slp.student_id, slp.learning_path_id))::int
                  FROM student_learning_path_courses slpc
                  JOIN student_learning_paths slp ON slp.tenant_id = slpc.tenant_id
                    AND slp.student_id = slpc.student_id AND slp.learning_path_id = slpc.learning_path_id
                  JOIN filtered_course_keys fkeys ON fkeys.tenant_id = slpc.tenant_id
                    AND fkeys.learner_id = slpc.student_id AND fkeys.course_id = slpc.course_id
                  WHERE slp.tenant_id = ${context.access.tenantId}
                    AND (slp.completed_at IS NOT NULL OR slp.progress = 'completed')), 0)::int`
              }
                AS completed_paths,
              ${
                context.query.view === REPORT_VIEWS.DEVELOPMENT_PATHS
                  ? sql`COALESCE(SUM(jsonb_array_length(r.path_courses)), 0)::numeric`
                  : sql`COUNT(*)::numeric`
              } AS course_enrollments,
              AVG(progress)::numeric AS average_progress, AVG(score)::numeric AS average_score
            FROM filtered r
          )
  `;
}

function buildBreakdownCtes(context: ReportStatementContext): SQL {
  return sql`
          group_breakdown AS (
            SELECT gu.group_id::text AS id,
              ${context.localizedGroupName} AS label,
              COUNT(DISTINCT f.learner_id)::int AS learners,
              ${
                context.query.view === REPORT_VIEWS.DEVELOPMENT_PATHS
                  ? sql`COALESCE(SUM(jsonb_array_length(f.path_courses)), 0)::int`
                  : sql`COUNT(*)::int`
              } AS course_enrollments,
              ${
                context.query.view === REPORT_VIEWS.DEVELOPMENT_PATHS
                  ? sql`COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(f.path_courses) pc WHERE pc ->> 'status' = 'completed')), 0)::int`
                  : sql`COUNT(*) FILTER (WHERE f.status = 'completed')::int`
              } AS course_completions
            FROM filtered f JOIN group_users gu ON gu.tenant_id = f.tenant_id AND gu.user_id = f.learner_id
              AND gu.group_id = ANY(${uuidArray(context.authorizedGroupIds)})
            JOIN groups g ON g.id = gu.group_id AND g.tenant_id = gu.tenant_id
            GROUP BY gu.group_id, g.name, g.base_language, g.available_locales
          ),
          course_breakdown AS (
            SELECT course_id::text AS id, MAX(course_title) AS label,
              COUNT(DISTINCT learner_id)::int AS learners, COUNT(*)::int AS course_enrollments,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS course_completions
            FROM filtered WHERE course_id IS NOT NULL GROUP BY course_id
          ),
          path_breakdown AS (
            SELECT pcf.path_id::text AS id, MAX(pf.path_title) AS label,
              COUNT(DISTINCT pcf.learner_id)::int AS learners, COUNT(*)::int AS course_enrollments,
              COUNT(*) FILTER (WHERE pcf.status = 'completed')::int AS course_completions
            FROM path_course_facts pcf
            JOIN filtered f ON f.tenant_id = pcf.tenant_id AND f.learner_id = pcf.learner_id
              AND (f.course_id = pcf.course_id OR f.path_id = pcf.path_id)
            JOIN path_facts pf ON pf.tenant_id = pcf.tenant_id AND pf.learner_id = pcf.learner_id
              AND pf.path_id = pcf.path_id
            GROUP BY pcf.path_id
          )
  `;
}

function buildPageRowsCte(context: ReportStatementContext): SQL {
  return sql`
          page_rows AS (
            SELECT * FROM filtered ORDER BY learner_name, COALESCE(course_title, path_title)
            LIMIT ${context.pageLimit} OFFSET ${context.pageOffset}
          )
  `;
}

function buildResultProjection(): SQL {
  return sql`
          SELECT summary.*,
            COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', id, 'label', label, 'learners', learners,
              'courseEnrollments', course_enrollments, 'courseCompletions', course_completions,
              'completionRate', CASE WHEN course_enrollments = 0 THEN NULL ELSE ROUND(course_completions::numeric * 100 / course_enrollments, 2) END)
              ORDER BY learners DESC, label) FROM group_breakdown), '[]'::jsonb) AS groups,
            COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', id, 'label', label, 'learners', learners,
              'courseEnrollments', course_enrollments, 'courseCompletions', course_completions,
              'completionRate', CASE WHEN course_enrollments = 0 THEN NULL ELSE ROUND(course_completions::numeric * 100 / course_enrollments, 2) END)
              ORDER BY learners DESC, label) FROM course_breakdown), '[]'::jsonb) AS courses,
            COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', id, 'label', label, 'learners', learners,
              'courseEnrollments', course_enrollments, 'courseCompletions', course_completions,
              'completionRate', CASE WHEN course_enrollments = 0 THEN NULL ELSE ROUND(course_completions::numeric * 100 / course_enrollments, 2) END)
              ORDER BY learners DESC, label) FROM path_breakdown), '[]'::jsonb) AS paths,
            COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
              'id', learner_id::text || ':' || COALESCE(course_id::text, '') || COALESCE(':' || path_id::text, ''),
              'learner', JSONB_BUILD_OBJECT('id', learner_id, 'name', learner_name, 'email', learner_email),
              'course', CASE WHEN course_id IS NULL THEN NULL::jsonb
                ELSE JSONB_BUILD_OBJECT('id', course_id, 'title', course_title) END,
              'path', CASE WHEN path_id IS NULL THEN NULL::jsonb
                ELSE JSONB_BUILD_OBJECT('id', path_id, 'title', path_title) END,
              'status', status, 'progress', progress, 'score', score, 'attempts', attempts,
              'certificate', JSONB_BUILD_OBJECT('status', certificate_status, 'issuedAt',
                CASE WHEN certificate_issued_at IS NULL THEN NULL ELSE
                  TO_CHAR(certificate_issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END),
              'enrolledAt', CASE WHEN enrolled_at IS NULL THEN NULL ELSE
                TO_CHAR(enrolled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
              'completedAt', CASE WHEN completed_at IS NULL THEN NULL ELSE
                TO_CHAR(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
              'lastActivityAt', CASE WHEN last_activity_at IS NULL THEN NULL ELSE
                TO_CHAR(last_activity_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
              'groupIds', group_ids, 'pathCourses', path_courses
            ) ORDER BY learner_name, COALESCE(course_title, path_title)) FROM page_rows), '[]'::jsonb) AS rows
          FROM summary
  `;
}
