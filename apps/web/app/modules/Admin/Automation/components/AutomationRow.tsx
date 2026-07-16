import { Mail, CheckCircle, AlertTriangle, HelpCircle, MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TableCell, TableRow } from "~/components/ui/table";

import { StatusBadge } from "./StatusBadge";

import type { Automation } from "../Automation.page";
import type { FC } from "react";

interface AutomationRowProps {
  automation: Automation;
  onOpenDrawer: (automation: Automation) => void;
}

export const AutomationRow: FC<AutomationRowProps> = ({ automation, onOpenDrawer }) => {
  const { t } = useTranslation();

  const renderLastRun = () => {
    const { date, status } = automation.lastRun;
    if (status === "never") {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <HelpCircle className="size-4 text-neutral-300" />
          {t("automationView.table.noRuns")}
        </span>
      );
    }

    const isSuccess = status === "success";
    return (
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          {isSuccess ? (
            <CheckCircle className="size-4 text-success-500" />
          ) : (
            <AlertTriangle className="size-4 text-error-500" />
          )}
          {date}
        </span>
        <span className="pl-5.5 text-xs text-muted-foreground">
          {isSuccess ? t("automationView.table.runSuccess") : t("automationView.table.runFailed")}
        </span>
      </div>
    );
  };

  return (
    <TableRow>
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
      <TableCell>
        <Badge variant="default" className="font-mono text-xs">
          {automation.trigger}
        </Badge>
      </TableCell>
      <TableCell className="min-w-[160px] text-center">
        <Badge variant="inProgressFilled" className="gap-1 whitespace-nowrap">
          <Mail className="size-3" />
          {t("automationView.table.emailCount", { count: automation.actionsCount })}
        </Badge>
      </TableCell>
      <TableCell>{renderLastRun()}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{automation.updatedAt}</TableCell>
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
