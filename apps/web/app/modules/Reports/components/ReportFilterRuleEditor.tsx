import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { DatePicker } from "~/components/DatePicker";
import { OptionPicker } from "~/components/OptionPicker/OptionPicker";
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

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";
import {
  REPORT_DATE_FIELDS,
  REPORT_FIELD_KEYS,
  REPORT_FIELD_VALUES,
  REPORT_FILTER_FIELDS,
  REPORT_LIST_OPERATORS,
  REPORT_NUMERIC_FIELDS,
  REPORT_PRESENCE_OPERATORS,
  REPORT_RANGE_OPERATORS,
  REPORT_REMOTE_CHOICE_FIELDS,
  REPORT_TEXT_SEARCH_OPERATORS,
} from "../constants/reports.constants";

import type {
  ReportCondition,
  ReportFilterOperator,
  ReportFilterOptions,
} from "../types/reports.types";

const controlClassName = "h-10 min-w-0";

export function ReportFilterRuleEditor({
  rule,
  options,
  onOptionSearch,
  onChange,
  onRemove,
}: {
  rule: ReportCondition;
  options: ReportFilterOptions;
  onOptionSearch: (search: string) => void;
  onChange: (rule: ReportCondition) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const operators = REPORT_FILTER_FIELDS[rule.field];
  const staticValues = REPORT_FIELD_VALUES[rule.field];
  const isValueOptional = REPORT_PRESENCE_OPERATORS.includes(rule.operator);
  const isRange = REPORT_RANGE_OPERATORS.includes(rule.operator);
  const isMultiple = REPORT_LIST_OPERATORS.includes(rule.operator);
  const isNumeric = REPORT_NUMERIC_FIELDS.includes(rule.field);
  const isDate = REPORT_DATE_FIELDS.includes(rule.field);
  const valueInputType = isNumeric ? "number" : "text";
  const hasRemoteChoices = REPORT_REMOTE_CHOICE_FIELDS.includes(rule.field);
  const choices =
    rule.field === "learner" && REPORT_TEXT_SEARCH_OPERATORS.includes(rule.operator)
      ? undefined
      : (staticValues?.map((value) => ({ id: value, label: t(`reports.values.${value}`) })) ??
        // Keep the picker mounted while a new search has no cached response.
        (hasRemoteChoices ? (options[rule.field] ?? []) : undefined));
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
        <OptionPicker
          label={t("reports.filters.value")}
          placeholder={t("reports.filters.selectValue")}
          options={choices}
          testId={REPORTS_HANDLES.CONDITION_VALUE_PICKER}
          optionTestId={({ id }) => REPORTS_HANDLES.option(id)}
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
          <DatePicker
            label={t("reports.filters.from")}
            placeholder={t("reports.filters.selectDate")}
            value={rule.value ? String(rule.value) : undefined}
            onChange={(value) => update({ value })}
          />
          <DatePicker
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
        <DatePicker
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
        data-testid={REPORTS_HANDLES.CONDITION_VALUE_INPUT}
        className={cn(controlClassName, "md:col-span-2")}
        type={valueInputType}
        value={Array.isArray(rule.value) ? rule.value.join(", ") : String(rule.value ?? "")}
        onChange={(event) => updateValue(event.target.value)}
      />
    );
  };

  return (
    <div
      data-testid={REPORTS_HANDLES.CONDITION}
      className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(150px,1fr)_minmax(130px,0.8fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_auto]"
    >
      <OptionPicker
        label={t("reports.filters.field")}
        placeholder={t("reports.filters.field")}
        options={REPORT_FIELD_KEYS.map((field) => ({
          id: field,
          label: t(`reports.fields.${field}`),
        }))}
        testId={REPORTS_HANDLES.CONDITION_FIELD}
        optionTestId={({ id }) => REPORTS_HANDLES.option(id)}
        selectedIds={[rule.field]}
        className={controlClassName}
        onToggle={({ id }) => {
          const field = REPORT_FIELD_KEYS.find((fieldKey) => fieldKey === id);
          if (!field) return;
          update({
            field,
            operator: REPORT_FILTER_FIELDS[field][0],
            value: undefined,
            secondValue: undefined,
          });
        }}
      />
      <Select
        value={rule.operator}
        onValueChange={(next) => {
          const operator = next as ReportFilterOperator;
          const clearsValue =
            REPORT_PRESENCE_OPERATORS.includes(operator) ||
            REPORT_LIST_OPERATORS.includes(operator) !== isMultiple ||
            REPORT_RANGE_OPERATORS.includes(operator) !== isRange;
          update({
            operator,
            value: clearsValue ? undefined : rule.value,
            secondValue: clearsValue ? undefined : rule.secondValue,
          });
        }}
      >
        <SelectTrigger
          aria-label={t("reports.filters.operator")}
          data-testid={REPORTS_HANDLES.CONDITION_OPERATOR}
          className={controlClassName}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((operator) => (
            <SelectItem
              key={operator}
              value={operator}
              data-testid={REPORTS_HANDLES.conditionOperatorOption(operator)}
            >
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
        data-testid={REPORTS_HANDLES.REMOVE_CONDITION}
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
