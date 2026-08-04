import { useNavigate } from "@remix-run/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAutomationLogs } from "~/api/queries/admin/useAutomationLogs";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { LogDetailContent } from "./components/LogDetailContent";
import { LogsFilters } from "./components/LogsFilters";
import { LogsTable } from "./components/LogsTable";

import type { AutomationLogEntry, AutomationLogRecord, LogStatusFilter } from "./automationLogs.types";

function recordToEntry(record: AutomationLogRecord): AutomationLogEntry {
  return {
    id: record.id,
    automationName: record.automationName,
    automationId: record.automationId,
    ranAt: record.createdAt,
    triggerEvent: record.eventName,
    status: record.status,
    errorName: record.errorName,
    emailAddresses: record.emailAddresses,
  };
}

export default function AutomationLogsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: logRecords = [], isLoading } = useAutomationLogs();

  const [selectedLog, setSelectedLog] = useState<AutomationLogEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<LogStatusFilter>("All");

  const logs = logRecords.map(recordToEntry);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.automationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.triggerEvent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.emailAddresses.some((email) =>
        email.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesStatus = statusFilter === "All" || log.status === statusFilter;

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
          <LogsTable logs={filteredLogs} onOpenDetail={setSelectedLog} />
        </div>
      )}

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
