import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { OptionPicker } from "~/components/OptionPicker/OptionPicker";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";
import { getSubjectOptions, getSubjectTypeForView } from "../utils/reportConfiguration.utils";
import { countConditions } from "../utils/reportFilters.utils";

import type { ReportOptions } from "../types/reports-api.types";
import type { ReportConfiguration, ReportSubjectType } from "../types/reports.types";

type ReportScopeToolbarProps = {
  draft: ReportConfiguration;
  options: ReportOptions | undefined;
  isDirty: boolean;
  canApply: boolean;
  isFiltersOpen: boolean;
  onOptionSearch: (search: string) => void;
  onSubjectSelect: (subject: { id: string; label: string; type: ReportSubjectType }) => void;
  onGroupToggle: (groupId: string) => void;
  onFiltersToggle: () => void;
  onReset: () => void;
  onDiscard: () => void;
  onApply: () => void;
};

const toSubjectPlaceholderKey = (subjectType: ReportSubjectType) =>
  `reports.subject.choose${subjectType[0].toUpperCase()}${subjectType.slice(1)}`;

export function ReportScopeToolbar({
  draft,
  options,
  isDirty,
  canApply,
  isFiltersOpen,
  onOptionSearch,
  onSubjectSelect,
  onGroupToggle,
  onFiltersToggle,
  onReset,
  onDiscard,
  onApply,
}: ReportScopeToolbarProps) {
  const { t } = useTranslation();
  const subjectType = getSubjectTypeForView(draft.view);
  const draftConditionCount = countConditions(draft.filters);
  const groupPickerLabel = match(draft.groupIds.length)
    .with(0, () => t("reports.scope.allGroups"))
    .with(
      1,
      () =>
        options?.groups.find(({ id }) => id === draft.groupIds[0])?.label ??
        t("reports.scope.groupsCount", { count: 1 }),
    )
    .otherwise((count) => t("reports.scope.groupsCount", { count }));

  return (
    <div className="flex flex-wrap items-center gap-2 p-4">
      {subjectType && (
        <OptionPicker
          label={t(`reports.subject.${subjectType}`)}
          placeholder={t(toSubjectPlaceholderKey(subjectType))}
          options={getSubjectOptions(options, subjectType)}
          testId={REPORTS_HANDLES.SUBJECT_PICKER}
          optionTestId={({ id }) => REPORTS_HANDLES.option(id)}
          selectedIds={draft.subject ? [draft.subject.id] : []}
          selectedLabel={draft.subject?.name}
          className="w-full sm:w-64"
          onSearchChange={onOptionSearch}
          onToggle={({ id, label }) => onSubjectSelect({ id, label, type: subjectType })}
        />
      )}
      <OptionPicker
        label={t("reports.scope.groupLabel")}
        placeholder={t("reports.scope.allGroups")}
        options={options?.groups}
        testId={REPORTS_HANDLES.GROUPS_PICKER}
        optionTestId={({ id }) => REPORTS_HANDLES.option(id)}
        selectedIds={draft.groupIds}
        selectedLabel={groupPickerLabel}
        multiple
        className="w-full sm:w-52"
        onSearchChange={onOptionSearch}
        onToggle={({ id }) => onGroupToggle(id)}
      />
      <Button
        data-testid={REPORTS_HANDLES.FILTERS_TOGGLE}
        type="button"
        variant="outline"
        className={cn("gap-2", isFiltersOpen && "border-primary-500 bg-primary-50")}
        aria-expanded={isFiltersOpen}
        onClick={onFiltersToggle}
      >
        <SlidersHorizontal className="size-4" />
        {t("reports.filters.toggle")}
        {draftConditionCount > 0 && (
          <span className="details-md rounded-full bg-brand px-1.5 text-contrast">
            {draftConditionCount}
          </span>
        )}
      </Button>
      <Button
        data-testid={REPORTS_HANDLES.RESET_ALL}
        type="button"
        variant="ghost"
        className="gap-2 text-neutral-700"
        onClick={onReset}
      >
        <RotateCcw className="size-4" />
        {t("reports.filters.resetAll")}
      </Button>
      <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
        {isDirty && (
          <Button type="button" variant="ghost" className="text-neutral-700" onClick={onDiscard}>
            {t("reports.filters.discardChanges")}
          </Button>
        )}
        <Button
          data-testid={REPORTS_HANDLES.APPLY}
          type="button"
          className="gap-2"
          disabled={!canApply}
          onClick={onApply}
        >
          {isDirty && <span aria-hidden className="size-1.5 rounded-full bg-warning-400" />}
          {t("reports.filters.apply")}
        </Button>
      </div>
    </div>
  );
}
