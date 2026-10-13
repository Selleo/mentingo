import { useNavigate, useSearchParams } from "@remix-run/react";
import { Archive, Copy, MoreVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useArchiveEmailTemplate } from "~/api/mutations/emailTemplates/useArchiveEmailTemplate";
import { useCopyDefaultEmailTemplate } from "~/api/mutations/emailTemplates/useCopyDefaultEmailTemplate";
import { useDeleteEmailTemplate } from "~/api/mutations/emailTemplates/useDeleteEmailTemplate";
import { useDuplicateEmailTemplate } from "~/api/mutations/emailTemplates/useDuplicateEmailTemplate";
import { useRestoreEmailTemplate } from "~/api/mutations/emailTemplates/useRestoreEmailTemplate";
import { useEmailTemplates } from "~/api/queries/useEmailTemplates";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { PageWrapper } from "~/components/PageWrapper";
import { ITEMS_PER_PAGE_OPTIONS, Pagination } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../e2e/data/email-templates/handles";

import { CreateEmailTemplateDialog } from "./components/CreateEmailTemplateDialog";
import { EmailTemplateConfirmation } from "./components/EmailTemplateConfirmation";
import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_SOURCES,
  EMAIL_TEMPLATE_STATUSES,
  EMAIL_TEMPLATE_LIST_PATH,
  EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS,
} from "./emailTemplates.constants";
import { getLocalizedTemplateName } from "./emailTemplates.utils";

import type { EmailTemplate, EmailTemplateListConfirmation } from "./emailTemplates.types";

export default function EmailTemplatesPage() {
  const { t } = useTranslation();

  return (
    <PageWrapper
      breadcrumbs={[{ title: t("emailTemplates.ui.title"), href: EMAIL_TEMPLATE_LIST_PATH }]}
    >
      <EmailTemplatesContent />
    </PageWrapper>
  );
}

const menuItemClassName =
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

const destructiveMenuItemClassName = cn(
  menuItemClassName,
  "text-error-700 focus:bg-error-50 focus:text-error-700",
);

