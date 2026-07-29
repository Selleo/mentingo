import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { TableCell, TableRow } from "~/components/ui/table";

import { StatusBadge } from "./StatusBadge";

import type { FC } from "react";
import type { AutomationListItem } from "~/api/queries/admin/automation.types";

interface AutomationRowProps {
  automation: AutomationListItem;
  onOpenDrawer: (automation: AutomationListItem) => void;
}

export const AutomationRow: FC<AutomationRowProps> = ({ automation, onOpenDrawer }) => {
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
    <TableRow data-testid={`automation-page-row-${automation.id}`}>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{automation.name}</span>
          <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {automation.description}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={automation.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {automation.lastRun ? formatDate(automation.lastRun) : t("automationView.table.noRuns")}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(automation.updatedAt)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onOpenDrawer(automation)}
        >
          <MoreVertical className="size-4" />
          <span className="sr-only">{t("automationView.table.manage")}</span>
        </Button>
      </TableCell>
    </TableRow>
  );
};
