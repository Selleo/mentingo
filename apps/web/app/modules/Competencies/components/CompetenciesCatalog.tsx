import { Plus } from "lucide-react";

import { Pagination } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { useCompetenciesCatalog } from "../hooks/useCompetenciesCatalog";
import { UNCATEGORIZED_FILTER } from "../utils/competenciesCatalog.utils";

import { CompetenciesCatalogTable } from "./CompetenciesCatalogTable";
import { CompetenciesSelect } from "./CompetenciesSelect";

import type { CompetenciesCatalogOptions } from "../hooks/competencies-hooks.types";

export type CompetenciesCatalogProps = CompetenciesCatalogOptions;

export function CompetenciesCatalog({ onEdit, onCreate }: CompetenciesCatalogProps) {
  const {
    t,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    page,
    setPage,
    perPage,
    setPerPage,
    categories,
    query,
    competencies,
    totalItems,
    hasFilters,
  } = useCompetenciesCatalog();
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
  if (!totalItems && !hasFilters)
    return (
      <div className="p-6">
        <CompetenciesEmpty
          title={t("competencies.setupSection.emptyCompetenciesTitle")}
          message={t("competencies.setupSection.emptyCompetencies")}
          action={
            <Button onClick={onCreate}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              {t("competencies.newCompetency")}
            </Button>
          }
        />
      </div>
    );

  return (
    <div aria-label={t("competencies.catalog")} className="min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 px-6 pb-6 pt-4 sm:flex-row sm:items-center">
        <SearchInput
          aria-label={t("competencies.searchCatalog")}
          placeholder={t("competencies.searchCatalog")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full sm:max-w-xs"
          className="max-w-none"
        />
        {categories.length > 0 && (
          <CompetenciesSelect
            label={t("competencies.category")}
            hideLabel
            className="w-full sm:w-56"
            value={categoryId}
            emptyLabel={t("competencies.catalogTable.allCategories")}
            options={[
              { value: UNCATEGORIZED_FILTER, label: t("competencies.categories.none") },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
            onChange={(value) => {
              setCategoryId(value);
              setPage(1);
            }}
          />
        )}
        <Button
          className="sm:ml-auto"
          data-testid={COMPETENCIES_HANDLES.ADD_COMPETENCY}
          onClick={onCreate}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {t("competencies.newCompetency")}
        </Button>
      </div>
      {competencies.length === 0 ? (
        <p className="body-sm border-t border-neutral-200 px-6 py-10 text-center text-neutral-800">
          {t("competencies.noSearchResults")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <CompetenciesCatalogTable competencies={competencies} onEdit={onEdit} />
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
            setPerPage(value);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

export { CompetenciesCatalogEditor } from "./CompetenciesCatalogEditor";

export {
  CATEGORY_OPTIONS_PAGE,
  CONDITION_KIND_ICONS,
  UNCATEGORIZED_FILTER,
  tableHeadClassName,
} from "../utils/competenciesCatalog.utils";
