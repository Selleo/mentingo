import { Link, useNavigate, useSearchParams } from "@remix-run/react";
import { Archive, Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useArchiveEmailTemplate } from "~/api/mutations/emailTemplates/useArchiveEmailTemplate";
import { useCopyDefaultEmailTemplate } from "~/api/mutations/emailTemplates/useCopyDefaultEmailTemplate";
import { useDeleteEmailTemplate } from "~/api/mutations/emailTemplates/useDeleteEmailTemplate";
import { useDuplicateEmailTemplate } from "~/api/mutations/emailTemplates/useDuplicateEmailTemplate";
import { useRestoreEmailTemplate } from "~/api/mutations/emailTemplates/useRestoreEmailTemplate";
import { useEmailTemplates } from "~/api/queries/useEmailTemplates";
import { Icon } from "~/components/Icon";
import { languageOptions } from "~/components/LanguageSelector/languageOptions";
import { PageWrapper } from "~/components/PageWrapper";
import { ITEMS_PER_PAGE_OPTIONS, Pagination } from "~/components/Pagination/Pagination";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../e2e/data/email-templates/handles";

import { EmailTemplateConfirmation } from "./components/EmailTemplateConfirmation";
import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_SOURCES,
  EMAIL_TEMPLATE_STATUSES,
  EMAIL_TEMPLATE_LIST_PATH,
  EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS,
  EMAIL_TEMPLATE_STATUS_BADGE_ICONS,
} from "./emailTemplates.constants";
import { getLocalizedTemplateName } from "./emailTemplates.utils";

