import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDirectorySyncRuns } from "~/api/queries/admin/useDirectorySyncRuns";
import {
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
} from "~/components/DataTable";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { DIRECTORY_SYNC_RUNS_PAGE_SIZE } from "./directorySync.constants";
import { getDirectorySyncRunsColumns } from "./directorySyncRuns.columns";

import type { DirectorySyncProvider } from "@repo/shared";

type DirectorySyncRunHistoryProps = {
  provider: DirectorySyncProvider;
};

export function DirectorySyncRunHistory({ provider }: DirectorySyncRunHistoryProps) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const { data: runsPage, isFetching } = useDirectorySyncRuns(
    provider,
    page,
    DIRECTORY_SYNC_RUNS_PAGE_SIZE,
    true,
  );

  const columns = useMemo(() => getDirectorySyncRunsColumns(t, i18n.language), [t, i18n.language]);
  const table = useReactTable({
    data: runsPage?.data ?? [],
    columns,
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalItems = runsPage?.pagination.totalItems ?? 0;

  return (
    <DataTableCard className="[&>div:first-child]:border-t-0">
      <DataTable
        table={table}
        testId={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_RUNS_TABLE}
        isRefreshing={isFetching && Boolean(runsPage)}
        emptyState={
          <DataTableEmptyState
            title={t("directorySync.runs.empty")}
            description={t("directorySync.runs.emptyDescription")}
          />
        }
      />
      {totalItems > DIRECTORY_SYNC_RUNS_PAGE_SIZE && (
        <DataTablePagination
          totalItems={totalItems}
          itemsPerPage={DIRECTORY_SYNC_RUNS_PAGE_SIZE}
          currentPage={page}
          onPageChange={setPage}
        />
      )}
    </DataTableCard>
  );
}
