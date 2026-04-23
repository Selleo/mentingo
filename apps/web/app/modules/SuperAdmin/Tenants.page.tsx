import { Link, type MetaFunction } from "@remix-run/react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateSupportSession } from "~/api/mutations/super-admin/useCreateSupportSession";
import { useTenants } from "~/api/queries/super-admin/useTenants";
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
import { getTenantsColumns } from "~/modules/SuperAdmin/tenants.columns";
import { setPageTitle } from "~/utils/setPageTitle";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { FilterConfig, FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.tenants");

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof ITEMS_PER_PAGE_OPTIONS)[number]>(10);

  const { t } = useTranslation();
  const { data: tenants, isLoading } = useTenants({ page, perPage, search });
  const { mutateAsync: createSupportSession, isPending: isCreatingSupportSession } =
    useCreateSupportSession();

  const columns = useMemo(
    () =>
      getTenantsColumns(
        t,
        async (tenantId: string) => {
          const response = await createSupportSession({ tenantId });
          window.location.assign(response.data.redirectUrl);
        },
        isCreatingSupportSession,
      ),
    [createSupportSession, isCreatingSupportSession, t],
  );
  const filters = useMemo<FilterConfig[]>(
    () => [
      {
        name: "search",
        type: "text",
        testId: TENANTS_PAGE_HANDLES.SEARCH_INPUT,
        placeholder: t("superAdminTenantsView.search.placeholder"),
        default: "",
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: tenants?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
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
            values={{ search }}
            onChange={(name: string, value: FilterValue) => {
              if (name === "search") {
                setSearch((value as string) ?? "");
                setPage(1);
              }
            }}
          />
        </div>

        <div>
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
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                    {t("superAdminTenantsView.table.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && table.getRowModel().rows.length === 0 && (
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
            onPageChange={(newPage) => setPage(newPage)}
            onItemsPerPageChange={(newPerPage) => {
              setPage(1);
              setPerPage(Number(newPerPage) as (typeof ITEMS_PER_PAGE_OPTIONS)[number]);
            }}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
