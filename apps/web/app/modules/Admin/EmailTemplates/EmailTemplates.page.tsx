import { useNavigate } from "@remix-run/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useArchiveEmailTemplate } from "~/api/mutations/emailTemplates/useArchiveEmailTemplate";
import { useCopyDefaultEmailTemplate } from "~/api/mutations/emailTemplates/useCopyDefaultEmailTemplate";
import { useDeleteEmailTemplate } from "~/api/mutations/emailTemplates/useDeleteEmailTemplate";
import { useDuplicateEmailTemplate } from "~/api/mutations/emailTemplates/useDuplicateEmailTemplate";
import { useRestoreEmailTemplate } from "~/api/mutations/emailTemplates/useRestoreEmailTemplate";
import { useEmailTemplates } from "~/api/queries/useEmailTemplates";
import {
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableToolbar,
  useClampedPage,
} from "~/components/DataTable";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../e2e/data/email-templates/handles";

import { CreateEmailTemplateDialog } from "./components/CreateEmailTemplateDialog";
import { EmailTemplateConfirmation } from "./components/EmailTemplateConfirmation";
import { getEmailTemplateColumns } from "./emailTemplates.columns";
import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_LIST_PATH,
  EMAIL_TEMPLATES_DEFAULT_PAGE_SIZE,
  EMAIL_TEMPLATES_SEARCH_MAX_LENGTH,
} from "./emailTemplates.constants";

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

const EMAIL_TEMPLATES_FILTER_KEYS = [] as const;

export function EmailTemplatesContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);

  const tableState = useUrlTableState({
    filterKeys: EMAIL_TEMPLATES_FILTER_KEYS,
    defaultPerPage: EMAIL_TEMPLATES_DEFAULT_PAGE_SIZE,
  });
  const { page, perPage, search } = tableState;

  const { data, isPending, isFetching, isError } = useEmailTemplates(page, perPage, search);

  const [pendingConfirmation, setPendingConfirmation] =
    useState<EmailTemplateListConfirmation | null>(null);
  const [isCreationOpen, setIsCreationOpen] = useState(false);

  const { mutateAsync: copyDefaultTemplate, isPending: isCopying } = useCopyDefaultEmailTemplate();
  const { mutateAsync: duplicateTemplate, isPending: isDuplicating } = useDuplicateEmailTemplate();
  const { mutateAsync: deleteTemplate, isPending: isDeleting } = useDeleteEmailTemplate();
  const { mutateAsync: archiveTemplate, isPending: isArchiving } = useArchiveEmailTemplate();
  const { mutateAsync: restoreTemplate, isPending: isRestoring } = useRestoreEmailTemplate();

  const isActionPending = isCopying || isDuplicating || isArchiving || isRestoring || isDeleting;

  useClampedPage({
    page,
    perPage,
    totalItems: data?.pagination.totalItems,
    setPage: tableState.setPage,
  });

  const openEmailTemplate = (template: EmailTemplate) => {
    const editorPath = template.id
      ? `${EMAIL_TEMPLATE_LIST_PATH}/${template.id}`
      : `${EMAIL_TEMPLATE_LIST_PATH}/defaults/${template.event}`;

    navigate(editorPath);
  };

  const columns = useMemo(() => {
    const openCopiedTemplate = (copiedTemplateId: string | null) => {
      if (copiedTemplateId) navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${copiedTemplateId}`);
    };

    return getEmailTemplateColumns({
      t,
      language,
      isActionPending,
      copyDefaultTemplate: (event) =>
        void copyDefaultTemplate(event)
          .then((copied) => openCopiedTemplate(copied.id))
          .catch(() => undefined),
      duplicateTemplate: (templateId) =>
        void duplicateTemplate(templateId)
          .then((copied) => openCopiedTemplate(copied.id))
          .catch(() => undefined),
      restoreTemplate: (templateId) => void restoreTemplate(templateId).catch(() => undefined),
      requestConfirmation: setPendingConfirmation,
    });
  }, [
    t,
    language,
    isActionPending,
    navigate,
    copyDefaultTemplate,
    duplicateTemplate,
    restoreTemplate,
  ]);

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getRowId: (template) => template.id ?? template.event ?? "builtin",
    getCoreRowModel: getCoreRowModel(),
  });

  if (isError)
    return (
      <ErrorPage
        title={t("emailTemplates.ui.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  const confirmPendingAction = () => {
    if (!pendingConfirmation) return;

    const runConfirmedAction =
      pendingConfirmation.action === EMAIL_TEMPLATE_ACTIONS.DELETE
        ? deleteTemplate
        : archiveTemplate;

    void runConfirmedAction(pendingConfirmation.templateId)
      .then(() => setPendingConfirmation(null))
      .catch(() => undefined);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("emailTemplates.ui.title")}
          actions={
            <Button
              variant="primary"
              className="gap-2"
              disabled={isActionPending}
              onClick={() => setIsCreationOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              {t("emailTemplates.ui.create")}
            </Button>
          }
        />

        <DataTableCard>
          <DataTableToolbar
            searchValue={tableState.searchInput}
            onSearchChange={(value) =>
              tableState.setSearchInput(value.slice(0, EMAIL_TEMPLATES_SEARCH_MAX_LENGTH))
            }
            searchPlaceholder={t("emailTemplates.ui.searchTemplates")}
            canResetFilters={tableState.activeFilterCount > 0}
            onResetFilters={tableState.resetFilters}
          />

          <DataTable
            table={table}
            isRefreshing={isFetching && Boolean(data)}
            onRowClick={(row) => openEmailTemplate(row.original)}
            testId={EMAIL_TEMPLATES_HANDLES.TABLE}
            getRowTestId={(template) =>
              EMAIL_TEMPLATES_HANDLES.ROW(template.id ?? template.event ?? "builtin")
            }
            emptyState={
              isPending ? (
                <p className="py-12 text-center text-sm text-neutral-600">
                  {t("emailTemplates.ui.loading")}
                </p>
              ) : (
                <DataTableEmptyState
                  title={t("emailTemplates.ui.emptyList")}
                  onResetFilters={
                    tableState.activeFilterCount > 0 ? tableState.resetFilters : undefined
                  }
                />
              )
            }
          />

          <DataTablePagination
            totalItems={data?.pagination.totalItems}
            itemsPerPage={perPage}
            currentPage={page}
            onPageChange={tableState.setPage}
            onItemsPerPageChange={tableState.setPerPage}
          />
        </DataTableCard>
      </div>
      {isCreationOpen && <CreateEmailTemplateDialog onClose={() => setIsCreationOpen(false)} />}
      <EmailTemplateConfirmation
        action={pendingConfirmation?.action ?? null}
        isActionPending={isArchiving || isDeleting}
        onClose={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
      />
    </>
  );
}
