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

import { ApiClient } from "~/api/api-client";
import { useDeleteEmailTemplate } from "~/api/mutations/admin/useDeleteEmailTemplate";
import { useDeleteManyEmailTemplates } from "~/api/mutations/admin/useDeleteManyEmailTemplates";
import {
  ALL_EMAIL_TEMPLATES_QUERY_KEY,
  useAllEmailTemplates,
} from "~/api/queries/admin/useAllEmailTemplates";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
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

type SearchParams = {
  name?: string;
  status?: EmailTemplateStatus;
};

const EmailTemplatesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  const [searchParams, setSearchParams] = useState<SearchParams>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number>(0);

  const { data: templates, isLoading, isError } = useAllEmailTemplates(searchParams);

  const [isCreating, setIsCreating] = useState(false);
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
    },
    {
      name: "status",
      type: "select",
      placeholder: t("common.other.allStatuses"),
      options: statusOptions,
    },
  ];

  const handleFilterChange = (name: string, value: FilterValue) => {
    startTransition(() => {
      setSearchParams((prev) => ({
        ...prev,
        [name]: value,
      }));
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

  const handleCreate = async () => {
    const fetchNextName = async () => {
      const { data } = await ApiClient.api.emailNotificationTemplatesControllerGetNextAutoName();
      return data.data.name;
    };

    const createTemplate = async (name: string) => {
      const { data } = await ApiClient.api.emailNotificationTemplatesControllerCreateTemplate({
        name,
        baseLanguage: uiLanguage,
        availableLocales: [uiLanguage],
      });
      return data;
    };

    setIsCreating(true);
    try {
      let name = await fetchNextName();
      try {
        const response = await createTemplate(name);
        await queryClient.invalidateQueries({ queryKey: [ALL_EMAIL_TEMPLATES_QUERY_KEY] });
        navigate(`/admin/email-templates/${response.data.id}`);
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "status" in err
            ? (err as { status: number }).status
            : 0;
        if (status === 409) {
          name = await fetchNextName();
          const response = await createTemplate(name);
          await queryClient.invalidateQueries({ queryKey: [ALL_EMAIL_TEMPLATES_QUERY_KEY] });
          navigate(`/admin/email-templates/${response.data.id}`);
          return;
        }
        throw err;
      }
    } finally {
      setIsCreating(false);
    }
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
        <div className="flex flex-wrap justify-between gap-3">
          <h4 className="h4">{t("emailTemplates.list.title")}</h4>
          <div className="flex gap-3">
            <Button
              variant="primary"
              className="gap-2"
              onClick={handleCreate}
              disabled={isCreating}
            >
              <Plus className="size-4" />
              {t("emailTemplates.list.createButton")}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className="gap-2"
                  variant="destructive"
                  disabled={isEmpty(selectedTemplateIds)}
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
                    <Button onClick={handleDelete} variant="destructive">
                      {t("common.button.delete")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SearchFilter
            filters={filterConfig}
            values={searchParams}
            onChange={handleFilterChange}
            isLoading={isPending}
          />
        </div>
        <Table className="border bg-neutral-50">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                  {t("emailTemplates.list.loading")}
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-destructive">
                  {t("emailTemplates.list.loadFailed")}
                </TableCell>
              </TableRow>
            ) : bodyRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                  {t("emailTemplates.list.empty")}
                </TableCell>
              </TableRow>
            ) : (
              bodyRows.map((row) => (
                <TableRow
                  key={row.id}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageWrapper>
  );
};

export default EmailTemplatesPage;
