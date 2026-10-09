import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { TableCell, TableRow } from "~/components/ui/table";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { AutomationActionsMenu } from "./AutomationActionsMenu";
import { StatusBadge } from "./StatusBadge";

import type { AutomationDto } from "@repo/shared";
import type { FC } from "react";

interface AutomationRowProps {
  automation: AutomationDto;
}

export const AutomationRow: FC<AutomationRowProps> = ({ automation }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const openAutomation = () => navigate(`/admin/automations/${automation.id}`);

  return (
    <TableRow
      data-testid={`automation-page-row-${automation.id}`}
      className="cursor-pointer hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      tabIndex={0}
      onClick={openAutomation}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && event.key === "Enter") openAutomation();
      }}
    >
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <span className="shrink-0 font-normal">{automation.name}</span>
          {automation.description?.trim() && (
            <>
              <span className="text-muted-foreground" aria-hidden="true">
                ·
              </span>
              <span className="line-clamp-1 text-muted-foreground">{automation.description}</span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={automation.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatLocalizedDate(i18n.language, automation.updatedAt)}
      </TableCell>
      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
        <AutomationActionsMenu automation={automation} />
      </TableCell>
    </TableRow>
  );
};
