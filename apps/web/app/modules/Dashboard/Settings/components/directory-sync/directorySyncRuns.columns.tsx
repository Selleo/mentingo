import { Badge } from "~/components/ui/badge";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { getRunChangeCounts, getRunStatusBadgeVariant } from "./directorySync.utils";

import type { DirectorySyncRun } from "./directorySync.types";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export const getDirectorySyncRunsColumns = (
  t: TFunction,
  language: string,
): ColumnDef<DirectorySyncRun>[] => [
  {
    id: "startedAt",
    header: t("directorySync.runs.startedAt"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-medium text-neutral-950">
        {formatLocalizedDate(language, row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "trigger",
    header: t("directorySync.runs.trigger"),
    cell: ({ row }) => (
      <span className="text-neutral-800">
        {t(`directorySync.runs.triggers.${row.original.trigger}`)}
      </span>
    ),
  },
  {
    id: "status",
    header: t("directorySync.runs.status"),
    cell: ({ row }) => (
      <Badge variant={getRunStatusBadgeVariant(row.original.status)} className="w-fit">
        {t(`directorySync.runs.statuses.${row.original.status}`)}
      </Badge>
    ),
  },
  {
    id: "changes",
    header: t("directorySync.runs.changes"),
    cell: ({ row }) => {
      const changes = getRunChangeCounts(row.original).filter(({ count }) => count > 0);

      if (!changes.length) {
        return <span className="text-neutral-600">{t("directorySync.runs.noChanges")}</span>;
      }

      return (
        <div className="flex flex-wrap gap-1.5">
          {changes.map(({ key, count }) => (
            <span
              key={key}
              className="details rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-800"
            >
              {t(`directorySync.runs.counts.${key}`, { count })}
            </span>
          ))}
        </div>
      );
    },
  },
];
