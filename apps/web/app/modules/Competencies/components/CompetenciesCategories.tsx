import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useCompetencyCategories } from "~/api/queries/useCompetencyCategories";
import { Pagination } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useDebounce } from "~/hooks/useDebounce";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";

import { CompetencyCategoryEditor } from "./CompetencyCategoryEditor";

import type { CompetencyCategory } from "../competencies.types";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";

export function CompetenciesCategories() {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<(typeof ITEMS_PER_PAGE_OPTIONS)[number]>(20);
  const [editor, setEditor] = useState<{ category?: CompetencyCategory } | null>(null);
  const [deleting, setDeleting] = useState<CompetencyCategory | null>(null);
  const debouncedSearch = useDebounce(search.trim());
  const query = useCompetencyCategories({ page, perPage, search: debouncedSearch || undefined });
  const categories = query.data?.data ?? [];
  const totalItems = query.data?.pagination.totalItems ?? 0;

  const openCreate = () => setEditor({});
  const content = () => {
    if (query.isPending)
      return (
        <div className="p-6">
          <CompetenciesLoading label={t("competencies.loading")} />
        </div>
      );
    if (query.isError)
      return (
        <div className="p-6">
          <CompetenciesError
            title={t("competencies.serviceError")}
            actionLabel={t("competencies.retry")}
            onRetry={() => void query.refetch()}
          />
        </div>
      );
    if (!totalItems && !search.trim())
      return (
        <div className="p-6">
          <CompetenciesEmpty
            title={t("competencies.categories.emptyTitle")}
            message={t("competencies.categories.empty")}
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {t("competencies.categories.new")}
              </Button>
            }
          />
        </div>
      );
    return (
      <div className="min-w-0 overflow-hidden">
        <div className="flex flex-col gap-3 px-6 pb-6 pt-4 sm:flex-row sm:items-center">
          <SearchInput
            aria-label={t("competencies.categories.search")}
            placeholder={t("competencies.categories.search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            wrapperClassName="w-full sm:max-w-xs"
            className="max-w-none"
          />
          <Button
            className="sm:ml-auto"
            data-testid={COMPETENCIES_HANDLES.ADD_CATEGORY}
            onClick={openCreate}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {t("competencies.categories.new")}
          </Button>
        </div>
        {categories.length === 0 ? (
          <p className="body-sm border-t border-neutral-200 px-6 py-10 text-center text-neutral-800">
            {t("competencies.noSearchResults")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-neutral-50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="details-md pl-6 text-neutral-800">
                    {t("competencies.category")}
                  </TableHead>
                  <TableHead className="details-md whitespace-nowrap text-neutral-800">
                    {t("competencies.categories.competencyCount")}
                  </TableHead>
                  <TableHead className="w-28 pr-6">
                    <span className="sr-only">{t("competencies.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow
                    key={category.id}
                    data-testid={COMPETENCIES_HANDLES.CATEGORY_ROW(category.id)}
                  >
                    <TableCell className="body-sm-md pl-6 text-neutral-950">
                      {category.name}
                    </TableCell>
                    <TableCell className="body-sm text-neutral-900">
                      {category.competencyCount}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t("competencies.edit")}: ${category.name}`}
                          onClick={() => setEditor({ category })}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-neutral-700 hover:text-error-700"
                          aria-label={`${t("common.button.delete")}: ${category.name}`}
                          onClick={() => setDeleting(category)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {totalItems > 0 && (
          <Pagination
            className="border-t border-neutral-200 px-6 py-3"
            totalItems={totalItems}
            itemsPerPage={perPage}
            currentPage={page}
            onPageChange={setPage}
            onItemsPerPageChange={(value) => {
              setPerPage(Number(value) as (typeof ITEMS_PER_PAGE_OPTIONS)[number]);
              setPage(1);
            }}
          />
        )}
      </div>
    );
  };

  return (
    <>
      {content()}
      {editor && (
        <CompetencyCategoryEditor category={editor.category} onClose={() => setEditor(null)} />
      )}
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !isPending) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("competencies.categories.delete")}</DialogTitle>
            <DialogDescription>
              {deleting?.competencyCount
                ? t("competencies.categories.inUse", {
                    name: deleting.name,
                    count: deleting.competencyCount,
                  })
                : t("competencies.categories.deleteConfirmation", { name: deleting?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                {t("competencies.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={isPending || Boolean(deleting?.competencyCount)}
              onClick={async () => {
                if (!deleting) return;
                try {
                  await execute({
                    operation: "delete_category",
                    id: deleting.id,
                    revision: deleting.revision,
                  });
                  setDeleting(null);
                } catch {
                  /* The mutation reports why the category was kept. */
                }
              }}
            >
              {t("common.button.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CompetencyCategoryEditor } from "./CompetencyCategoryEditor";
