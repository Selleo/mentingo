import {
  DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS,
  DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS,
  DASHBOARD_DEADLINE_RISK_TYPES,
  DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS,
  DASHBOARD_WIDGET_TYPES,
  type DashboardDeadlineRiskGroupSortField,
  type DashboardDeadlineRiskUrgencyOrder,
} from "@repo/shared";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownUp, ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDashboardDeadlineRiskCourses } from "~/api/queries/useDashboardDeadlineRiskCourses";
import {
  useDashboardDeadlineRiskGroups,
  type DashboardDeadlineRiskGroup,
} from "~/api/queries/useDashboardDeadlineRiskGroups";
import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

const DEADLINE_RISK_FILTERS = {
  ALL: "all",
  ...DASHBOARD_DEADLINE_RISK_TYPES,
} as const;

type DeadlineRiskFilter = (typeof DEADLINE_RISK_FILTERS)[keyof typeof DEADLINE_RISK_FILTERS];

const DEADLINE_RISK_DIALOG_ACTIONS = {
  SELECT_COURSE: "select-course",
  SET_SEARCH: "set-search",
  SET_URGENCY: "set-urgency",
  SET_SORTING: "set-sorting",
  SET_EXPANDED: "set-expanded",
  RESET: "reset",
} as const;

type DeadlineRiskDialogState = {
  selectedCourseId: string | null;
  search: string;
  urgency: DeadlineRiskFilter;
  sorting: SortingState;
  expanded: ExpandedState;
};

type DeadlineRiskDialogAction =
  | { type: typeof DEADLINE_RISK_DIALOG_ACTIONS.SELECT_COURSE; courseId: string }
  | { type: typeof DEADLINE_RISK_DIALOG_ACTIONS.SET_SEARCH; search: string }
  | { type: typeof DEADLINE_RISK_DIALOG_ACTIONS.SET_URGENCY; urgency: DeadlineRiskFilter }
  | { type: typeof DEADLINE_RISK_DIALOG_ACTIONS.SET_SORTING; sorting: SortingState }
  | { type: typeof DEADLINE_RISK_DIALOG_ACTIONS.SET_EXPANDED; expanded: ExpandedState }
  | { type: typeof DEADLINE_RISK_DIALOG_ACTIONS.RESET };

const createInitialDeadlineRiskDialogState = (): DeadlineRiskDialogState => ({
  selectedCourseId: null,
  search: "",
  urgency: DEADLINE_RISK_FILTERS.ALL,
  sorting: [{ id: DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.DUE_DATE, desc: false }],
  expanded: {},
});

function deadlineRiskDialogReducer(
  state: DeadlineRiskDialogState,
  action: DeadlineRiskDialogAction,
): DeadlineRiskDialogState {
  switch (action.type) {
    case DEADLINE_RISK_DIALOG_ACTIONS.SELECT_COURSE:
      return { ...createInitialDeadlineRiskDialogState(), selectedCourseId: action.courseId };
    case DEADLINE_RISK_DIALOG_ACTIONS.SET_SEARCH:
      return { ...state, search: action.search };
    case DEADLINE_RISK_DIALOG_ACTIONS.SET_URGENCY:
      return { ...state, urgency: action.urgency, expanded: {} };
    case DEADLINE_RISK_DIALOG_ACTIONS.SET_SORTING:
      return { ...state, sorting: action.sorting, expanded: {} };
    case DEADLINE_RISK_DIALOG_ACTIONS.SET_EXPANDED:
      return { ...state, expanded: action.expanded };
    case DEADLINE_RISK_DIALOG_ACTIONS.RESET:
      return createInitialDeadlineRiskDialogState();
  }
}

function isDeadlineRiskFilter(value: string): value is DeadlineRiskFilter {
  return Object.values(DEADLINE_RISK_FILTERS).some((filter) => filter === value);
}

function isDeadlineRiskGroupSortField(value: string): value is DashboardDeadlineRiskGroupSortField {
  return Object.values(DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS).some(
    (sortField) => sortField === value,
  );
}

