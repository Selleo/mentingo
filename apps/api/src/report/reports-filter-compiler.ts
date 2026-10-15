import {
  and,
  between,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  or,
  sql,
} from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";
import { match, P } from "ts-pattern";

import { groupUsers, studentLearningPathCourses, studentLearningPaths } from "src/storage/schema";

import {
  REPORT_CALENDAR_DATE_PATTERN,
  REPORT_DATE_FIELDS,
  REPORT_NUMERIC_FIELDS,
  REPORT_ROW_COLUMNS,
  REPORT_UUID_PATTERN,
} from "./constants/reports-filter.constants";
import {
  REPORT_CERTIFICATE_STATUS,
  REPORT_FILTER_FIELDS as FIELD,
  REPORT_FILTER_MATCH,
  REPORT_FILTER_OPERATORS as OPERATOR,
} from "./constants/reports.constants";

import type { ReportFilterMatch } from "./constants/reports.constants";
import type {
  ReportFilterCompilerContext,
  ReportFilterRule,
  ReportFilterValue,
} from "./reports-filter.types";
import type { ReportFilter, ReportFilterCondition } from "./schemas/reports.schema";
import type { SQL } from "drizzle-orm";

const queryBuilder = new QueryBuilder();

/**
 * Turns a report filter into a SQL predicate over the report row `r`.
 * Column names are fixed here; only validated filter values become query parameters.
 */
export function compileReportsFilter(
  filter: ReportFilter | undefined,
  timezone: string,
  options: { pathView?: boolean; authorizedGroupIds?: readonly string[] } = {},
): SQL {
  if (!filter) return sql`TRUE`;

  const context: ReportFilterCompilerContext = {
    timezone,
    pathView: options.pathView ?? false,
    authorizedGroupIds: options.authorizedGroupIds ?? [],
  };
  const predicates = filter.rules.map((rule) => compileRule(rule, context));

  return combine(predicates, filter.match);
}

function compileRule(rule: ReportFilterRule, context: ReportFilterCompilerContext): SQL {
  return match(rule)
    .with({ field: P.string }, (condition) => compileCondition(condition, context))
    .otherwise((group) =>
      combine(
        group.rules.map((condition) => compileCondition(condition, context)),
        group.match,
      ),
    );
}

function compileCondition(
  condition: ReportFilterCondition,
  context: ReportFilterCompilerContext,
): SQL {
  const { field, operator } = condition;

  return match({ field, operator, pathView: context.pathView })
    .with({ field: FIELD.COURSE_ID, pathView: true }, () => matchPathCourses(condition))
    .with({ field: FIELD.PATH_ID, pathView: false }, () => matchPathEnrollment(condition))
    .with({ field: FIELD.GROUP_ID }, () =>
      matchGroupMembership(condition, context.authorizedGroupIds),
    )
    .with(
      {
        field: FIELD.LEARNER,
        operator: P.union(OPERATOR.CONTAINS, OPERATOR.EQ, OPERATOR.NEQ, OPERATOR.IN),
      },
      () => matchLearner(condition),
    )
    .otherwise(() => compareColumn(condition, context.timezone));
}

/**
 * A learner matches a group condition through their current membership.
 * "Has no group" means no membership in any group the viewer is allowed to see.
 */
function matchGroupMembership(
  condition: ReportFilterCondition,
  authorizedGroupIds: readonly string[],
): SQL {
  const membership = alias(groupUsers, "gu_filter");
  const groupIds = isPresenceOperator(condition)
    ? [...authorizedGroupIds]
    : readValues(condition).map(String);

  const isMember = exists(
    queryBuilder
      .select({ one: sql`1` })
      .from(membership)
      .where(
        and(
          eq(membership.tenantId, sql`r.tenant_id`),
          eq(membership.userId, sql`r.learner_id`),
          inArray(membership.groupId, groupIds),
        ),
      ),
  );

  return negateWhenExcluded(isMember, condition);
}

/** Outside the path view, a course row matches a path when the learner takes it through that path. */
function matchPathEnrollment(condition: ReportFilterCondition): SQL {
  const pathCourse = alias(studentLearningPathCourses, "slpc_filter");
  const pathEnrollment = alias(studentLearningPaths, "slp_filter");
  const selectedPaths = isPresenceOperator(condition)
    ? undefined
    : inArray(pathCourse.learningPathId, readValues(condition).map(String));

  const isTakenThroughPath = exists(
    queryBuilder
      .select({ one: sql`1` })
      .from(pathCourse)
      .innerJoin(
        pathEnrollment,
        and(
          eq(pathEnrollment.tenantId, pathCourse.tenantId),
          eq(pathEnrollment.studentId, pathCourse.studentId),
          eq(pathEnrollment.learningPathId, pathCourse.learningPathId),
        ),
      )
      .where(
        and(
          eq(pathCourse.tenantId, sql`r.tenant_id`),
          eq(pathCourse.studentId, sql`r.learner_id`),
          eq(pathCourse.courseId, sql`r.course_id`),
          selectedPaths,
        ),
      ),
  );

  return negateWhenExcluded(isTakenThroughPath, condition);
}

