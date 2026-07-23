import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TableCell, TableRow } from "~/components/ui/table";

import { LogStatusBadge } from "./LogStatusBadge";

import type { AutomationLogEntry, EmailStatus } from "../automationLogs.types";
import type { FC } from "react";

interface LogRowProps {
  log: AutomationLogEntry;
  onOpenDetail: (log: AutomationLogEntry) => void;
}

export const LogRow: FC<LogRowProps> = ({ log, onOpenDetail }) => {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  const sentCount = log.emails.filter((e) => e.status === "sent").length;
  const skippedCount = log.emails.filter((e) => e.status === "skipped").length;
  const failedCount = log.emails.filter((e) => e.status === "failed").length;

  const overallStatus: EmailStatus = match({ failedCount, skippedCount, sentCount })
    .when(({ failedCount }) => failedCount > 0, () => "failed" as const)
    .when(({ skippedCount, sentCount }) => skippedCount > 0 && sentCount === 0, () => "skipped" as const)
    .otherwise(() => "sent" as const);

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{log.automationName}</span>
          <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {log.triggerEvent}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <LogStatusBadge status={overallStatus} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {sentCount > 0 && (
            <Badge variant="success" className="text-xs">
              {sentCount} {t("automationLogs.status.sent").toLowerCase()}
            </Badge>
          )}
          {skippedCount > 0 && (
            <Badge variant="inProgress" className="text-xs">
              {skippedCount} {t("automationLogs.status.skipped").toLowerCase()}
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {failedCount} {t("automationLogs.status.failed").toLowerCase()}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(log.ranAt)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{log.duration}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onOpenDetail(log)}
        >
          <Eye className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};
