import { Link, useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import {
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { Plus, SearchX } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDuplicateCourse } from "~/api/mutations/admin/useDuplicateCourse";
import { useCategoriesSuspense, useCurrentUserSuspense } from "~/api/queries";
import { useCoursesTableSuspense } from "~/api/queries/useCoursesTable";
import { hasAnyPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { CourseBulkActions } from "~/modules/Admin/Courses/components/CourseBulkActions";
import { ContentMarketplaceLink } from "~/modules/ContentMarketplace/components/ContentMarketplaceLink";
import { CoursesViewToggle } from "~/modules/Courses/components/CoursesViewToggle";
import { COURSES_TABLE_PATH, COURSES_VIEWS } from "~/modules/Courses/utils/coursesView";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import { COURSES_PAGE_HANDLES } from "../../../../e2e/data/courses/handles";

import { getCoursesTableColumns } from "./components/CoursesTable.columns";
import { CoursesTableFilters } from "./components/CoursesTableFilters";
import { useCoursesTableFilters } from "./hooks/useCoursesTableFilters";

const SELECT_COLUMN_ID = "select";

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

  const deferredCourseParams = useDeferredValue(filters.courseParams);
  const isRefreshingCourses = deferredCourseParams !== filters.courseParams;

  const { data: categories } = useCategoriesSuspense({ language });
  const {
    data: { data: courses, pagination },
  } = useCoursesTableSuspense({ ...deferredCourseParams, language });
  const lastPage = Math.max(1, Math.ceil(pagination.totalItems / pagination.perPage));

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number>(0);

  useEffect(() => {
    setRowSelection({});
  }, [filters.courseParams]);

  // A page can disappear after deletions or archiving; land on the last page that still exists.
  useEffect(() => {
    if (filters.page > lastPage) filters.setPage(lastPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, lastPage]);

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
    lastSelectedRowIndex,
    setLastSelectedRowIndex,
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
  const tableRows = table.getRowModel().rows;
  const hasSelectedCourses = selectedCourseIds.length > 0;

  const openCourse = (courseId: string) => navigate(`/course/${courseId}`);

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
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h4 data-testid={COURSES_PAGE_HANDLES.HEADING} className="h4 min-w-0 text-neutral-950">
            {canManageCourses
              ? t("adminCoursesView.courses.header")
              : t("adminCoursesView.courses.learnerHeader")}
          </h4>
          <div className="flex flex-wrap items-center gap-3">
            <ContentMarketplaceLink />
            {canManageCourses && (
              <Link data-testid={COURSES_PAGE_HANDLES.CREATE_BUTTON} to="/admin/beta-courses/new">
                <Button variant="primary" className="gap-2">
                  <Plus className="size-4" aria-hidden />
                  {t("adminCoursesView.button.createNew")}
                </Button>
              </Link>
            )}
          </div>
        </header>

        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <CoursesTableFilters
            filters={filters}
            categoryTitles={(categories ?? []).map(({ title }) => title)}
            canFilterByManagementState={canManageCourses}
          />

          {canManageCourses && (
            // Collapsing the grid row animates the bar's height without measuring its content.
            <div
              aria-hidden={!hasSelectedCourses}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                hasSelectedCourses && "grid-rows-[1fr] opacity-100",
                !hasSelectedCourses && "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="flex items-center border-t border-neutral-200 bg-primary-50 p-2">
                  <CourseBulkActions
                    selectedCourseIds={selectedCourseIds}
                    selectedArchivedStates={selectedArchivedStates}
                    categories={categories ?? []}
                    onBulkActionComplete={() => setRowSelection({})}
                    className="ml-0 p-0"
                  />
                  <span
                    data-testid={COURSES_PAGE_HANDLES.SELECTED_COUNT}
                    className="ml-3 text-sm font-medium text-neutral-700"
                  >
                    {t("adminCoursesView.selectedCount", { count: selectedCourseIds.length })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div
            aria-busy={isRefreshingCourses}
            className={cn(
              "border-t border-neutral-200 transition-opacity",
              isRefreshingCourses && "opacity-60",
            )}
          >
            <Table data-testid={COURSES_PAGE_HANDLES.TABLE}>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn({ "size-12": header.column.id === SELECT_COLUMN_ID })}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody data-testid={COURSES_PAGE_HANDLES.TABLE_BODY}>
                {tableRows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-course-id={row.original.id}
                    data-testid={COURSES_PAGE_HANDLES.row(row.original.id)}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={(event) => {
                      if (
                        event.target instanceof HTMLElement &&
                        (event.target.closest("[data-course-row-action]") ||
                          event.target.closest(".course-row-action-overlay"))
                      ) {
                        return;
                      }

                      openCourse(row.original.id);
                    }}
                    className="cursor-pointer hover:bg-neutral-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn("py-2", {
                          "size-12": cell.column.id === SELECT_COLUMN_ID,
                        })}
                        onClick={(event) => {
                          if (cell.column.id !== SELECT_COLUMN_ID) return;

                          event.stopPropagation();
                          handleRowSelectionRange({
                            table,
                            event,
                            id: row.id,
                            value: row.getIsSelected(),
                            lastSelectedRowIndex,
                            setLastSelectedRowIndex,
                          });
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {tableRows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length}>
                      <div
                        data-testid={COURSES_PAGE_HANDLES.EMPTY_STATE}
                        className="flex flex-col items-center gap-3 py-12 text-center"
                      >
                        <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                          <SearchX className="size-6" aria-hidden />
                        </span>
                        <div>
                          <p className="font-medium text-neutral-950">
                            {t("adminCoursesView.empty.title")}
                          </p>
                          <p className="text-sm text-neutral-700">
                            {t("adminCoursesView.empty.description")}
                          </p>
                        </div>
                        {filters.activeFilterCount > 0 && (
                          <Button type="button" variant="outline" onClick={filters.resetFilters}>
                            {t("reports.filters.resetAll")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.totalItems > 0 && (
            <Pagination
              className="border-t border-neutral-200"
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
          )}
        </section>
      </div>
    </PageWrapper>
  );
};

export default CoursesTableView;
