import {
  flexRender,
  getCoreRowModel,
  type OnChangeFn,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { FileArchive, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import { getAssetLibraryColumns } from "./assetLibrary.columns";

import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";

type AssetLibraryAssetListProps = {
  assets: ResourceLibraryAsset[];
  isLoading: boolean;
  canInsert: boolean;
  canDelete: boolean;
  isMutating: boolean;
  rowSelection: RowSelectionState;
  onInsert: (asset: ResourceLibraryAsset) => void;
  onDelete: (asset: ResourceLibraryAsset) => void;
  onVisibilityChange: (asset: ResourceLibraryAsset) => void;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
};

export const AssetLibraryAssetList = ({
  assets,
  isLoading,
  canInsert,
  canDelete,
  isMutating,
  rowSelection,
  onInsert,
  onDelete,
  onVisibilityChange,
  onRowSelectionChange,
}: AssetLibraryAssetListProps) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () =>
      getAssetLibraryColumns({
        canDelete,
        canInsert,
        isMutating,
        onDelete,
        onInsert,
        onVisibilityChange,
        t,
      }),
    [canDelete, canInsert, isMutating, onDelete, onInsert, onVisibilityChange, t],
  );

  const table = useReactTable({
    data: assets,
    columns,
    getRowId: (asset) => asset.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: (row) => row.original.canChangeVisibility,
    onRowSelectionChange,
    state: { rowSelection },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-neutral-600">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        {t("richText.assetLibrary.loading")}
      </div>
    );
  }

  if (!assets.length) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center text-neutral-600">
        <FileArchive className="size-9 text-neutral-400" aria-hidden />
        <p className="text-sm font-medium text-neutral-900">
          {t("richText.assetLibrary.empty.title")}
        </p>
        <p className="max-w-sm text-xs">{t("richText.assetLibrary.empty.description")}</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-md border border-neutral-200 [&>div]:max-h-[430px]">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn({
                      "w-11": header.id === "select",
                      "w-40 text-right": header.id === "actions",
                    })}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-testid={RICH_TEXT_HANDLES.assetLibraryRow(row.original.id)}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn("min-w-0 px-3 py-3", {
                      "w-11": cell.column.id === "select",
                      "w-40": cell.column.id === "actions",
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
    </TooltipProvider>
  );
};
