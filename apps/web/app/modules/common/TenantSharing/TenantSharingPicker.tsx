import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Pagination, PAGINATION_VARIANTS } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import {
  canShareWithTenant,
  getTenantSharingColumns,
  TENANT_SHARING_COLUMN_IDS,
} from "./tenantSharing.columns";
import { TENANT_SHARING_PAGE_SIZE } from "./useTenantSharingPicker";

import type { SharingTenant } from "./tenantSharing.types";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";

type TenantSharingPickerProps = {
  title: string;
  description: string;
  tenants: SharingTenant[] | undefined;
  pagination: { totalItems: number; page: number; perPage: number } | undefined;
  search: string;
  searchInput: string;
  onSearchInputChange: (searchInput: string) => void;
  onPageChange: (page: number) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  selectedCount: number;
  onClearSelection: () => void;
  isFetching: boolean;
  isSharePending: boolean;
  onShare: () => void;
};

const LOADING_ROW_COUNT = 3;

export function TenantSharingPicker({
  title,
  description,
  tenants,
  pagination,
  search,
  searchInput,
  onSearchInputChange,
  onPageChange,
  rowSelection,
  onRowSelectionChange,
  selectedCount,
  onClearSelection,
  isFetching,
  isSharePending,
  onShare,
}: TenantSharingPickerProps) {
  const { t } = useTranslation();
  const columns = useMemo(() => getTenantSharingColumns(t), [t]);

  const table = useReactTable({
    data: tenants ?? [],
    columns,
    getRowId: (tenant) => tenant.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: (row) => canShareWithTenant(row.original),
    manualPagination: true,
    onRowSelectionChange,
    state: { rowSelection },
  });

  const hasMultiplePages = Boolean(pagination && pagination.totalItems > pagination.perPage);
  const shareButtonLabel = match({ isSharePending, selectedCount })
    .with({ isSharePending: true }, () => t("tenantSharing.sharingButton"))
    .with({ selectedCount: 0 }, () => t("tenantSharing.shareButton"))
    .otherwise(() => t("tenantSharing.shareWithCountButton", { count: selectedCount }));

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="body-base-md text-neutral-950">{title}</h2>
        <p className="details-md text-neutral-600">{description}</p>
      </header>

      <SearchInput
        value={searchInput}
        onChange={(event) => onSearchInputChange(event.target.value)}
        placeholder={t("tenantSharing.searchPlaceholder")}
        wrapperClassName="max-w-none"
        className="max-w-none"
        clearable
      />

      <div className={cn("transition-opacity", isFetching && tenants && "opacity-60")}>
        <Table className="border bg-neutral-50">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn({
                      "w-12": header.id === TENANT_SHARING_COLUMN_IDS.SELECT,
                      "text-right": header.id === TENANT_SHARING_COLUMN_IDS.STATUS,
                    })}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {!tenants && <TenantSharingLoadingRows />}
            {tenants?.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-neutral-600">
                  {search ? t("tenantSharing.emptySearch") : t("tenantSharing.emptyList")}
                </TableCell>
              </TableRow>
            )}
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                onClick={() => row.getCanSelect() && row.toggleSelected()}
                className={cn(row.getCanSelect() && "cursor-pointer hover:bg-neutral-100")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn({
                      "!w-12": cell.column.id === TENANT_SHARING_COLUMN_IDS.SELECT,
                      "text-right": cell.column.id === TENANT_SHARING_COLUMN_IDS.STATUS,
                    })}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMultiplePages && pagination && (
        <Pagination
          variant={PAGINATION_VARIANTS.COMPACT}
          totalItems={pagination.totalItems}
          itemsPerPage={TENANT_SHARING_PAGE_SIZE}
          currentPage={pagination.page}
          canChangeItemsPerPage={false}
          onPageChange={onPageChange}
        />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <div className="details-md flex items-center gap-2 text-neutral-600">
          <span>{t("tenantSharing.selectedCount", { count: selectedCount })}</span>
          {selectedCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <Button
                type="button"
                variant="link"
                className="details-md h-auto p-0 text-primary-700"
                onClick={onClearSelection}
              >
                {t("tenantSharing.clearSelection")}
              </Button>
            </>
          )}
        </div>
        <Button type="button" onClick={onShare} disabled={!selectedCount || isSharePending}>
          {shareButtonLabel}
        </Button>
      </footer>
    </section>
  );
}

function TenantSharingLoadingRows() {
  return Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
    <TableRow key={index}>
      <TableCell className="!w-12">
        <Skeleton className="size-4 rounded" />
      </TableCell>
      <TableCell colSpan={2}>
        <Skeleton className="h-4 w-2/3" />
      </TableCell>
    </TableRow>
  ));
}
