import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAutomationRuns } from "~/api/queries/useAutomationRuns";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { Pagination } from "~/components/Pagination/Pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { AutomationRunDetail } from "./Runs/components/AutomationRunDetail";
import { AutomationRunsFilters } from "./Runs/components/AutomationRunsFilters";
import { AutomationRunsTable } from "./Runs/components/AutomationRunsTable";

import type { AutomationRunStatus } from "@repo/shared";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

export default function AutomationLogsContent() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AutomationRunStatus | undefined>();
  const [selectedAutomationRunId, setSelectedAutomationRunId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<ItemsPerPageOption>(10);
  const { data, isPending, isError } = useAutomationRuns({
    page,
    perPage,
    status,
    search,
  });

  if (isError)
    return (
      <ErrorPage
        title={t("automations.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="h4">{t("automationLogs.title")}</h4>
          <p className="mt-2 text-sm text-neutral-600">{t("automationLogs.description")}</p>
        </div>
      </div>
      <AutomationRunsFilters
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        status={status}
        onStatus={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      <div>
        <AutomationRunsTable
          runs={data?.data ?? []}
          loading={isPending}
          onOpenDetail={setSelectedAutomationRunId}
        />
        {!isPending && (data?.pagination.totalItems ?? 0) > 0 && (
          <Pagination
            className="rounded-b-lg border-x border-b bg-neutral-50"
            totalItems={data?.pagination.totalItems}
            currentPage={page}
            itemsPerPage={perPage}
            onPageChange={setPage}
            onItemsPerPageChange={(value) => {
              setPerPage(Number(value) as ItemsPerPageOption);
              setPage(1);
            }}
          />
        )}
      </div>
      <Dialog
        open={Boolean(selectedAutomationRunId)}
        onOpenChange={(open) => {
          if (!open) setSelectedAutomationRunId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("automationLogs.detail.title")}</DialogTitle>
            <DialogDescription>{t("automationLogs.detail.description")}</DialogDescription>
          </DialogHeader>
          {selectedAutomationRunId && (
            <AutomationRunDetail automationRunId={selectedAutomationRunId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
