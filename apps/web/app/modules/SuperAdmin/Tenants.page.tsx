import { Link, type MetaFunction } from "@remix-run/react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { useCreateSupportSession } from "~/api/mutations/super-admin/useCreateSupportSession";
import { useDeleteTenant } from "~/api/mutations/super-admin/useDeleteTenant";
import { useTenantsSuspense } from "~/api/queries/super-admin/useTenants";
import { PageWrapper } from "~/components/PageWrapper";
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
import { SearchFilter } from "~/modules/common/SearchFilter/SearchFilter";
import { TenantDeleteDialog } from "~/modules/SuperAdmin/TenantDeleteDialog";
import { getTenantsColumns } from "~/modules/SuperAdmin/tenants.columns";
import { setPageTitle } from "~/utils/setPageTitle";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import type { TenantsQueryParams } from "~/api/queries/super-admin/useTenants";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { FilterConfig, FilterValue } from "~/modules/common/SearchFilter/SearchFilter";
import type { Tenant } from "~/modules/SuperAdmin/tenants.columns";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.tenants");

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof ITEMS_PER_PAGE_OPTIONS)[number]>(10);
  const [status, setStatus] = useState<TenantsQueryParams["status"]>("active");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [isPending, startTransition] = useTransition();

  const { t, i18n } = useTranslation();
  const sort = useMemo<TenantsQueryParams["sort"]>(() => {
    const activeSort = sorting[0];

    if (!activeSort) return undefined;

    const direction = activeSort.desc ? "-" : "";
    return `${direction}${activeSort.id}` as TenantsQueryParams["sort"];
  }, [sorting]);
  const { data: tenants } = useTenantsSuspense({ page, perPage, search, status, sort });
  const { mutateAsync: createSupportSession, isPending: isCreatingSupportSession } =
    useCreateSupportSession();
  const { mutateAsync: deleteTenant, isPending: isDeletingTenant } = useDeleteTenant();

  const columns = useMemo(
    () =>
      getTenantsColumns(
        t,
        async (tenantId: string, targetUserId: string) => {
          const supportModeResponse = await createSupportSession({ tenantId, targetUserId });
          window.location.assign(supportModeResponse.data.redirectUrl);
        },
        isCreatingSupportSession,
        i18n.language,
        setTenantToDelete,
      ),
    [createSupportSession, i18n.language, isCreatingSupportSession, t],
  );

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;

    const moveToPreviousPage = page > 1 && tenants.data.length === 1;

    await deleteTenant({ id: tenantToDelete.id });
    setTenantToDelete(null);

    if (moveToPreviousPage) {
      startTransition(() => setPage((currentPage) => Math.max(1, currentPage - 1)));
    }
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    startTransition(() => {
      setSorting(updater);
      setPage(1);
    });
  };

  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        name: "search",
        type: "text",
        testId: TENANTS_PAGE_HANDLES.SEARCH_INPUT,
        placeholder: t("superAdminTenantsView.search.placeholder"),
        default: "",
      },
      {
        name: "status",
        type: "select",
        testId: TENANTS_PAGE_HANDLES.STATUS_FILTER,
        optionTestId: (option) =>
          TENANTS_PAGE_HANDLES.statusFilterOption(option.value as "all" | "active" | "inactive"),
        placeholder: t("common.other.allStatuses"),
        default: "active",
        options: [
          { value: "active", label: t("superAdminTenantsView.status.active") },
          { value: "inactive", label: t("superAdminTenantsView.status.inactive") },
        ],
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: tenants?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: handleSortingChange,
    state: { sorting },
  });

  return (
    <PageWrapper>
      <div data-testid={TENANTS_PAGE_HANDLES.PAGE} className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 data-testid={TENANTS_PAGE_HANDLES.HEADING} className="text-xl font-semibold">
              {t("superAdminTenantsView.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("superAdminTenantsView.description")}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link data-testid={TENANTS_PAGE_HANDLES.CREATE_BUTTON} to="/super-admin/tenants/new">
              <Plus className="size-4" aria-hidden="true" />
              {t("superAdminTenantsView.actions.create")}
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <SearchFilter
            id="tenants-search-filter"
            filters={filters}
            values={{ search, status }}
            onChange={(name: string, value: FilterValue) => {
              if (name === "search") {
                startTransition(() => {
                  setSearch((value as string) ?? "");
                  setPage(1);
                });
              }
              if (name === "status") {
                startTransition(() => {
                  setStatus(value as TenantsQueryParams["status"]);
                  setPage(1);
                });
              }
            }}
          />
        </div>

        <div
          className={cn("relative", isPending && "shimmer-45")}
          aria-busy={isPending}
          data-testid={TENANTS_PAGE_HANDLES.TABLE_CONTAINER}
        >
          <Table data-testid={TENANTS_PAGE_HANDLES.TABLE} className="border bg-neutral-50">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody data-testid={TENANTS_PAGE_HANDLES.TABLE_BODY}>
              {table.getRowModel().rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    {t("superAdminTenantsView.table.empty")}
                  </TableCell>
                </TableRow>
              )}
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-testid={TENANTS_PAGE_HANDLES.row(row.original.id)}
                  className="hover:bg-neutral-100"
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell key={cell.id} className={cn({ "!w-12": index === 0 })}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            className="border-b border-x bg-neutral-50 rounded-b-lg"
            emptyDataClassName="border-b border-x bg-neutral-50 rounded-b-lg"
            totalItems={tenants?.pagination?.totalItems}
            itemsPerPage={perPage}
            currentPage={page}
            onPageChange={(newPage) => startTransition(() => setPage(newPage))}
            onItemsPerPageChange={(newPerPage) => {
              startTransition(() => {
                setPage(1);
                setPerPage(Number(newPerPage) as (typeof ITEMS_PER_PAGE_OPTIONS)[number]);
              });
            }}
          />
        </div>
      </div>
      <TenantDeleteDialog
        tenantName={tenantToDelete?.name ?? ""}
        open={tenantToDelete !== null}
        isDeleting={isDeletingTenant}
        onOpenChange={(open) => {
          if (!open) setTenantToDelete(null);
        }}
        onConfirm={handleDeleteTenant}
      />
    </PageWrapper>
  );
}
