import { useNavigate } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { MOCK_AUTOMATION_LOGS } from "./automationLogs.mock";
import { LogDetailContent } from "./components/LogDetailContent";
import { LogsFilters } from "./components/LogsFilters";
import { LogsTable } from "./components/LogsTable";

import type { AutomationLogEntry, EmailStatus, LogStatusFilter } from "./automationLogs.types";

function getOverallStatus(log: AutomationLogEntry): EmailStatus {
  const failedCount = log.emails.filter((e) => e.status === "failed").length;
  const skippedCount = log.emails.filter((e) => e.status === "skipped").length;
  const sentCount = log.emails.filter((e) => e.status === "sent").length;

  return match({ failedCount, skippedCount, sentCount })
    .when(({ failedCount }) => failedCount > 0, () => "failed" as const)
    .when(({ skippedCount, sentCount }) => skippedCount > 0 && sentCount === 0, () => "skipped" as const)
    .otherwise(() => "sent" as const);
}

export default function AutomationLogsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedLog, setSelectedLog] = useState<AutomationLogEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<LogStatusFilter>("All");

  const filteredLogs = MOCK_AUTOMATION_LOGS.filter((log) => {
    const matchesSearch =
      log.automationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.triggerEvent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.emails.some(
        (e) =>
          e.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesStatus =
      statusFilter === "All" || getOverallStatus(log) === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/automation")}>
          <ArrowLeft className="mr-2 size-4" />
          {t("automationLogs.backToAutomations")}
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("automationLogs.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("automationLogs.description")}</p>
      </div>

      <LogsFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
        <LogsTable logs={filteredLogs} onOpenDetail={setSelectedLog} />
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("automationLogs.detail.title")}</DialogTitle>
            <DialogDescription>{t("automationLogs.detail.description")}</DialogDescription>
          </DialogHeader>
          {selectedLog && <LogDetailContent log={selectedLog} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
