import { Link, useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useDeferredValue } from "react";
import { useTranslation } from "react-i18next";

import { useDuplicateCourse } from "~/api/mutations/admin/useDuplicateCourse";
import { useCategoriesSuspense, useCurrentUserSuspense } from "~/api/queries";
import { useCoursesTableSuspense } from "~/api/queries/useCoursesTable";
import { hasAnyPermission } from "~/common/permissions/permission.utils";
import {
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableSelectionBar,
  useClampedPage,
  useListedRowSelection,
  useRowRangeSelection,
} from "~/components/DataTable";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Button } from "~/components/ui/button";
import { CourseBulkActions } from "~/modules/Admin/Courses/components/CourseBulkActions";
import { ContentMarketplaceLink } from "~/modules/ContentMarketplace/components/ContentMarketplaceLink";
import { CoursesViewToggle } from "~/modules/Courses/components/CoursesViewToggle";
import { COURSES_TABLE_PATH, COURSES_VIEWS } from "~/modules/Courses/utils/coursesView";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSES_PAGE_HANDLES } from "../../../../e2e/data/courses/handles";

import { getCoursesTableColumns } from "./components/CoursesTable.columns";
import { CoursesTableFilters } from "./components/CoursesTableFilters";
import { useCoursesTableFilters } from "./hooks/useCoursesTableFilters";

const CoursesTableView = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: currentUser } = useCurrentUserSuspense();
  const permissions = currentUser?.permissions ?? [];

  const canManageCourses = hasAnyPermission(permissions, [
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
  ]);
  const filters = useCoursesTableFilters({ canFilterByManagementState: canManageCourses });

  // Keeps the current rows on screen while courses for the new filters load.
  const deferredCourseParams = useDeferredValue(filters.courseParams);
  const isRefreshingCourses = deferredCourseParams !== filters.courseParams;

  const { data: categories } = useCategoriesSuspense({ language });
  const {
    data: { data: courses, pagination },
  } = useCoursesTableSuspense({ ...deferredCourseParams, language });

  const [rowSelection, setRowSelection] = useListedRowSelection(courses.map(({ id }) => id));
  const rowRangeSelection = useRowRangeSelection();

  useClampedPage({
    page: filters.page,
    perPage: pagination.perPage,
    totalItems: pagination.totalItems,
    setPage: filters.setPage,
  });

  const { mutateAsync: duplicateCourse } = useDuplicateCourse();

  const duplicateCourseAndOpenCopy = async (courseId: string) => {
    const {
      data: { courseId: newCourseId, jobId },
    } = await duplicateCourse(courseId);
    navigate(`/admin/beta-courses/${newCourseId}?duplicationJobId=${jobId}`);
  };

  const columns = getCoursesTableColumns({
    t,
    canManageCourses,
    categories: categories ?? [],
    rowRangeSelection,
    onDuplicateCourse: (courseId) => void duplicateCourseAndOpenCopy(courseId),
  });

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: courses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: filters.setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: canManageCourses,
    state: {
      sorting: filters.sorting,
      rowSelection,
    },
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCourseIds = selectedRows.map((row) => row.original.id);
  const selectedArchivedStates = selectedRows.map((row) => row.original.isArchived ?? false);

  return (
    <PageWrapper
      breadcrumbsAction={
        <CoursesViewToggle active={COURSES_VIEWS.TABLE} className="bg-white shadow-none" />
      }
      breadcrumbs={[
        {
          title: t("adminCourseView.breadcrumbs.courses"),
          href: COURSES_TABLE_PATH,
        },
      ]}
    >
      <div data-testid={COURSES_PAGE_HANDLES.PAGE} className="flex flex-col gap-6">
        <PageHeader
          title={
            canManageCourses
              ? t("adminCoursesView.courses.header")
              : t("adminCoursesView.courses.learnerHeader")
          }
          headingTestId={COURSES_PAGE_HANDLES.HEADING}
          actions={
            <>
              <ContentMarketplaceLink />
              {canManageCourses && (
                <Link data-testid={COURSES_PAGE_HANDLES.CREATE_BUTTON} to="/admin/beta-courses/new">
                  <Button variant="primary" className="gap-2">
                    <Plus className="size-4" aria-hidden />
                    {t("adminCoursesView.button.createNew")}
                  </Button>
                </Link>
              )}
            </>
          }
        />

        <DataTableCard>
          <CoursesTableFilters
            filters={filters}
            categoryTitles={(categories ?? []).map(({ title }) => title)}
            canFilterByManagementState={canManageCourses}
          />

          {canManageCourses && (
            <DataTableSelectionBar
              selectedCount={selectedCourseIds.length}
              countTestId={COURSES_PAGE_HANDLES.SELECTED_COUNT}
            >
              <CourseBulkActions
                selectedCourseIds={selectedCourseIds}
                selectedArchivedStates={selectedArchivedStates}
                categories={categories ?? []}
                onBulkActionComplete={() => setRowSelection({})}
                className="ml-0 p-0"
              />
            </DataTableSelectionBar>
          )}

          <DataTable
            table={table}
            isRefreshing={isRefreshingCourses}
            onRowClick={(row) => navigate(`/course/${row.original.id}`)}
            rowRangeSelection={rowRangeSelection}
            testId={COURSES_PAGE_HANDLES.TABLE}
            bodyTestId={COURSES_PAGE_HANDLES.TABLE_BODY}
            getRowTestId={(course) => COURSES_PAGE_HANDLES.row(course.id)}
            getRowAttributes={(course) => ({ "data-course-id": course.id })}
            emptyState={
              <DataTableEmptyState
                testId={COURSES_PAGE_HANDLES.EMPTY_STATE}
                onResetFilters={filters.activeFilterCount > 0 ? filters.resetFilters : undefined}
              />
            }
          />

          <DataTablePagination
            totalItems={pagination.totalItems}
            itemsPerPage={filters.perPage}
            currentPage={filters.page}
            onPageChange={filters.setPage}
            onItemsPerPageChange={filters.setPerPage}
            testIds={{
              previous: COURSES_PAGE_HANDLES.PAGINATION_PREVIOUS,
              next: COURSES_PAGE_HANDLES.PAGINATION_NEXT,
              page: COURSES_PAGE_HANDLES.paginationPage,
              itemsPerPage: COURSES_PAGE_HANDLES.PAGINATION_ITEMS_PER_PAGE,
            }}
          />
        </DataTableCard>
      </div>
    </PageWrapper>
  );
};

export default CoursesTableView;
