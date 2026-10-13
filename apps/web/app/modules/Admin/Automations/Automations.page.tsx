import { useNavigate } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAutomations } from "~/api/queries/useAutomations";
import ErrorPage from "~/components/ErrorPage/ErrorPage";

import { AutomationFilters } from "./components/AutomationFilters";
import { AutomationHeader } from "./components/AutomationHeader";
import { AutomationTable } from "./components/AutomationTable";

import type { StatusFilter } from "./components/AutomationFilters";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

export default function AutomationsContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<ItemsPerPageOption>(10);
  const { data, isPending, isError } = useAutomations({
    page,
    perPage,
    search,
    status: status === "All" ? undefined : status,
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
      <AutomationHeader onCreate={() => navigate("/admin/automations/new")} />
      <div>
        <AutomationFilters
          searchTerm={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          statusFilter={status}
          onStatusFilterChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>
      <div>
        <AutomationTable
          automations={data?.data ?? []}
          totalItems={data?.pagination.totalItems}
          page={page}
          perPage={perPage}
          loading={isPending}
          onPage={setPage}
          onPerPage={(value) => {
            setPerPage(Number(value) as ItemsPerPageOption);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