/** In the path view, a path row matches a course when the course is one of the path's courses. */
function matchPathCourses(condition: ReportFilterCondition): SQL {
  const courseCount = sql<number>`jsonb_array_length(r.path_courses)`;

  return match(condition.operator)
    .with(OPERATOR.IS_EMPTY, () => eq(courseCount, 0))
    .with(OPERATOR.IS_NOT_EMPTY, () => gte(courseCount, 1))
    .otherwise(() => {
      const courseIds = readValues(condition).map(String);
      const containsCourse = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(r.path_courses) pc
    WHERE ${inArray(sql`pc ->> 'courseId'`, courseIds)})`;

      return negateWhenExcluded(containsCourse, condition);
    });
}

function matchLearner(condition: ReportFilterCondition): SQL {
  const values = readValues(condition).map(String);

  return match(condition.operator)
    .with(OPERATOR.CONTAINS, () => learnerContains(values[0]))
    .otherwise(() => negateWhenExcluded(learnerIsAnyOf(values), condition));
}

function learnerContains(text: string): SQL {
  const pattern = `%${escapeLikePattern(text)}%`;

  return combine(
    [sql`r.learner_name ILIKE ${pattern}`, sql`r.learner_email ILIKE ${pattern}`],
    REPORT_FILTER_MATCH.ANY,
  );
}

/** Selected learners match by id; typed values match names or emails case-insensitively. */
function learnerIsAnyOf(values: string[]): SQL {
  const learnerIds = values.filter((value) => REPORT_UUID_PATTERN.test(value));
  const textValues = sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]`;

  return combine(
    [
      inArray(sql`r.learner_id`, learnerIds),
      sql`r.learner_name ILIKE ANY(${textValues})`,
      sql`r.learner_email ILIKE ANY(${textValues})`,
    ],
    REPORT_FILTER_MATCH.ANY,
  );
}

function compareColumn(condition: ReportFilterCondition, timezone: string): SQL {
  const { field } = condition;
  const column = REPORT_ROW_COLUMNS[field];

  if (isPresenceOperator(condition)) return comparePresence(column, condition);

  const values = readValues(condition);
  const [first, second] = values;
  const toParameter = (value: ReportFilterValue) => toSqlValue(value, field, timezone);
  const isWholeDay = (value: ReportFilterValue) =>
    REPORT_DATE_FIELDS.has(field) && isCalendarDate(String(value));

  return match(condition.operator)
    .with(OPERATOR.EQ, () =>
      isWholeDay(first)
        ? withinDays(column, toParameter(first), String(first), timezone)
        : eq(column, toParameter(first)),
    )
    .with(OPERATOR.NEQ, () =>
      combine([isNotNull(column), ne(column, toParameter(first))], REPORT_FILTER_MATCH.ALL),
    )
    .with(OPERATOR.IN, () => inArray(column, values.map(toParameter)))
    .with(OPERATOR.GTE, () => gte(column, toParameter(first)))
    .with(OPERATOR.LTE, () =>
      isWholeDay(first)
        ? lt(column, startOfNextDay(String(first), timezone))
        : lte(column, toParameter(first)),
    )
    .with(OPERATOR.BETWEEN, () =>
      isWholeDay(second)
        ? withinDays(column, toParameter(first), String(second), timezone)
        : between(column, toParameter(first), toParameter(second)),
    )
    .otherwise(() => sql`FALSE`);
}

/** "Has no certificate" means not earned; for other fields it means the value is missing. */
function comparePresence(column: SQL, condition: ReportFilterCondition): SQL {
  return match({ field: condition.field, operator: condition.operator })
    .with({ field: FIELD.CERTIFICATE, operator: OPERATOR.IS_EMPTY }, () =>
      eq(column, REPORT_CERTIFICATE_STATUS.NOT_EARNED),
    )
    .with({ field: FIELD.CERTIFICATE }, () => ne(column, REPORT_CERTIFICATE_STATUS.NOT_EARNED))
    .with({ operator: OPERATOR.IS_EMPTY }, () => isNull(column))
    .otherwise(() => isNotNull(column));
}

/** Calendar dates are whole days in the report timezone, so the last day is included in full. */
function withinDays(column: SQL, from: SQL, lastDay: string, timezone: string): SQL {
  return combine(
    [gte(column, from), lt(column, startOfNextDay(lastDay, timezone))],
    REPORT_FILTER_MATCH.ALL,
  );
}

function toSqlValue(value: ReportFilterValue, field: string, timezone: string): SQL {
  if (REPORT_NUMERIC_FIELDS.has(field)) return sql`${Number(value)}`;
  if (REPORT_DATE_FIELDS.has(field)) return startOfDay(String(value), timezone);
  return sql`${value}`;
}

function startOfDay(value: string, timezone: string): SQL {
  if (isCalendarDate(value)) return sql`(${value}::date::timestamp AT TIME ZONE ${timezone})`;
  return sql`${value}::timestamptz`;
}

function startOfNextDay(value: string, timezone: string): SQL {
  return sql`(((${value}::date + 1)::timestamp) AT TIME ZONE ${timezone})`;
}

function negateWhenExcluded(predicate: SQL, condition: ReportFilterCondition): SQL {
  const isExclusion =
    condition.operator === OPERATOR.NEQ || condition.operator === OPERATOR.IS_EMPTY;

  return isExclusion ? not(predicate) : predicate;
}

function isPresenceOperator(condition: ReportFilterCondition): boolean {
  return condition.operator === OPERATOR.IS_EMPTY || condition.operator === OPERATOR.IS_NOT_EMPTY;
}

function readValues(condition: ReportFilterCondition): ReportFilterValue[] {
  return match(condition.value)
    .with(undefined, () => [])
    .with(P.array(), (values) => values)
    .otherwise((value) => [value]);
}

function isCalendarDate(value: string): boolean {
  return REPORT_CALENDAR_DATE_PATTERN.test(value);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function combine(predicates: SQL[], filterMatch: ReportFilterMatch): SQL {
  const combined = filterMatch === REPORT_FILTER_MATCH.ALL ? and(...predicates) : or(...predicates);

  return combined ?? sql`TRUE`;
}
