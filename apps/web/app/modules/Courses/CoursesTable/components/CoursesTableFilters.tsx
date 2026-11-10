import { COURSE_STATUSES } from "@repo/shared";
import { RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import { ReportOptionPicker } from "~/modules/Reports/components/ReportOptionPicker";

import { COURSES_PAGE_HANDLES } from "../../../../../e2e/data/courses/handles";
import { COURSE_ARCHIVE_FILTERS, COURSES_TABLE_ANY_FILTER_VALUE } from "../coursesTable.constants";
import { isCourseArchiveFilter, isCourseStatus } from "../coursesTable.utils";

import type { CoursesTableFilters as CoursesTableFiltersModel } from "../hooks/useCoursesTableFilters";

type CoursesTableFiltersProps = {
  filters: CoursesTableFiltersModel;
  categoryTitles: string[];
  canFilterByManagementState: boolean;
};

type ActiveFilterPill = {
  id: string;
  label: string;
  value: string;
  removeFilter: () => void;
};

const ANY_OPTION_TEST_ID_VALUE = "all";

export function CoursesTableFilters({
  filters,
  categoryTitles,
  canFilterByManagementState,
}: CoursesTableFiltersProps) {
  const { t } = useTranslation();

  const categoryOptions = [
    { id: COURSES_TABLE_ANY_FILTER_VALUE, label: t("adminCoursesView.filters.allCategories") },
    ...categoryTitles.map((categoryTitle) => ({ id: categoryTitle, label: categoryTitle })),
  ];

  const stateOptions = [
    { id: COURSES_TABLE_ANY_FILTER_VALUE, label: t("common.other.allStatuses") },
    { id: COURSE_STATUSES.DRAFT, label: t("adminCoursesView.filters.other.draft") },
    { id: COURSE_STATUSES.PUBLISHED, label: t("adminCoursesView.filters.other.published") },
    { id: COURSE_STATUSES.PRIVATE, label: t("adminCoursesView.filters.other.private") },
  ];

  const archiveOptions = [
    { id: COURSE_ARCHIVE_FILTERS.ACTIVE, label: t("common.other.active") },
    { id: COURSE_ARCHIVE_FILTERS.ARCHIVED, label: t("common.other.archived") },
    { id: COURSE_ARCHIVE_FILTERS.ALL, label: t("common.other.all") },
  ];

  const toAnyOptionTestIdValue = (optionId: string) =>
    optionId === COURSES_TABLE_ANY_FILTER_VALUE ? ANY_OPTION_TEST_ID_VALUE : optionId;

  const selectedStateId = filters.state ?? COURSES_TABLE_ANY_FILTER_VALUE;

  const activeFilterPills: ActiveFilterPill[] = [
    ...(filters.category
      ? [
          {
            id: "category",
            label: t("adminCoursesView.field.category"),
            value: filters.category,
            removeFilter: () => filters.setCategory(undefined),
          },
        ]
      : []),
    ...(filters.state
      ? [
          {
            id: "state",
            label: t("adminCoursesView.field.state"),
            value: stateOptions.find(({ id }) => id === filters.state)?.label ?? filters.state,
            removeFilter: () => filters.setState(undefined),
          },
        ]
      : []),
    ...(filters.archive !== COURSE_ARCHIVE_FILTERS.ACTIVE
      ? [
          {
            id: "archive",
            label: t("adminCoursesView.filters.archive"),
            value:
              archiveOptions.find(({ id }) => id === filters.archive)?.label ?? filters.archive,
            removeFilter: () => filters.setArchive(COURSE_ARCHIVE_FILTERS.ACTIVE),
          },
        ]
      : []),
  ];

  return (
    <div role="search" aria-label={t("reports.filters.toggle")} className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.titleInput}
          onChange={(event) => filters.setTitleInput(event.target.value)}
          placeholder={t("adminCoursesView.filters.placeholder.title")}
          aria-label={t("adminCoursesView.filters.placeholder.title")}
          wrapperClassName="w-full max-w-none sm:w-auto sm:min-w-64 sm:flex-1 lg:max-w-sm"
          className="h-10 max-w-none"
          clearable
          data-testid={COURSES_PAGE_HANDLES.TITLE_FILTER}
        />

        <ReportOptionPicker
          label={t("adminCoursesView.field.category")}
          placeholder={t("adminCoursesView.filters.allCategories")}
          className="w-full sm:w-52"
          options={categoryOptions}
          selectedIds={[filters.category ?? COURSES_TABLE_ANY_FILTER_VALUE]}
          testId={COURSES_PAGE_HANDLES.CATEGORY_FILTER}
          optionTestId={({ id }) =>
            COURSES_PAGE_HANDLES.categoryFilterOption(toAnyOptionTestIdValue(id))
          }
          onToggle={({ id }) =>
            filters.setCategory(id === COURSES_TABLE_ANY_FILTER_VALUE ? undefined : id)
          }
        />

        {canFilterByManagementState && (
          <>
            <ReportOptionPicker
              label={t("adminCoursesView.field.state")}
              placeholder={t("common.other.allStatuses")}
              className="w-full sm:w-44"
              options={stateOptions}
              selectedIds={[selectedStateId]}
              testId={COURSES_PAGE_HANDLES.STATE_FILTER}
              optionTestId={({ id }) =>
                COURSES_PAGE_HANDLES.stateFilterOption(
                  isCourseStatus(id) ? id : ANY_OPTION_TEST_ID_VALUE,
                )
              }
              onToggle={({ id }) => filters.setState(isCourseStatus(id) ? id : undefined)}
            />

            <ReportOptionPicker
              label={t("adminCoursesView.filters.archive")}
              placeholder={t("common.other.active")}
              className="w-full sm:w-44"
              options={archiveOptions}
              selectedIds={[filters.archive]}
              testId={COURSES_PAGE_HANDLES.ARCHIVED_FILTER}
              optionTestId={({ id }) =>
                COURSES_PAGE_HANDLES.archivedFilterOption(
                  isCourseArchiveFilter(id) ? id : COURSE_ARCHIVE_FILTERS.ACTIVE,
                )
              }
              onToggle={({ id }) => {
                if (isCourseArchiveFilter(id)) filters.setArchive(id);
              }}
            />
          </>
        )}

        {filters.activeFilterCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-2 text-neutral-700"
            onClick={filters.resetFilters}
            data-testid={COURSES_PAGE_HANDLES.RESET_FILTERS_BUTTON}
          >
            <RotateCcw className="size-4" aria-hidden />
            {t("reports.filters.resetAll")}
          </Button>
        )}
      </div>

      {activeFilterPills.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label={t("reports.filters.toggle")}>
          {activeFilterPills.map(({ id, label, value, removeFilter }) => (
            <li
              key={id}
              data-testid={COURSES_PAGE_HANDLES.activeFilterPill(id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 pl-3 pr-1 text-sm"
            >
              <span className="font-medium text-neutral-950">
                {t("adminCoursesView.filters.labeledValue", { label, value })}
              </span>
              <button
                type="button"
                onClick={removeFilter}
                aria-label={t("adminCoursesView.filters.removeFilter", { filter: label })}
                data-testid={COURSES_PAGE_HANDLES.removeFilterButton(id)}
                className="flex size-6 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-primary-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
