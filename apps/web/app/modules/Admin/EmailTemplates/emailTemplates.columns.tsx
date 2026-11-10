import { Archive, Copy, MoreVertical, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../e2e/data/email-templates/handles";

import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_SOURCES,
  EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS,
  EMAIL_TEMPLATE_STATUSES,
} from "./emailTemplates.constants";
import { getLocalizedTemplateName } from "./emailTemplates.utils";

import type { EmailTemplate, EmailTemplateListConfirmation } from "./emailTemplates.types";
import type { SupportedLanguages } from "@repo/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

type EmailTemplateRowActions = {
  isActionPending: boolean;
  copyDefaultTemplate: (event: NonNullable<EmailTemplate["event"]>) => void;
  duplicateTemplate: (templateId: string) => void;
  restoreTemplate: (templateId: string) => void;
  requestConfirmation: (confirmation: EmailTemplateListConfirmation) => void;
};

type EmailTemplateColumnsOptions = EmailTemplateRowActions & {
  t: TFunction;
  language: SupportedLanguages;
};

type EmailTemplateActionsMenuProps = EmailTemplateRowActions & {
  t: TFunction;
  template: EmailTemplate;
};

const menuItemClassName =
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

const destructiveMenuItemClassName = cn(
  menuItemClassName,
  "text-error-700 focus:bg-error-50 focus:text-error-700",
);

function EmailTemplateActionsMenu({
  t,
  template,
  isActionPending,
  copyDefaultTemplate,
  duplicateTemplate,
  restoreTemplate,
  requestConfirmation,
}: EmailTemplateActionsMenuProps) {
  const templateId = template.id;
  const templateEvent = template.event;
  const isDefaultTemplate = template.source === EMAIL_TEMPLATE_SOURCES.DEFAULT;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isActionPending}
          data-testid={EMAIL_TEMPLATES_HANDLES.ACTIONS}
          aria-label={t("emailTemplates.ui.actions")}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 space-y-1 p-2">
        {isDefaultTemplate && templateEvent && (
          <DropdownMenuItem
            className={menuItemClassName}
            disabled={isActionPending}
            onSelect={() => copyDefaultTemplate(templateEvent)}
          >
            <Copy className="size-4" />
            {t("emailTemplates.ui.copyDefault")}
          </DropdownMenuItem>
        )}
        {!isDefaultTemplate && templateId && (
          <>
            <DropdownMenuItem
              className={menuItemClassName}
              disabled={isActionPending}
              onSelect={() => duplicateTemplate(templateId)}
            >
              <Copy className="size-4" />
              {t("emailTemplates.ui.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {template.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED ? (
              <DropdownMenuItem
                className={menuItemClassName}
                disabled={isActionPending}
                onSelect={() => restoreTemplate(templateId)}
              >
                <RotateCcw className="size-4" />
                {t("emailTemplates.ui.restore")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className={destructiveMenuItemClassName}
                disabled={isActionPending}
                onSelect={() =>
                  requestConfirmation({ templateId, action: EMAIL_TEMPLATE_ACTIONS.ARCHIVE })
                }
              >
                <Archive className="size-4" />
                {t("emailTemplates.ui.archive")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className={destructiveMenuItemClassName}
              disabled={isActionPending}
              data-testid={EMAIL_TEMPLATES_HANDLES.DELETE}
              onSelect={() =>
                requestConfirmation({ templateId, action: EMAIL_TEMPLATE_ACTIONS.DELETE })
              }
            >
              <Trash2 className="size-4" />
              {t("emailTemplates.ui.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const getEmailTemplateColumns = ({
  t,
  language,
  ...rowActions
}: EmailTemplateColumnsOptions): ColumnDef<EmailTemplate>[] => [
  {
    id: "name",
    header: t("emailTemplates.ui.name"),
    cell: ({ row }) => (
      <span className="text-sm font-medium text-neutral-950">
        {getLocalizedTemplateName(row.original, language)}
      </span>
    ),
  },
  {
    id: "subject",
    header: t("emailTemplates.ui.subject"),
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-xs break-words text-sm text-neutral-700">
        {row.original.subject[language]?.trim() ||
          row.original.subject[row.original.baseLanguage]?.trim() ||
          "—"}
      </span>
    ),
  },
  {
    id: "status",
    header: t("emailTemplates.ui.status"),
    cell: ({ row }) => {
      const status = row.original.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM;

      return (
        <Badge variant={EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS[status]} className="w-fit">
          {t(`emailTemplates.ui.${status}`)}
        </Badge>
      );
    },
  },
  {
    id: "updatedAt",
    header: t("emailTemplates.ui.lastUpdated"),
    cell: ({ row }) =>
      row.original.updatedAt ? (
        <time
          dateTime={row.original.updatedAt}
          className="whitespace-nowrap text-sm text-neutral-700"
        >
          {formatLocalizedDate(language, row.original.updatedAt)}
        </time>
      ) : (
        "—"
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{t("emailTemplates.ui.actions")}</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <EmailTemplateActionsMenu t={t} template={row.original} {...rowActions} />
      </div>
    ),
  },
];
