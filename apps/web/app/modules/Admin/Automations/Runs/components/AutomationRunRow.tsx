import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TableCell, TableRow } from "~/components/ui/table";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { AutomationRunStatusBadge } from "./AutomationRunStatusBadge";

import type { AutomationRunSummary } from "@repo/shared";
import type { FC } from "react";

interface AutomationRunRowProps {
  run: AutomationRunSummary;
  onOpenDetail: (automationRunId: string) => void;
}

export const AutomationRunRow: FC<AutomationRunRowProps> = ({ run, onOpenDetail }) => {
  const { t, i18n } = useTranslation();

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{run.automationName}</span>
          <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {t(`emailTemplates.events.${run.eventKind}`, { defaultValue: run.eventKind })}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <AutomationRunStatusBadge status={run.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {run.emailAddresses.length} {t("automationLogs.table.recipients")}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatLocalizedDate(i18n.language, run.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onOpenDetail(run.id)}>
          <Eye className="size-4" />
          <span className="sr-only">{t("automationLogs.table.details")}</span>
        </Button>
      </TableCell>
    </TableRow>
  );
};
