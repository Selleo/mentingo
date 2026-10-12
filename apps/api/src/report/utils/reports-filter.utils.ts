import {
  REPORT_REFERENCING_OPERATORS,
  REPORT_UUID_PATTERN,
} from "../constants/reports-filter.constants";
import { REPORT_FILTER_FIELDS } from "../constants/reports.constants";

import type { ReportQueryReferences } from "../repositories/reports-query.types";
import type {
  ReportDefinition,
  ReportFilter,
  ReportFilterCondition,
} from "../schemas/reports.schema";

export function flattenFilterConditions(filter: ReportFilter | undefined): ReportFilterCondition[] {
  return (filter?.rules ?? []).flatMap((rule) => ("field" in rule ? [rule] : rule.rules));
}

export function getReferencedRecordIds(query: ReportDefinition): ReportQueryReferences {
  const referencingConditions = flattenFilterConditions(query.filter).filter(({ operator }) =>
    REPORT_REFERENCING_OPERATORS.has(operator),
  );
  const idsComparedOn = (field: ReportFilterCondition["field"]) =>
    referencingConditions
      .filter((condition) => condition.field === field)
      .flatMap(getComparedTextValues);

  return {
    groupIds: withoutDuplicates([
      ...query.groupIds,
      ...idsComparedOn(REPORT_FILTER_FIELDS.GROUP_ID),
    ]),
    courseIds: withoutDuplicates(idsComparedOn(REPORT_FILTER_FIELDS.COURSE_ID)),
    pathIds: withoutDuplicates(idsComparedOn(REPORT_FILTER_FIELDS.PATH_ID)),
    // Learner conditions also accept typed names and emails; only UUIDs name a learner record.
    learnerIds: withoutDuplicates(
      idsComparedOn(REPORT_FILTER_FIELDS.LEARNER).filter((value) =>
        REPORT_UUID_PATTERN.test(value),
      ),
    ),
  };
}

function getComparedTextValues(condition: ReportFilterCondition): string[] {
  const values = Array.isArray(condition.value) ? condition.value : [condition.value];
  return values.filter((value): value is string => typeof value === "string");
}

function withoutDuplicates(values: string[]): string[] {
  return [...new Set(values)];
}
