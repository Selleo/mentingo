import { Link } from "@remix-run/react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useTenants } from "~/api/queries/super-admin/useTenants";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { getTenantsColumns } from "~/modules/SuperAdmin/tenants.columns";

import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof ITEMS_PER_PAGE_OPTIONS)[number]>(10);

  const { t } = useTranslation();
  const { data: tenants, isLoading } = useTenants({ page, perPage, search });

  const columns = useMemo(() => getTenantsColumns(t), [t]);

  const table = useReactTable({
    data: tenants?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageWrapper>
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t("superAdminTenantsView.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("superAdminTenantsView.description")}
            </p>
          </div>
          <Button asChild>
            <Link to="/super-admin/tenants/new">{t("superAdminTenantsView.actions.create")}</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder={t("superAdminTenantsView.search.placeholder")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <Table className="border bg-neutral-50">
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
          <TableBody>
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
              <TableRow key={row.id} className="hover:bg-neutral-100">
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
    </PageWrapper>
  );
}
