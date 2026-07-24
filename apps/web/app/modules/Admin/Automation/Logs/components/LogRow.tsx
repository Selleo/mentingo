import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TableCell, TableRow } from "~/components/ui/table";

import { LogStatusBadge } from "./LogStatusBadge";

import type { AutomationLogEntry } from "../automationLogs.types";
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
        <LogStatusBadge status={log.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {log.emailAddresses.length} {t("automationLogs.table.recipients")}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(log.ranAt)}</TableCell>
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
