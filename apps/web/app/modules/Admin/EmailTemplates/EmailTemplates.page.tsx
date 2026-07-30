import { useNavigate } from "@remix-run/react";
import { EMAIL_TEMPLATE_STATUSES } from "@repo/shared";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { isEmpty } from "lodash-es";
import { Plus, Trash } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCreateEmailTemplate } from "~/api/mutations/admin/useCreateEmailTemplate";
import { useDeleteEmailTemplate } from "~/api/mutations/admin/useDeleteEmailTemplate";
import { useDeleteManyEmailTemplates } from "~/api/mutations/admin/useDeleteManyEmailTemplates";
import { useAllEmailTemplates } from "~/api/queries/admin/useAllEmailTemplates";
import { PageWrapper } from "~/components/PageWrapper";
import {
  ITEMS_PER_PAGE_OPTIONS,
  Pagination,
  type ItemsPerPageOption,
} from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { getEmailTemplatesColumns } from "./emailTemplates.columns";

import type { MetaFunction } from "@remix-run/react";
import type { EmailTemplateStatus } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.emailTemplates");

type FilterParams = {
  name?: string;
  status?: EmailTemplateStatus;
};

const DEFAULT_PER_PAGE: ItemsPerPageOption = 20;

const EmailTemplatesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<FilterParams>({});
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<ItemsPerPageOption>(DEFAULT_PER_PAGE);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number>(0);

  const queryParams = useMemo(() => ({ ...filters, page, perPage }), [filters, page, perPage]);

  const { data: response, isLoading, isError } = useAllEmailTemplates(queryParams);
  const templates = response?.data;
  const paginationInfo = response?.pagination;

  const { mutateAsync: createEmailTemplate, isPending: isCreating } = useCreateEmailTemplate();
  const { mutate: deleteEmailTemplate } = useDeleteEmailTemplate();
  const { mutate: deleteManyEmailTemplates } = useDeleteManyEmailTemplates();
  const uiLanguage = useLanguageStore((state) => state.language);

  const statusOptions = useMemo(
    () =>
      Object.values(EMAIL_TEMPLATE_STATUSES).map((status) => ({
        value: status,
        label: t(`emailTemplates.status.${status}`),
      })),
    [t],
  );

  const filterConfig: FilterConfig[] = [
    {
      name: "name",
      type: "text",
      placeholder: t("emailTemplates.list.searchPlaceholder"),
      testId: "email-templates-name-filter",
    },
    {
      name: "status",
      type: "select",
      placeholder: t("common.other.allStatuses"),
      options: statusOptions,
      testId: "email-templates-status-filter",
      optionTestId: (option) => `email-templates-status-filter-option-${option.value}`,
    },
  ];

  const handleFilterChange = (name: string, value: FilterValue) => {
    startTransition(() => {
      setPage(1);
      setFilters((prev) => ({ ...prev, [name]: value }));
    });
  };

  const handlePageChange = (nextPage: number) => {
    startTransition(() => setPage(nextPage));
  };

  const handlePerPageChange = (nextPerPage: string) => {
    const parsed = Number(nextPerPage);
    const nextValue = (
      ITEMS_PER_PAGE_OPTIONS.includes(parsed as (typeof ITEMS_PER_PAGE_OPTIONS)[number])
        ? parsed
        : DEFAULT_PER_PAGE
    ) as ItemsPerPageOption;
    startTransition(() => {
      setPage(1);
      setPerPage(nextValue);
    });
  };

  const columns = useMemo(
    () => getEmailTemplatesColumns({ lastSelectedRowIndex, setLastSelectedRowIndex, t }),
    [lastSelectedRowIndex, t],
  );

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: templates ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
  });

  const selectedTemplateIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
  const bodyRows = table.getRowModel().rows;
  const columnCount = columns.length;
  const totalItems = paginationInfo?.totalItems ?? 0;

  const handleCreate = async () => {
    const data = await createEmailTemplate({
      data: {
        baseLanguage: uiLanguage,
        availableLocales: [uiLanguage],
      },
    });
    navigate(`/admin/email-templates/${data.data.id}`);
  };

  const handleDelete = () => {
    if (selectedTemplateIds.length === 1) {
      deleteEmailTemplate(selectedTemplateIds[0], {
        onSuccess: () => setRowSelection({}),
      });
      return;
    }

    deleteManyEmailTemplates(selectedTemplateIds, {
      onSuccess: () => setRowSelection({}),
    });
  };

  const deleteModalTitle =
    selectedTemplateIds.length === 1
      ? t("emailTemplates.deleteModal.titleSingle")
      : t("emailTemplates.deleteModal.titleMultiple");

  const deleteModalDescription =
    selectedTemplateIds.length === 1
      ? t("emailTemplates.deleteModal.descriptionSingle")
      : t("emailTemplates.deleteModal.descriptionMultiple", {
          count: selectedTemplateIds.length,
        });

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("emailTemplates.breadcrumbs.list"), href: "/admin/email-templates" },
      ]}
    >
      <div className="flex flex-col">
        <div className="mb-6 flex flex-col lg:p-0">
          <h4 className="h4 pb-1 text-neutral-950">{t("emailTemplates.list.title")}</h4>
          <p className="body-lg-md text-neutral-800">{t("emailTemplates.list.subHeader")}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <Button
            variant="primary"
            className="gap-2"
            onClick={handleCreate}
            disabled={isCreating}
            data-testid="email-templates-create-button"
          >
            <Plus className="size-4" />
            {t("emailTemplates.list.createButton")}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SearchFilter
            filters={filterConfig}
            values={filters}
            onChange={handleFilterChange}
            isLoading={isPending}
          />
          <div className="flex gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className="gap-2"
                  variant="destructive"
                  disabled={isEmpty(selectedTemplateIds)}
                  data-testid="email-templates-delete-selected-button"
                >
                  <Trash className="size-4" />
                  {t("emailTemplates.list.deleteSelected")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{deleteModalTitle}</DialogTitle>
                  <DialogDescription>{deleteModalDescription}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" className="text-primary-800">
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      onClick={handleDelete}
                      variant="destructive"
                      data-testid="email-templates-delete-confirm-button"
                    >
                      {t("common.button.delete")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Table className="border bg-neutral-50" data-testid="email-templates-page">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => (
                  <TableHead key={header.id} className={cn({ "size-12": index === 0 })}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {match({ isLoading, isError, isEmpty: bodyRows.length === 0 })
              .with({ isLoading: true }, () => (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("emailTemplates.list.loading")}
                  </TableCell>
                </TableRow>
              ))
              .with({ isError: true }, () => (
                <TableRow>
                  <TableCell colSpan={columnCount} className="h-24 text-center text-destructive">
                    {t("emailTemplates.list.loadFailed")}
                  </TableCell>
                </TableRow>
              ))
              .with({ isEmpty: true }, () => (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("emailTemplates.list.empty")}
                  </TableCell>
                </TableRow>
              ))
              .otherwise(() =>
                bodyRows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid={`email-templates-row-${row.original.id}`}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => navigate(`/admin/email-templates/${row.original.id}`)}
                    className="cursor-pointer hover:bg-neutral-100"
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell key={cell.id} className={cn({ "size-12": index === 0 })}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )),
              )}
          </TableBody>
        </Table>
        {totalItems > 0 && (
          <Pagination
            className="border-b border-x bg-neutral-50 rounded-b-lg"
            totalItems={totalItems}
            itemsPerPage={paginationInfo?.perPage as ItemsPerPageOption | undefined}
            currentPage={paginationInfo?.page}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handlePerPageChange}
            testIds={{
              next: "email-templates-pagination-next",
              previous: "email-templates-pagination-previous",
              page: (page) => `email-templates-pagination-page-${page}`,
              itemsPerPage: "email-templates-pagination-items-per-page",
              itemsPerPageOption: (itemsPerPage) =>
                `email-templates-pagination-items-per-page-option-${itemsPerPage}`,
            }}
          />
        )}
      </div>
    </PageWrapper>
  );
};

export default EmailTemplatesPage;