import type { EmailTemplateListConfirmation } from "./emailTemplates.types";

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const language = useLanguageStore((state) => state.language);
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedPage = Number(searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const perPage =
    ITEMS_PER_PAGE_OPTIONS.find((size) => size === Number(searchParams.get("perPage"))) ?? 20;

  const [pendingConfirmation, setPendingConfirmation] =
    useState<EmailTemplateListConfirmation | null>(null);
  const { data, isPending, isError, refetch } = useEmailTemplates(page, perPage);
  const { mutateAsync: copyDefaultTemplate, isPending: isCopying } = useCopyDefaultEmailTemplate();
  const { mutateAsync: duplicateTemplate, isPending: isDuplicating } = useDuplicateEmailTemplate();
  const { mutateAsync: deleteTemplate, isPending: isDeleting } = useDeleteEmailTemplate();
  const { mutateAsync: archiveTemplate, isPending: isArchiving } = useArchiveEmailTemplate();
  const { mutateAsync: restoreTemplate, isPending: isRestoring } = useRestoreEmailTemplate();

  const isActionPending = isCopying || isDuplicating || isArchiving || isRestoring || isDeleting;

  const handlePaginationChange = (newPage: number, size = perPage) =>
    setSearchParams({ page: String(newPage), perPage: String(size) });

  return (
    <PageWrapper
      breadcrumbs={[{ title: t("emailTemplates.ui.title"), href: EMAIL_TEMPLATE_LIST_PATH }]}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="h4">{t("emailTemplates.ui.title")}</h4>
            <p className="mt-2 text-sm text-neutral-600">{t("emailTemplates.ui.description")}</p>
          </div>
          <Button asChild variant="primary">
            <Link to={`${EMAIL_TEMPLATE_LIST_PATH}/defaults/welcome`}>
              <Plus className="mr-2 size-4" />
              {t("emailTemplates.ui.create")}
            </Link>
          </Button>
        </div>
        {isError && (
          <div role="alert" className="rounded-lg border p-4">
            {t("emailTemplates.ui.requestFailed")}{" "}
            <Button variant="outline" onClick={() => void refetch()}>
              {t("emailTemplates.ui.retry")}
            </Button>
          </div>
        )}
        <div>
          <Table className="border bg-neutral-50" data-testid={EMAIL_TEMPLATES_HANDLES.TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("emailTemplates.ui.name")}</TableHead>
                <TableHead>{t("emailTemplates.ui.event")}</TableHead>
                <TableHead>{t("emailTemplates.ui.status")}</TableHead>
                <TableHead>{t("emailTemplates.ui.languages")}</TableHead>
                <TableHead className="text-right">{t("emailTemplates.ui.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <TableRow>
                  <TableCell colSpan={5}>{t("emailTemplates.ui.loading")}</TableCell>
                </TableRow>
              )}
              {data?.data.map((template) => (
                <TableRow
                  key={template.id ?? template.event}
                  data-testid={EMAIL_TEMPLATES_HANDLES.ROW(template.id ?? template.event)}
                  className="cursor-pointer hover:bg-neutral-100"
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a, button")) return;

                    navigate(
                      template.id
                        ? `${EMAIL_TEMPLATE_LIST_PATH}/${template.id}`
                        : `${EMAIL_TEMPLATE_LIST_PATH}/defaults/${template.event}`,
                    );
                  }}
                >
                  <TableCell>
                    <Link
                      className="font-medium text-neutral-900 hover:underline"
                      to={
                        template.id
                          ? `${EMAIL_TEMPLATE_LIST_PATH}/${template.id}`
                          : `${EMAIL_TEMPLATE_LIST_PATH}/defaults/${template.event}`
                      }
                    >
                      {getLocalizedTemplateName(template, language)}
                    </Link>
                  </TableCell>
                  <TableCell>{t(`emailTemplates.events.${template.event}`)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS[
                          template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM
                        ]
                      }
                      fontWeight="bold"
                      icon={
                        EMAIL_TEMPLATE_STATUS_BADGE_ICONS[
                          template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM
                        ]
                      }
                      iconClasses="size-4"
                      className="w-fit"
                    >
                      {t(`emailTemplates.ui.${template.status ?? EMAIL_TEMPLATE_STATUSES.SYSTEM}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {template.completeLocales.map((locale) => {
                        const option = languageOptions.find((language) => language.key === locale);
                        if (!option) return null;

                        return (
                          <span key={locale} title={t(option.translationKey)}>
                            <Icon
                              name={option.iconName}
                              className="h-auto w-6"
                              role="img"
                              aria-label={t(option.translationKey)}
                            />
                          </span>
                        );
                      })}
                      {!template.completeLocales.length && "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {template.source === EMAIL_TEMPLATE_SOURCES.DEFAULT ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("emailTemplates.ui.copyDefault")}
                          title={t("emailTemplates.ui.copyDefault")}
                          disabled={isActionPending}
                          onClick={() =>
                            void copyDefaultTemplate(template.event)
                              .then((copied) =>
                                navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${copied.id}`),
                              )
                              .catch(() => undefined)
                          }
                        >
                          <Copy className="size-4" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isActionPending}
                            aria-label={t("emailTemplates.ui.duplicate")}
                            onClick={() =>
                              void duplicateTemplate(template.id!)
                                .then((copied) =>
                                  navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${copied.id}`),
                                )
                                .catch(() => undefined)
                            }
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isActionPending}
                            data-testid={EMAIL_TEMPLATES_HANDLES.DELETE}
                            aria-label={t("emailTemplates.ui.delete")}
                            onClick={() =>
                              setPendingConfirmation({
                                templateId: template.id!,
                                action: EMAIL_TEMPLATE_ACTIONS.DELETE,
                              })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                          {template.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isActionPending}
                              aria-label={t("emailTemplates.ui.restore")}
                              onClick={() =>
                                void restoreTemplate(template.id!).catch(() => undefined)
                              }
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isActionPending}
                              aria-label={t("emailTemplates.ui.archive")}
                              onClick={() =>
                                setPendingConfirmation({
                                  templateId: template.id!,
                                  action: EMAIL_TEMPLATE_ACTIONS.ARCHIVE,
                                })
                              }
                            >
                              <Archive className="size-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isPending && !isError && !data?.data.length && (
                <TableRow>
                  <TableCell colSpan={5}>{t("emailTemplates.ui.emptyList")}</TableCell>
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
    </PageWrapper>
  );
}
