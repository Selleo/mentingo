import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { ReportDatePicker } from "./components/ReportDatePicker";
import { ReportOptionPicker } from "./components/ReportOptionPicker";
import {
  addCondition,
  addNestedGroup,
  countConditions,
  MAX_REPORT_CONDITIONS,
  REPORT_FIELD_VALUES,
  REPORT_FILTER_FIELDS,
} from "./reports.types";

import type {
  FilterJoin,
  ReportCondition,
  ReportConditionGroup,
  ReportFilterField,
  ReportFilterOperator,
  ReportFilterTree,
} from "./reports.types";

type ReportFilterBuilderProps = {
  value: ReportFilterTree;
  options: Partial<Record<ReportFilterField, { id: string; label: string }[]>>;
  onOptionSearch: (search: string) => void;
  onChange: (value: ReportFilterTree) => void;
};

const newCondition = (): ReportCondition => ({
  id: crypto.randomUUID(),
  field: "status",
  operator: "eq",
  value: "completed",
});

const newGroup = (): ReportConditionGroup => ({
  id: crypto.randomUUID(),
  join: "and",
  conditions: [newCondition()],
});

const fieldKeys: ReportFilterField[] = [
  "groupId",
  "learner",
  "courseId",
  "pathId",
  "status",
  "progress",
  "enrolledAt",
  "completedAt",
  "score",
  "attempts",
  "certificate",
  "lastActivity",
];

const controlClassName = "h-10 min-w-0";

