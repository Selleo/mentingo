import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { AutomationActionsMenu } from "./AutomationActionsMenu";
import { StatusBadge } from "./StatusBadge";

import type { AutomationDto } from "@repo/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

type AutomationsTableColumnsOptions = {
  t: TFunction;
  language: string;
};

export const getAutomationsTableColumns = ({
  t,
  language,
}: AutomationsTableColumnsOptions): ColumnDef<AutomationDto>[] => [
  {
    accessorKey: "name",
    header: t("automationView.table.name"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 text-sm">
        <span className="shrink-0 font-medium text-neutral-950">{row.original.name}</span>
        {row.original.description?.trim() && (
          <>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <span className="line-clamp-1 text-muted-foreground">{row.original.description}</span>
          </>
        )}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: t("automationView.table.status"),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "updatedAt",
    header: t("automationView.table.updatedAt"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {formatLocalizedDate(language, row.original.updatedAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{t("automationView.table.menu")}</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <AutomationActionsMenu automation={row.original} />
      </div>
    ),
  },
];
