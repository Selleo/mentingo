import { COURSE_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { type ActiveTableFilter, DataTableToolbar } from "~/components/DataTable";
import { OptionPicker } from "~/components/OptionPicker/OptionPicker";

import { COURSES_PAGE_HANDLES } from "../../../../../e2e/data/courses/handles";
import { COURSE_ARCHIVE_FILTERS, COURSES_TABLE_ANY_FILTER_VALUE } from "../coursesTable.constants";
import { isCourseArchiveFilter, isCourseStatus } from "../coursesTable.utils";

import type { CoursesTableFilters as CoursesTableFiltersModel } from "../hooks/useCoursesTableFilters";

type CoursesTableFiltersProps = {
  filters: CoursesTableFiltersModel;
  categoryTitles: string[];
  canFilterByManagementState: boolean;
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

  const activeFilters: ActiveTableFilter[] = [
    ...(filters.category
      ? [
          {
            id: "category",
            label: t("adminCoursesView.field.category"),
            value: filters.category,
            onRemove: () => filters.setCategory(undefined),
          },
        ]
      : []),
    ...(filters.state
      ? [
          {
            id: "state",
            label: t("adminCoursesView.field.state"),
            value: stateOptions.find(({ id }) => id === filters.state)?.label ?? filters.state,
            onRemove: () => filters.setState(undefined),
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
            onRemove: () => filters.setArchive(COURSE_ARCHIVE_FILTERS.ACTIVE),
          },
        ]
      : []),
  ];

  return (
    <DataTableToolbar
      searchValue={filters.searchInput}
      onSearchChange={filters.setSearchInput}
      searchPlaceholder={t("adminCoursesView.filters.placeholder.title")}
      searchTestId={COURSES_PAGE_HANDLES.TITLE_FILTER}
      activeFilters={activeFilters}
      canResetFilters={filters.activeFilterCount > 0}
      onResetFilters={filters.resetFilters}
      resetTestId={COURSES_PAGE_HANDLES.RESET_FILTERS_BUTTON}
      getActiveFilterTestId={COURSES_PAGE_HANDLES.activeFilterPill}
      getRemoveFilterTestId={COURSES_PAGE_HANDLES.removeFilterButton}
    >
      <OptionPicker
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
          <OptionPicker
            label={t("adminCoursesView.field.state")}
            placeholder={t("common.other.allStatuses")}
            className="w-full sm:w-44"
            options={stateOptions}
            selectedIds={[filters.state ?? COURSES_TABLE_ANY_FILTER_VALUE]}
            testId={COURSES_PAGE_HANDLES.STATE_FILTER}
            optionTestId={({ id }) =>
              COURSES_PAGE_HANDLES.stateFilterOption(
                isCourseStatus(id) ? id : ANY_OPTION_TEST_ID_VALUE,
              )
            }
            onToggle={({ id }) => filters.setState(isCourseStatus(id) ? id : undefined)}
          />

          <OptionPicker
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
    </DataTableToolbar>
  );
}
