import { BadRequestException } from "@nestjs/common";

import { REPORT_FIELD_OPERATORS } from "../constants/reports-field-operators";
import {
  REPORT_DATE_FIELDS,
  REPORT_DATE_PATTERN,
  REPORT_IDENTIFIER_FIELDS,
  REPORT_NUMERIC_FIELDS,
  REPORT_STRICT_UUID_PATTERN,
} from "../constants/reports-filter.constants";
import {
  REPORT_CERTIFICATE_STATUS,
  REPORT_FILTER_FIELDS as FIELD,
  REPORT_FILTER_OPERATORS as OPERATOR,
  REPORT_LIMITS,
  REPORT_STATUS,
  REPORT_VIEWS,
} from "../constants/reports.constants";
import { REPORT_ERRORS } from "../constants/reports.errors";
import { flattenFilterConditions } from "../utils/reports-filter.utils";

import type { ReportFilterValue } from "../reports-filter.types";
import type { ReportDefinition, ReportFilterCondition } from "../schemas/reports.schema";

/** Structural input validation lives in TypeBox; these checks enforce report meaning. */
export function validateReportsQuerySemantics(query: ReportDefinition): void {
  assertTimezone(query.timezone);
  assertSubject(query);
  const conditions = flattenFilterConditions(query.filter);
  assertValid(conditions.length <= REPORT_LIMITS.CONDITIONS, REPORT_ERRORS.TOO_MANY_CONDITIONS);
  conditions.forEach(validateCondition);
}

function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new BadRequestException(REPORT_ERRORS.INVALID_TIMEZONE);
  }
}

function assertSubject(query: ReportDefinition): void {
  if (query.view === REPORT_VIEWS.ORGANISATION) {
    assertValid(!query.subjectId, REPORT_ERRORS.UNEXPECTED_SUBJECT);
    return;
  }
  assertValid(Boolean(query.subjectId), REPORT_ERRORS.SUBJECT_REQUIRED);
}

function validateCondition(condition: ReportFilterCondition): void {
  assertValid(
    REPORT_FIELD_OPERATORS[condition.field].includes(condition.operator),
    REPORT_ERRORS.UNSUPPORTED_OPERATOR,
  );
  if (condition.operator === OPERATOR.IS_EMPTY || condition.operator === OPERATOR.IS_NOT_EMPTY) {
    assertValid(condition.value === undefined, REPORT_ERRORS.UNEXPECTED_VALUE);
    return;
  }
  const values = readConditionValues(condition);
  validateFieldValues(condition.field, values);
  if (condition.operator === OPERATOR.BETWEEN) assertOrderedRange(condition.field, values);
}

function readConditionValues({ operator, value }: ReportFilterCondition): ReportFilterValue[] {
  assertValid(value !== undefined, REPORT_ERRORS.REQUIRED_VALUE);
  if (operator === OPERATOR.BETWEEN) {
    assertValid(Array.isArray(value) && value.length === 2, REPORT_ERRORS.INVALID_RANGE);
  } else if (operator === OPERATOR.IN) {
    assertValid(Array.isArray(value), REPORT_ERRORS.EXPECTED_LIST);
  } else {
    assertValid(!Array.isArray(value), REPORT_ERRORS.EXPECTED_SINGLE_VALUE);
  }
  return Array.isArray(value) ? value : [value as ReportFilterValue];
}

function validateFieldValues(
  field: ReportFilterCondition["field"],
  values: ReportFilterValue[],
): void {
  if (REPORT_IDENTIFIER_FIELDS.has(field)) {
    assertValid(
      values.every((value) => typeof value === "string" && REPORT_STRICT_UUID_PATTERN.test(value)),
      REPORT_ERRORS.INVALID_IDENTIFIER,
    );
  }
  if (REPORT_DATE_FIELDS.has(field)) {
    assertValid(
      values.every((value) => typeof value === "string" && isValidDate(value)),
      REPORT_ERRORS.INVALID_DATE,
    );
  }
  if (field === FIELD.STATUS)
    assertAllowedValues(values, Object.values(REPORT_STATUS), REPORT_ERRORS.INVALID_STATUS);
  if (field === FIELD.CERTIFICATE)
    assertAllowedValues(
      values,
      Object.values(REPORT_CERTIFICATE_STATUS),
      REPORT_ERRORS.INVALID_CERTIFICATE_STATUS,
    );
  if (REPORT_NUMERIC_FIELDS.has(field)) validateNumbers(field, values);
}

function assertAllowedValues(
  values: ReportFilterValue[],
  allowed: readonly string[],
  error: string,
): void {
  assertValid(
    values.every((value) => typeof value === "string" && allowed.includes(value)),
    error,
  );
}

function validateNumbers(field: string, values: ReportFilterValue[]): void {
  const maximum = field === FIELD.ATTEMPTS ? Number.POSITIVE_INFINITY : 100;
  const valid = values.every((value) => {
    if (typeof value === "string" && !value.trim()) return false;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= maximum;
  });
  assertValid(valid, REPORT_ERRORS.NUMBER_OUT_OF_RANGE);
}

function assertOrderedRange(field: string, [from, to]: ReportFilterValue[]): void {
  const lower = REPORT_NUMERIC_FIELDS.has(field) ? Number(from) : String(from);
  const upper = REPORT_NUMERIC_FIELDS.has(field) ? Number(to) : String(to);
  assertValid(lower <= upper, REPORT_ERRORS.REVERSED_RANGE);
}

function isValidDate(value: string): boolean {
  if (!REPORT_DATE_PATTERN.test(value)) return false;
  const datePart = value.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== datePart) return false;
  return !value.includes("T") || !Number.isNaN(Date.parse(value));
}

function assertValid(condition: boolean, message: string): void {
  if (!condition) throw new BadRequestException(message);
}
