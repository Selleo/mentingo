import { format } from "date-fns";

import { Icon } from "~/components/Icon";
import { languageOptions } from "~/components/LanguageSelector/languageOptions";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import type { EmailTemplateStatus } from "@repo/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { Dispatch, SetStateAction } from "react";
import type { ListTemplatesResponse } from "~/api/generated-api";

export type EmailTemplateRow = ListTemplatesResponse["data"][number];

type GetEmailTemplatesColumnsOptions = {
  lastSelectedRowIndex: number;
  setLastSelectedRowIndex: Dispatch<SetStateAction<number>>;
  t: TFunction;
};

const StatusBadge = ({ status, t }: { status: EmailTemplateStatus; t: TFunction }) => {
  const label = t(`emailTemplates.status.${status}`);

  if (status === "published") {
    return (
      <Badge variant="secondary" className="w-max">
        {label}
      </Badge>
    );
  }
  if (status === "draft") {
    return (
      <Badge variant="default" className="w-max">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="w-max">
      {label}
    </Badge>
  );
};

export const getEmailTemplatesColumns = ({
  lastSelectedRowIndex,
  setLastSelectedRowIndex,
  t,
}: GetEmailTemplatesColumnsOptions): ColumnDef<EmailTemplateRow>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label={t("emailTemplates.list.columns.selectAll")}
      />
    ),
    cell: ({ row, table }) => (
      <Checkbox
        checked={row.getIsSelected()}
        aria-label={t("emailTemplates.list.columns.selectRow")}
        onClick={(event) => {
          event.stopPropagation();
          handleRowSelectionRange({
            table,
            event,
            lastSelectedRowIndex,
            setLastSelectedRowIndex,
            id: row.id,
            idx: row.index,
            value: row.getIsSelected(),
          });
        }}
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortButton<EmailTemplateRow> column={column}>
        {t("emailTemplates.list.columns.name")}
      </SortButton>
    ),
    cell: ({ row }) => <div className="max-w-md truncate font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortButton<EmailTemplateRow> column={column}>
        {t("emailTemplates.list.columns.status")}
      </SortButton>
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} t={t} />,
  },
  {
    accessorKey: "availableLocales",
    header: t("emailTemplates.list.columns.languages"),
    enableSorting: false,
    cell: ({ row }) => {
      const { baseLanguage, availableLocales } = row.original;
      const sortedLocales = [...availableLocales].sort((a, b) => {
        if (a === baseLanguage) return -1;
        if (b === baseLanguage) return 1;
        return 0;
      });
      return (
        <div className="flex flex-wrap items-center gap-2">
          {sortedLocales.map((locale) => {
            const option = languageOptions.find((item) => item.key === locale);
            if (!option) return null;
            const isBase = locale === baseLanguage;
            const label = t(option.translationKey);
            return isBase ? (
              <Badge
                key={locale}
                variant="secondary"
                title={`${label} (${t("emailTemplates.language.baseLanguage")})`}
              >
                <Icon name={option.iconName} className="size-5" aria-label={label} />
              </Badge>
            ) : (
              <Icon key={locale} name={option.iconName} className="size-5" aria-label={label} />
            );
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <SortButton<EmailTemplateRow> column={column}>
        {t("emailTemplates.list.columns.updatedAt")}
      </SortButton>
    ),
    cell: ({ row }) => row.original.updatedAt && format(new Date(row.original.updatedAt), "PPpp"),
  },
];
