import { RevokeIntegrationApiKeyDialog } from "./RevokeIntegrationApiKeyDialog";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { GetKeysResponse } from "~/api/generated-api";

export type IntegrationApiKeyRow = GetKeysResponse["data"][number];

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(undefined, DATE_TIME_FORMAT);
}

export const getIntegrationApiKeysColumns = (t: TFunction): ColumnDef<IntegrationApiKeyRow>[] => [
  {
    id: "key",
    header: t("integrationApiKey.table.key"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-neutral-950">{row.original.name}</span>
        <code className="details rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-800">
          {row.original.keyPrefix}…
        </code>
      </div>
    ),
  },
  {
    id: "created",
    header: t("integrationApiKey.table.created"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        <span className="text-neutral-900">{formatDateTime(row.original.createdAt)}</span>
        <span className="details ml-2 text-neutral-700">
          {t("integrationApiKey.table.createdBy", { email: row.original.createdBy.email })}
        </span>
      </span>
    ),
  },
  {
    id: "lastUsedAt",
    header: t("integrationApiKey.table.lastUsedAt"),
    cell: ({ row }) => {
      const { lastUsedAt } = row.original;

      if (!lastUsedAt) return <span className="text-neutral-500">-</span>;

      return (
        <span className="whitespace-nowrap text-neutral-900">{formatDateTime(lastUsedAt)}</span>
      );
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{t("integrationApiKey.table.actions")}</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <RevokeIntegrationApiKeyDialog apiKey={row.original} />
      </div>
    ),
  },
];