function isDeadlineRiskUrgencyOrder(value: string): value is DashboardDeadlineRiskUrgencyOrder {
  return Object.values(DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS).some(
    (urgencyOrder) => urgencyOrder === value,
  );
}

export function WidgetAdminDeadlineRisks() {
  const { t, i18n } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [urgencyOrder, setUrgencyOrder] = useState<DashboardDeadlineRiskUrgencyOrder>(
    DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.MOST_URGENT,
  );
  const [dialogState, dispatchDialog] = useReducer(
    deadlineRiskDialogReducer,
    undefined,
    createInitialDeadlineRiskDialogState,
  );
  const debouncedGroupSearch = useDebounce(dialogState.search.trim(), 300);
  const coursesScrollRef = useRef<HTMLDivElement>(null);
  const groupsScrollRef = useRef<HTMLDivElement>(null);
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS];
  const activeGroupSort = dialogState.sorting[0];
  const groupSortBy =
    activeGroupSort && isDeadlineRiskGroupSortField(activeGroupSort.id)
      ? activeGroupSort.id
      : DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.DUE_DATE;
  const coursesQuery = useDashboardDeadlineRiskCourses(language, urgencyOrder);
  const groupsQuery = useDashboardDeadlineRiskGroups(dialogState.selectedCourseId, language, {
    urgency: dialogState.urgency === DEADLINE_RISK_FILTERS.ALL ? undefined : dialogState.urgency,
    search: debouncedGroupSearch || undefined,
    sortBy: groupSortBy,
    sortDirection: activeGroupSort?.desc
      ? DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS.DESC
      : DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS.ASC,
  });
  const courses = useMemo(
    () => coursesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [coursesQuery.data],
  );
  const groups = useMemo(
    () => groupsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [groupsQuery.data],
  );
  const selectedCourse = courses.find((course) => course.id === dialogState.selectedCourseId);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }),
    [i18n.language],
  );
  const groupColumns = useMemo<ColumnDef<DashboardDeadlineRiskGroup>[]>(
    () => [
      {
        accessorKey: DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.NAME,
        header: t("dashboardHome.widgets.deadline_risks.group"),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2 text-left font-medium text-neutral-950">
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-neutral-400 transition-transform",
                row.getIsExpanded() && "rotate-90",
              )}
              aria-hidden="true"
            />
            <span className="block max-w-52 truncate">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.STUDENT_COUNT,
        header: t("dashboardHome.widgets.deadline_risks.learners"),
        cell: ({ row }) => (
          <span className="tabular-nums text-neutral-600">{row.original.studentCount}</span>
        ),
      },
      {
        accessorKey: DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.DUE_DATE,
        header: t("dashboardHome.widgets.deadline_risks.deadline"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-neutral-600">
            {dateFormatter.format(new Date(row.original.dueDate))}
          </span>
        ),
      },
      {
        accessorKey: DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.URGENCY,
        header: t("dashboardHome.widgets.deadline_risks.status"),
        cell: ({ row }) => (
          <div className="text-right">
            <span
              className={cn(
                "inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium",
                row.original.urgency === DASHBOARD_DEADLINE_RISK_TYPES.OVERDUE
                  ? "bg-error-50 text-error-700"
                  : "bg-warning-50 text-warning-700",
              )}
            >
              {t(`dashboardHome.widgets.deadline_risks.${row.original.urgency}`)}
            </span>
          </div>
        ),
      },
    ],
    [dateFormatter, t],
  );
  const groupsTable = useReactTable({
    data: groups,
    columns: groupColumns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    getRowId: (group) => group.id,
    manualFiltering: true,
    manualSorting: true,
    onExpandedChange: (updater) => {
      const expanded = typeof updater === "function" ? updater(dialogState.expanded) : updater;
      dispatchDialog({ type: DEADLINE_RISK_DIALOG_ACTIONS.SET_EXPANDED, expanded });
    },
    onSortingChange: (updater) => {
      const sorting = typeof updater === "function" ? updater(dialogState.sorting) : updater;
      dispatchDialog({ type: DEADLINE_RISK_DIALOG_ACTIONS.SET_SORTING, sorting });
    },
    state: {
      expanded: dialogState.expanded,
      sorting: dialogState.sorting,
      globalFilter: debouncedGroupSearch,
      columnFilters:
        dialogState.urgency === DEADLINE_RISK_FILTERS.ALL
          ? []
          : [
              {
                id: DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.URGENCY,
                value: dialogState.urgency,
              },
            ],
    },
  });
  const loadNextCoursesPage = () => {
    if (!coursesQuery.hasNextPage || coursesQuery.isFetchingNextPage) return;
    void coursesQuery.fetchNextPage();
  };
  const loadNextGroupsPage = () => {
    if (!groupsQuery.hasNextPage || groupsQuery.isFetchingNextPage) return;
    void groupsQuery.fetchNextPage();
  };
  const handleCoursesScroll = () => {
    const element = coursesScrollRef.current;
    if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 96) {
      loadNextCoursesPage();
    }
  };
  const handleGroupsScroll = () => {
    const element = groupsScrollRef.current;
    if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 96) {
      loadNextGroupsPage();
    }
  };

  return (
    <>
      <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS}>
        <DashboardWidgetHeader
          title={t(metadata.titleKey)}
          icon={metadata.icon}
          headerAction={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                  aria-label={t("dashboardHome.widgets.deadline_risks.sort")}
                  title={t("dashboardHome.widgets.deadline_risks.sort")}
                >
                  <ArrowDownUp className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuRadioGroup
                  value={urgencyOrder}
                  onValueChange={(value) => {
                    if (isDeadlineRiskUrgencyOrder(value)) setUrgencyOrder(value);
                  }}
                >
                  <DropdownMenuRadioItem
                    value={DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.MOST_URGENT}
                    className="pl-2 data-[state=checked]:bg-primary-50 data-[state=checked]:text-primary-800 [&>span:first-child]:hidden"
                  >
                    {t("dashboardHome.widgets.deadline_risks.sortMostUrgent")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value={DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.LEAST_URGENT}
                    className="pl-2 data-[state=checked]:bg-primary-50 data-[state=checked]:text-primary-800 [&>span:first-child]:hidden"
                  >
                    {t("dashboardHome.widgets.deadline_risks.sortLeastUrgent")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
        <DashboardWidgetContent>
          {coursesQuery.isLoading || coursesQuery.isError ? (
            <DashboardWidgetQueryState
              isLoading={coursesQuery.isLoading}
              isError={coursesQuery.isError}
              onRetry={() => void coursesQuery.refetch()}
            />
          ) : courses.length === 0 ? (
            <p className="flex h-full items-center justify-center p-4 text-center text-neutral-600">
              {t("dashboardHome.widgets.deadline_risks.empty")}
            </p>
          ) : (
            <div
              ref={coursesScrollRef}
              onScroll={handleCoursesScroll}
              className="h-full min-h-0 overflow-y-auto p-3"
            >
              <div className="space-y-2">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() =>
                      dispatchDialog({
                        type: DEADLINE_RISK_DIALOG_ACTIONS.SELECT_COURSE,
                        courseId: course.id,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
                    aria-label={`${course.title}, ${t(`dashboardHome.widgets.deadline_risks.${course.urgency}`)}`}
                  >
                    <img
                      src={course.thumbnailUrl || DefaultPhotoCourse}
                      alt=""
                      className="h-10 w-16 shrink-0 rounded-md object-cover"
                      onError={(event) => {
                        event.currentTarget.src = DefaultPhotoCourse;
                      }}
                    />
                    <span className="body-sm-md min-w-0 flex-1 truncate text-neutral-950">
                      {course.title}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DashboardWidgetContent>
      </DashboardWidgetCard>

      <Dialog
        open={Boolean(selectedCourse)}
        onOpenChange={(open) => {
          if (open) return;
          dispatchDialog({ type: DEADLINE_RISK_DIALOG_ACTIONS.RESET });
        }}
      >
        <DialogContent
          variant="mobileDrawer"
          className="!flex h-[85dvh] !flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[min(720px,calc(100dvh-2rem))] sm:!max-w-2xl"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <DialogHeader className="border-b border-neutral-100 px-5 py-4 text-left">
            <DialogTitle>{selectedCourse?.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("dashboardHome.widgets.deadline_risks.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid shrink-0 gap-2 border-b border-neutral-100 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <Input
              type="search"
              value={dialogState.search}
              onChange={(event) =>
                dispatchDialog({
                  type: DEADLINE_RISK_DIALOG_ACTIONS.SET_SEARCH,
                  search: event.target.value,
                })
              }
              placeholder={t("dashboardHome.widgets.deadline_risks.searchGroups")}
              aria-label={t("dashboardHome.widgets.deadline_risks.searchGroups")}
              className="h-9"
            />
            <Select
              value={dialogState.urgency}
              onValueChange={(value) => {
                if (isDeadlineRiskFilter(value)) {
                  dispatchDialog({
                    type: DEADLINE_RISK_DIALOG_ACTIONS.SET_URGENCY,
                    urgency: value,
                  });
                }
              }}
            >
              <SelectTrigger
                className="h-9"
                aria-label={t("dashboardHome.widgets.deadline_risks.status")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value={DEADLINE_RISK_FILTERS.ALL}
                  className="pl-2 data-[state=checked]:bg-primary-50 data-[state=checked]:text-primary-800 [&>span:first-child]:hidden"
                >
                  {t("dashboardHome.widgets.deadline_risks.allStatuses")}
                </SelectItem>
                <SelectItem
                  value={DASHBOARD_DEADLINE_RISK_TYPES.OVERDUE}
                  className="pl-2 data-[state=checked]:bg-primary-50 data-[state=checked]:text-primary-800 [&>span:first-child]:hidden"
                >
                  {t("dashboardHome.widgets.deadline_risks.overdue")}
                </SelectItem>
                <SelectItem
                  value={DASHBOARD_DEADLINE_RISK_TYPES.DUE_SOON}
                  className="pl-2 data-[state=checked]:bg-primary-50 data-[state=checked]:text-primary-800 [&>span:first-child]:hidden"
                >
                  {t("dashboardHome.widgets.deadline_risks.dueSoon")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div
            ref={groupsScrollRef}
            onScroll={handleGroupsScroll}
            className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          >
            {groupsQuery.isError ? (
              <DashboardWidgetQueryState
                isLoading={false}
                isError
                onRetry={() => void groupsQuery.refetch()}
              />
            ) : (
              <>
                {!groupsQuery.isLoading && groups.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-500">
                    {t("dashboardHome.widgets.deadline_risks.groupsEmpty")}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-neutral-200">
                    <Table>
                      <TableHeader>
                        {groupsTable.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => (
                              <TableHead
                                key={header.id}
                                className={cn(
                                  "h-10 px-3",
                                  header.column.id ===
                                    DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.URGENCY &&
                                    "text-right",
                                )}
                              >
                                {header.isPlaceholder ? null : (
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-1.5 text-left hover:text-neutral-950",
                                      header.column.id ===
                                        DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.URGENCY &&
                                        "justify-end",
                                    )}
                                    onClick={header.column.getToggleSortingHandler()}
                                  >
                                    {flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                                    {header.column.getIsSorted() ? (
                                      <ChevronDown
                                        className={cn(
                                          "size-3.5",
                                          header.column.getIsSorted() === "asc" && "rotate-180",
                                        )}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <ArrowDownUp
                                        className="size-3.5 opacity-50"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                )}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {groupsTable.getRowModel().rows.map((row) => (
                          <Fragment key={row.id}>
                            <TableRow
                              data-state={row.getIsExpanded() ? "selected" : undefined}
                              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
                              onClick={row.getToggleExpandedHandler()}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                row.toggleExpanded();
                              }}
                              tabIndex={0}
                              aria-expanded={row.getIsExpanded()}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className="px-3 py-3">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                            {row.getIsExpanded() &&
                              row.original.students.map((student) => (
                                <TableRow
                                  key={`${row.id}-${student.id}`}
                                  className="bg-neutral-50/60"
                                >
                                  <TableCell className="py-2 pl-9 pr-3 text-sm text-neutral-700">
                                    {student.name}
                                  </TableCell>
                                  <TableCell colSpan={3} />
                                </TableRow>
                              ))}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
