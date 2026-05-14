import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseISO } from "date-fns";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { useActivityLogsQuerySuspense } from "~/api/queries/admin/useActivityLogs";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getActivityLogsColumns } from "~/modules/ActivityLogs/activityLogs.columns";
import { ActivityLogAccordionRow } from "~/modules/ActivityLogs/components/ActivityLogAccordionRow";
import { SearchFilter } from "~/modules/common/SearchFilter/SearchFilter";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.activityLogs");

export default function ActivityLogsPage() {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const [searchParams, setSearchParams] = useState<{
    email?: string;
    from?: string;
    to?: string;
    page?: number;
    perPage?: (typeof ITEMS_PER_PAGE_OPTIONS)[number];
  }>({
    email: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    perPage: 10,
  });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const handleFilterChange = useCallback(
    (name: "page" | "perPage" | "email" | "from" | "to", value: number | string | undefined) => {
      setExpandedRowId(null);

      startTransition(() => {
        setSearchParams((prev) => ({
          ...prev,
          ...(name !== "page" ? { page: 1 } : {}),
          [name]: value,
        }));
      });
    },
    [startTransition],
  );

  const handleRowToggle = useCallback((rowId: string) => {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }, []);

  const fromDate = useMemo(() => {
    if (!searchParams.from) return undefined;

    const parsedDate = parseISO(searchParams.from);

    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }, [searchParams.from]);

  const toDate = useMemo(() => {
    if (!searchParams.to) return undefined;

    const parsedDate = parseISO(searchParams.to);

    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }, [searchParams.to]);

  const activityLogsQueryParams = useMemo(
    () => ({
      page: searchParams.page,
      perPage: searchParams.perPage,
      ...(searchParams.email ? { email: searchParams.email } : {}),
      ...(searchParams.from ? { from: searchParams.from } : {}),
      ...(searchParams.to ? { to: searchParams.to } : {}),
    }),
    [searchParams],
  );

  const { data: activityLogsData, isLoading } =
    useActivityLogsQuerySuspense(activityLogsQueryParams);

  const breadcrumbs = [
    { title: t("activityLogsView.breadcrumbs.activityLogs"), href: "/admin/activity-logs" },
  ];

  const { data, pagination } = activityLogsData ?? {};
  const { totalItems, perPage: pageSize, page: currentPage } = pagination ?? {};

  const activityLogs = data ?? [];

  const columns = useMemo(
    () =>
      getActivityLogsColumns(t, {
        expandedRowId,
        onToggleRow: handleRowToggle,
      }),
    [expandedRowId, handleRowToggle, t],
  );
  const filters = useMemo(
    () => [
      {
        name: "email",
        type: "text" as const,
        placeholder: t("activityLogsView.filters.placeholder.searchByEmail"),
      },
      {
        name: "from",
        type: "date" as const,
        placeholder: t("activityLogsView.filters.placeholder.from"),
        maxDate: toDate,
      },
      {
        name: "to",
        type: "date" as const,
        placeholder: t("activityLogsView.filters.placeholder.to"),
        minDate: fromDate,
      },
    ],
    [fromDate, t, toDate],
  );

  const filterValues = useMemo(
    () => ({
      email: searchParams.email,
      from: searchParams.from,
      to: searchParams.to,
    }),
    [searchParams.email, searchParams.from, searchParams.to],
  );

  const table = useReactTable({
    data: activityLogs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <PageWrapper breadcrumbs={breadcrumbs} className="bg-neutral-50/50">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="h4">{t("navigationSideBar.activityLogs")}</h1>
          <p className="max-w-2xl text-sm text-neutral-600">{t("activityLogsView.description")}</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <SearchFilter
              filters={filters}
              values={filterValues}
              onChange={(key, value) => {
                handleFilterChange(key as "email" | "from" | "to", value as string | undefined);
              }}
              isLoading={isPending}
            />
          </div>
          <Table className="border bg-neutral-50">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                    <TableHead
                      key={header.id}
                      className={index === headerGroup.headers.length - 1 ? "w-12 text-right" : ""}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    {t("activityLogsView.table.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && table.getRowModel().rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    {t("activityLogsView.table.empty")}
                  </TableCell>
                </TableRow>
              )}
              {table.getRowModel().rows.map((row) => (
                <ActivityLogAccordionRow
                  key={row.id}
                  row={row}
                  columnsLength={columns.length}
                  isExpanded={expandedRowId === row.id}
                />
              ))}
            </TableBody>
          </Table>
          {!isLoading && (totalItems ?? 0) > 0 && (
            <Pagination
              className="border-b border-x bg-neutral-50 rounded-b-lg"
              emptyDataClassName="border-b border-x bg-neutral-50 rounded-b-lg"
              totalItems={totalItems}
              itemsPerPage={pageSize as (typeof ITEMS_PER_PAGE_OPTIONS)[number]}
              currentPage={currentPage ?? searchParams.page ?? 1}
              onPageChange={(newPage) => handleFilterChange("page", newPage)}
              onItemsPerPageChange={(newPerPage) => {
                handleFilterChange("page", 1);
                handleFilterChange(
                  "perPage",
                  Number(newPerPage) as (typeof ITEMS_PER_PAGE_OPTIONS)[number],
                );
              }}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