export function EmailTemplatesContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const language = useLanguageStore((state) => state.language);
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedPage = Number(searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const perPage =
    ITEMS_PER_PAGE_OPTIONS.find((size) => size === Number(searchParams.get("perPage"))) ?? 10;

  const [pendingConfirmation, setPendingConfirmation] =
    useState<EmailTemplateListConfirmation | null>(null);
  const { data, isPending, isError } = useEmailTemplates(
    page,
    perPage,
    searchParams.get("search") ?? "",
  );
  const { mutateAsync: copyDefaultTemplate, isPending: isCopying } = useCopyDefaultEmailTemplate();
  const { mutateAsync: duplicateTemplate, isPending: isDuplicating } = useDuplicateEmailTemplate();
  const { mutateAsync: deleteTemplate, isPending: isDeleting } = useDeleteEmailTemplate();
  const { mutateAsync: archiveTemplate, isPending: isArchiving } = useArchiveEmailTemplate();
  const { mutateAsync: restoreTemplate, isPending: isRestoring } = useRestoreEmailTemplate();

  const [isCreationOpen, setIsCreationOpen] = useState(false);

  const isActionPending = isCopying || isDuplicating || isArchiving || isRestoring || isDeleting;

  const handlePaginationChange = (newPage: number, size = perPage) =>
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("page", String(newPage));
      nextParams.set("perPage", String(size));
      return nextParams;
    });

  const openEmailTemplate = (template: EmailTemplate) => {
    const editorPath = template.id
      ? `${EMAIL_TEMPLATE_LIST_PATH}/${template.id}`
      : `${EMAIL_TEMPLATE_LIST_PATH}/defaults/${template.event}`;

    navigate(editorPath);
  };

  if (isError)
    return (
      <ErrorPage
        title={t("emailTemplates.ui.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="h4">{t("emailTemplates.ui.title")}</h4>
            <p className="mt-2 text-sm text-neutral-600">{t("emailTemplates.ui.description")}</p>
          </div>
          <Button
            variant="primary"
            disabled={isActionPending}
            onClick={() => setIsCreationOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            {t("emailTemplates.ui.create")}
          </Button>
        </div>
        <SearchInput
          value={searchParams.get("search") ?? ""}
          onChange={(event) => {
            const search = event.target.value;
            setSearchParams(
              (current) => {
                const next = new URLSearchParams(current);
                if (search) next.set("search", search);
                else next.delete("search");
                next.set("page", "1");
                return next;
              },
              { replace: true },
            );
          }}
          maxLength={200}
          placeholder={t("emailTemplates.ui.searchTemplates")}
          aria-label={t("emailTemplates.ui.searchTemplates")}
          wrapperClassName="w-full sm:max-w-xs"
        />
        <div className="flex flex-col">
          <Table className="border bg-neutral-50" data-testid={EMAIL_TEMPLATES_HANDLES.TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("emailTemplates.ui.name")}</TableHead>
                <TableHead>{t("emailTemplates.ui.subject")}</TableHead>
                <TableHead className="w-40">{t("emailTemplates.ui.status")}</TableHead>
                <TableHead className="w-48">{t("emailTemplates.ui.lastUpdated")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("emailTemplates.ui.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    {t("emailTemplates.ui.loading")}
                  </TableCell>
                </TableRow>
              )}
              {data?.data.map((template) => (
                <TableRow
                  key={template.id ?? template.event}
                  className="cursor-pointer hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  tabIndex={0}
                  onClick={() => openEmailTemplate(template)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && event.key === "Enter") {
                      openEmailTemplate(template);
                    }
                  }}
                  data-testid={EMAIL_TEMPLATES_HANDLES.ROW(
                    template.id ?? template.event ?? "builtin",
                  )}
                >
                  <TableCell>
                    <span className="text-sm font-normal">
                      {getLocalizedTemplateName(template, language)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    <span className="line-clamp-2 break-words">
                      {template.subject[language]?.trim() ||
                        template.subject[template.baseLanguage]?.trim() ||
                        "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS[
                          template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM
                        ]
                      }
                      className="w-fit"
                    >
                      {t(`emailTemplates.ui.${template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {template.updatedAt ? (
                      <time dateTime={template.updatedAt}>
                        {formatLocalizedDate(language, template.updatedAt)}
                      </time>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
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
                        {template.source === EMAIL_TEMPLATE_SOURCES.DEFAULT ? (
                          <DropdownMenuItem
                            className={menuItemClassName}
                            disabled={isActionPending}
                            onSelect={() =>
                              void (
                                template.event
                                  ? copyDefaultTemplate(template.event)
                                  : Promise.reject(new Error("Missing built-in template key"))
                              )
                                .then((copied) =>
                                  navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${copied.id}`),
                                )
                                .catch(() => undefined)
                            }
                          >
                            <Copy className="size-4" />
                            {t("emailTemplates.ui.copyDefault")}
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem
                              className={menuItemClassName}
                              disabled={isActionPending}
                              onSelect={() =>
                                void duplicateTemplate(template.id!)
                                  .then((copied) =>
                                    navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${copied.id}`),
                                  )
                                  .catch(() => undefined)
                              }
                            >
                              <Copy className="size-4" />
                              {t("emailTemplates.ui.duplicate")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {template.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED ? (
                              <DropdownMenuItem
                                className={menuItemClassName}
                                disabled={isActionPending}
                                onSelect={() =>
                                  void restoreTemplate(template.id!).catch(() => undefined)
                                }
                              >
                                <RotateCcw className="size-4" />
                                {t("emailTemplates.ui.restore")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className={destructiveMenuItemClassName}
                                disabled={isActionPending}
                                onSelect={() =>
                                  setPendingConfirmation({
                                    templateId: template.id!,
                                    action: EMAIL_TEMPLATE_ACTIONS.ARCHIVE,
                                  })
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
                                setPendingConfirmation({
                                  templateId: template.id!,
                                  action: EMAIL_TEMPLATE_ACTIONS.DELETE,
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                              {t("emailTemplates.ui.delete")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isPending && !isError && !data?.data.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    {t("emailTemplates.ui.emptyList")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            className="rounded-b-lg border-b border-x bg-neutral-50"
            emptyDataClassName="rounded-b-lg border-b border-x bg-neutral-50"
            totalItems={data?.pagination.totalItems}
            currentPage={page}
            itemsPerPage={perPage}
            onPageChange={(value) => handlePaginationChange(value)}
            onItemsPerPageChange={(value) =>
              handlePaginationChange(1, Number(value) as typeof perPage)
            }
          />
        </div>
      </div>
      {isCreationOpen && <CreateEmailTemplateDialog onClose={() => setIsCreationOpen(false)} />}
      <EmailTemplateConfirmation
        action={pendingConfirmation?.action ?? null}
        isActionPending={isArchiving || isDeleting}
        onClose={() => setPendingConfirmation(null)}
        onConfirm={() => {
          if (!pendingConfirmation) return;

          const handleAction =
            pendingConfirmation.action === EMAIL_TEMPLATE_ACTIONS.DELETE
              ? deleteTemplate
              : archiveTemplate;

          void handleAction(pendingConfirmation.templateId)
            .then(() => setPendingConfirmation(null))
            .catch(() => undefined);
        }}
      />
    </>
  );
}
