import { Eye } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { AutomationRunStatusBadge } from "./AutomationRunStatusBadge";

import type { AutomationRunSummary } from "@repo/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

type AutomationRunsTableColumnsOptions = {
  t: TFunction;
  language: string;
  onOpenDetail: (automationRunId: string) => void;
};

export const getAutomationRunsTableColumns = ({
  t,
  language,
  onOpenDetail,
}: AutomationRunsTableColumnsOptions): ColumnDef<AutomationRunSummary>[] => [
  {
    accessorKey: "automationName",
    header: t("automationLogs.table.automation"),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-950">{row.original.automationName}</span>
        <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {t(`emailTemplates.events.${row.original.eventKind}`, {
            defaultValue: row.original.eventKind,
          })}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: t("automationLogs.table.status"),
    cell: ({ row }) => <AutomationRunStatusBadge status={row.original.status} />,
  },
  {
    id: "emails",
    header: t("automationLogs.table.emails"),
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {row.original.emailAddresses.length} {t("automationLogs.table.recipients")}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: t("automationLogs.table.ranAt"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {formatLocalizedDate(language, row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "detail",
    header: () => <span className="sr-only">{t("automationLogs.detail.title")}</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onOpenDetail(row.original.id)}
        >
          <Eye className="size-4" aria-hidden />
          <span className="sr-only">{t("automationLogs.table.details")}</span>
        </Button>
      </div>
    ),
  },
];