function RuleEditor({
  rule,
  options,
  onOptionSearch,
  onChange,
  onRemove,
}: {
  rule: ReportCondition;
  options: ReportFilterBuilderProps["options"];
  onOptionSearch: (search: string) => void;
  onChange: (rule: ReportCondition) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const operators = REPORT_FILTER_FIELDS[rule.field];
  const staticValues = REPORT_FIELD_VALUES[rule.field];
  const isValueOptional = rule.operator === "isEmpty" || rule.operator === "isNotEmpty";
  const isRange = rule.operator === "between";
  const isMultiple = rule.operator === "in";
  const isNumeric = ["progress", "score", "attempts"].includes(rule.field);
  const isDate = ["enrolledAt", "completedAt", "lastActivity"].includes(rule.field);
  const valueInputType = isNumeric ? "number" : "text";
  const choices =
    rule.field === "learner" && rule.operator === "contains"
      ? undefined
      : (staticValues?.map((value) => ({ id: value, label: t(`reports.values.${value}`) })) ??
        options[rule.field]);
  const selectedIds = match(rule.value)
    .when(Array.isArray, (value) => value.map(String))
    .when(
      (value) => value !== undefined && value !== "",
      (value) => [String(value)],
    )
    .otherwise(() => []);

  const update = (patch: Partial<ReportCondition>) => onChange({ ...rule, ...patch });
  const toggleChoice = (id: string) => {
    if (!isMultiple) {
      update({ value: id });
      return;
    }
    update({
      value: selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    });
  };
  const updateValue = (rawValue: string) => {
    if (isMultiple) {
      update({
        value: rawValue
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      return;
    }
    update({ value: isNumeric && rawValue ? Number(rawValue) : rawValue || undefined });
  };
  const choiceLabel = match(selectedIds.length)
    .with(0, () => undefined)
    .with(1, () => choices?.find(({ id }) => id === selectedIds[0])?.label)
    .otherwise((count) => t("reports.filters.selectedValues", { count }));

  const renderValueControl = () => {
    if (isValueOptional) {
      return (
        <p className="flex h-10 items-center px-1 text-sm text-neutral-500 md:col-span-2">
          {t("reports.filters.noValue")}
        </p>
      );
    }
    if (choices) {
      return (
        <ReportOptionPicker
          label={t("reports.filters.value")}
          placeholder={t("reports.filters.selectValue")}
          options={choices}
          selectedIds={selectedIds}
          selectedLabel={choiceLabel}
          multiple={isMultiple}
          className="md:col-span-2"
          onSearchChange={staticValues ? undefined : onOptionSearch}
          onToggle={({ id }) => toggleChoice(id)}
        />
      );
    }
    if (isDate && isRange) {
      return (
        <>
          <ReportDatePicker
            label={t("reports.filters.from")}
            placeholder={t("reports.filters.selectDate")}
            value={rule.value ? String(rule.value) : undefined}
            onChange={(value) => update({ value })}
          />
          <ReportDatePicker
            label={t("reports.filters.to")}
            placeholder={t("reports.filters.selectDate")}
            value={rule.secondValue ? String(rule.secondValue) : undefined}
            onChange={(secondValue) => update({ secondValue })}
          />
        </>
      );
    }
    if (isDate) {
      return (
        <ReportDatePicker
          label={t("reports.filters.value")}
          placeholder={t("reports.filters.selectDate")}
          value={rule.value ? String(rule.value) : undefined}
          className="md:col-span-2"
          onChange={(value) => update({ value })}
        />
      );
    }
    if (isRange) {
      return (
        <>
          <Input
            aria-label={t("reports.filters.from")}
            className={controlClassName}
            type="number"
            value={String(rule.value ?? "")}
            onChange={(event) => update({ value: event.target.value })}
          />
          <Input
            aria-label={t("reports.filters.to")}
            className={controlClassName}
            type="number"
            value={String(rule.secondValue ?? "")}
            onChange={(event) => update({ secondValue: event.target.value })}
          />
        </>
      );
    }
    return (
      <Input
        aria-label={t("reports.filters.value")}
        className={cn(controlClassName, "md:col-span-2")}
        type={valueInputType}
        value={Array.isArray(rule.value) ? rule.value.join(", ") : String(rule.value ?? "")}
        onChange={(event) => updateValue(event.target.value)}
      />
    );
  };

  return (
    <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(150px,1fr)_minmax(130px,0.8fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_auto]">
      <Select
        value={rule.field}
        onValueChange={(next) => {
          const field = next as ReportFilterField;
          update({
            field,
            operator: REPORT_FILTER_FIELDS[field][0],
            value: undefined,
            secondValue: undefined,
          });
        }}
      >
        <SelectTrigger aria-label={t("reports.filters.field")} className={controlClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fieldKeys.map((field) => (
            <SelectItem key={field} value={field}>
              {t(`reports.fields.${field}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={rule.operator}
        onValueChange={(next) => {
          const operator = next as ReportFilterOperator;
          const clearsValue =
            operator === "isEmpty" ||
            operator === "isNotEmpty" ||
            (operator === "in") !== isMultiple;
          update({ operator, value: clearsValue ? undefined : rule.value });
        }}
      >
        <SelectTrigger aria-label={t("reports.filters.operator")} className={controlClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((operator) => (
            <SelectItem key={operator} value={operator}>
              {t(`reports.operators.${operator}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {renderValueControl()}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="justify-self-end text-neutral-500 hover:text-error-700"
        aria-label={t("reports.filters.removeCondition")}
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function JoinSelect({
  value,
  onChange,
}: {
  value: FilterJoin;
  onChange: (join: FilterJoin) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="body-sm flex items-center gap-1.5 text-neutral-700">
      <span>{t("reports.filters.matchPrefix")}</span>
      <Select value={value} onValueChange={(join) => onChange(join as FilterJoin)}>
        <SelectTrigger
          aria-label={t("reports.filters.matching")}
          className="h-8 w-auto gap-1.5 px-2.5 font-medium text-primary-800"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["and", "or"] as const).map((join) => (
            <SelectItem key={join} value={join}>
              {t(`reports.filters.join.${join}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>{t("reports.filters.matchSuffix")}</span>
    </div>
  );
}

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
          <p data-testid="reports-condition-count" className="details text-neutral-500">
            {t("reports.filters.description", {
              count: countConditions(value),
              max: MAX_REPORT_CONDITIONS,
            })}
          </p>
        </div>
        {value.conditions.length + value.groups.length > 1 && (
          <JoinSelect value={value.join} onChange={(join) => onChange({ ...value, join })} />
        )}
      </div>
      {!hasConditions && (
        <p className="body-sm text-neutral-500">{t("reports.filters.emptyHint")}</p>
      )}
      {value.conditions.length > 0 && (
        <div className="space-y-2">
          {value.conditions.map((rule) => (
            <RuleEditor
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
          data-testid="reports-nested-group"
          className="space-y-2 border-l-2 border-primary-200 pl-3"
        >
          <div className="flex items-center justify-between gap-2">
            {group.conditions.length > 1 ? (
              <JoinSelect
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
            <RuleEditor
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
            disabled={atLimit}
            onClick={() =>
              updateGroup(group.id, (item) => ({
                ...item,
                conditions: [...item.conditions, newCondition()],
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
          data-testid="reports-add-condition"
          type="button"
          variant="outline"
          size="sm"
          disabled={atLimit}
          onClick={() => onChange(addCondition(value, newCondition()))}
        >
          <Plus className="mr-1 size-4" />
          {t("reports.filters.addCondition")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atLimit || value.groups.length > 0}
          onClick={() => onChange(addNestedGroup(value, newGroup()))}
        >
          <Plus className="mr-1 size-4" />
          {t("reports.filters.addGroup")}
        </Button>
      </div>
    </div>
  );
}
