import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";
import { MAX_REPORT_CONDITIONS } from "../constants/reports.constants";
import {
  addCondition,
  addNestedGroup,
  countConditions,
  createDefaultCondition,
  createDefaultConditionGroup,
} from "../utils/reportFilters.utils";

import { ReportFilterJoinSelect } from "./ReportFilterJoinSelect";
import { ReportFilterRuleEditor } from "./ReportFilterRuleEditor";

import type {
  ReportCondition,
  ReportConditionGroup,
  ReportFilterOptions,
  ReportFilterTree,
} from "../types/reports.types";

type ReportFilterBuilderProps = {
  value: ReportFilterTree;
  options: ReportFilterOptions;
  onOptionSearch: (search: string) => void;
  onChange: (value: ReportFilterTree) => void;
};

export function ReportFilterBuilder({
  value,
  options,
  onOptionSearch,
  onChange,
}: ReportFilterBuilderProps) {
  const { t } = useTranslation();
  const atLimit = countConditions(value) >= MAX_REPORT_CONDITIONS;
  const hasConditions = value.conditions.length > 0 || value.groups.length > 0;
  const mapTargetGroup = (
    group: ReportConditionGroup,
    groupId: string,
    transform: (conditions: ReportCondition[]) => ReportCondition[],
  ) => {
    if (group.id !== groupId) return group;
    return { ...group, conditions: transform(group.conditions) };
  };
  const updateCondition = (id: string, next: ReportCondition, groupId?: string) => {
    if (!groupId) {
      onChange({
        ...value,
        conditions: value.conditions.map((rule) => (rule.id === id ? next : rule)),
      });
      return;
    }
    onChange({
      ...value,
      groups: value.groups.map((group) =>
        mapTargetGroup(group, groupId, (conditions) =>
          conditions.map((rule) => (rule.id === id ? next : rule)),
        ),
      ),
    });
  };
  const removeCondition = (id: string, groupId?: string) => {
    if (!groupId) {
      onChange({ ...value, conditions: value.conditions.filter((rule) => rule.id !== id) });
      return;
    }
    onChange({
      ...value,
      groups: value.groups
        .map((group) =>
          mapTargetGroup(group, groupId, (conditions) =>
            conditions.filter((rule) => rule.id !== id),
          ),
        )
        .filter(({ conditions }) => conditions.length > 0),
    });
  };
  const updateGroup = (
    groupId: string,
    update: (group: ReportConditionGroup) => ReportConditionGroup,
  ) =>
    onChange({
      ...value,
      groups: value.groups.map((group) => (group.id === groupId ? update(group) : group)),
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <p className="body-sm-md text-neutral-950">{t("reports.filters.title")}</p>
          <p
            data-testid={REPORTS_HANDLES.CONDITION_COUNT}
            data-count={countConditions(value)}
            className="details text-neutral-500"
          >
            {t("reports.filters.description", {
              count: countConditions(value),
              max: MAX_REPORT_CONDITIONS,
            })}
          </p>
        </div>
        {value.conditions.length + value.groups.length > 1 && (
          <ReportFilterJoinSelect
            value={value.join}
            onChange={(join) => onChange({ ...value, join })}
          />
        )}
      </div>
      {!hasConditions && (
        <p className="body-sm text-neutral-500">{t("reports.filters.emptyHint")}</p>
      )}
      {value.conditions.length > 0 && (
        <div className="space-y-2">
          {value.conditions.map((rule) => (
            <ReportFilterRuleEditor
              key={rule.id}
              rule={rule}
              options={options}
              onOptionSearch={onOptionSearch}
              onChange={(next) => updateCondition(rule.id, next)}
              onRemove={() => removeCondition(rule.id)}
            />
          ))}
        </div>
      )}
      {value.groups.map((group) => (
        <div
          key={group.id}
          data-testid={REPORTS_HANDLES.NESTED_GROUP}
          className="space-y-2 border-l-2 border-primary-200 pl-3"
        >
          <div className="flex items-center justify-between gap-2">
            {group.conditions.length > 1 ? (
              <ReportFilterJoinSelect
                value={group.join}
                onChange={(join) => updateGroup(group.id, (item) => ({ ...item, join }))}
              />
            ) : (
              <span className="details-md text-primary-800">
                {t("reports.filters.nestedGroup")}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mr-1 size-8 text-neutral-500 hover:text-error-700"
              aria-label={t("reports.filters.removeGroup")}
              onClick={() =>
                onChange({ ...value, groups: value.groups.filter(({ id }) => id !== group.id) })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {group.conditions.map((rule) => (
            <ReportFilterRuleEditor
              key={rule.id}
              rule={rule}
              options={options}
              onOptionSearch={onOptionSearch}
              onChange={(next) => updateCondition(rule.id, next, group.id)}
              onRemove={() => removeCondition(rule.id, group.id)}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-primary-800"
            data-testid={REPORTS_HANDLES.NESTED_ADD_CONDITION}
            disabled={atLimit}
            onClick={() =>
              updateGroup(group.id, (item) => ({
                ...item,
                conditions: [...item.conditions, createDefaultCondition()],
              }))
            }
          >
            <Plus className="mr-1 size-4" />
            {t("reports.filters.addCondition")}
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid={REPORTS_HANDLES.ADD_CONDITION}
          type="button"
          variant="outline"
          size="sm"
          disabled={atLimit}
          onClick={() => onChange(addCondition(value, createDefaultCondition()))}
        >
          <Plus className="mr-1 size-4" />
          {t("reports.filters.addCondition")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={REPORTS_HANDLES.ADD_NESTED_GROUP}
          disabled={atLimit || value.groups.length > 0}
          onClick={() => onChange(addNestedGroup(value, createDefaultConditionGroup()))}
        >
          <Plus className="mr-1 size-4" />
          {t("reports.filters.addGroup")}
        </Button>
      </div>
    </div>
  );
}
