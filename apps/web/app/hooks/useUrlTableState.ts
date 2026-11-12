import { useSearchParams } from "@remix-run/react";
import { functionalUpdate, type SortingState, type Updater } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ITEMS_PER_PAGE_OPTIONS,
  type ItemsPerPageOption,
} from "~/components/Pagination/Pagination";
import { useDebounce } from "~/hooks/useDebounce";

export const TABLE_URL_PARAMS = {
  SORT: "sort",
  PAGE: "page",
  PER_PAGE: "perPage",
} as const;

const DEFAULT_SEARCH_PARAM = "search";
const DEFAULT_PER_PAGE: ItemsPerPageOption = 20;
const DESCENDING_PREFIX = "-";

export type TableSort<TSortField extends string> = TSortField | `-${TSortField}`;

type UseUrlTableStateOptions<TFilterKey extends string, TSortField extends string> = {
  /** URL params holding the table's filters, e.g. `["category", "state"]`. */
  filterKeys: readonly TFilterKey[];
  /** Filter values the page can use; a URL value that fails its check is ignored and not counted. */
  filterValidators?: Partial<Record<TFilterKey, (value: string) => boolean>>;
  /** Sortable column ids mapped to the API sort field they order by. */
  sortFields?: Partial<Record<string, TSortField>>;
  /** URL param holding the free-text search; `search` by default. */
  searchParam?: string;
  defaultPerPage?: ItemsPerPageOption;
};

type UrlValues = Record<string, string | undefined>;

const isItemsPerPageOption = (value: number): value is ItemsPerPageOption =>
  ITEMS_PER_PAGE_OPTIONS.some((option) => option === value);

const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
};

/**
 * Keeps a table's search, filters, sorting and page in the URL so any view can be shared or
 * bookmarked. Narrowing or re-sorting the list returns to the first page. Search typing is
 * debounced before it reaches the URL.
 */
export function useUrlTableState<TFilterKey extends string, TSortField extends string = string>({
  filterKeys,
  filterValidators = {},
  sortFields = {},
  searchParam = DEFAULT_SEARCH_PARAM,
  defaultPerPage = DEFAULT_PER_PAGE,
}: UseUrlTableStateOptions<TFilterKey, TSortField>) {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get(searchParam) ?? "";
  const sortParam = searchParams.get(TABLE_URL_PARAMS.SORT);
  const perPageParam = Number(searchParams.get(TABLE_URL_PARAMS.PER_PAGE));
  const page = parsePage(searchParams.get(TABLE_URL_PARAMS.PAGE));
  const perPage = isItemsPerPageOption(perPageParam) ? perPageParam : defaultPerPage;

  const filterValues = filterKeys.map((filterKey) => {
    const value = searchParams.get(filterKey);
    const isValid = value && (filterValidators[filterKey]?.(value) ?? true);

    return isValid ? value : undefined;
  });
  const filtersKey = filterValues.join("\u0000");
  const filters = useMemo(
    () =>
      Object.fromEntries(
        filterKeys.map((filterKey, index) => [filterKey, filterValues[index]]),
      ) as Partial<Record<TFilterKey, string>>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey],
  );

  const toSort = (nextSorting: SortingState): TableSort<TSortField> | undefined => {
    const [firstSort] = nextSorting;
    const sortField = firstSort && sortFields[firstSort.id];
    if (!sortField) return undefined;

    return firstSort.desc ? `-${sortField}` : sortField;
  };

  const sorting = useMemo<SortingState>(() => {
    const isDescending = Boolean(sortParam?.startsWith(DESCENDING_PREFIX));
    const sortField = isDescending ? sortParam?.slice(DESCENDING_PREFIX.length) : sortParam;
    const sortColumn = Object.entries(sortFields).find(([, field]) => field === sortField)?.[0];

    return sortColumn ? [{ id: sortColumn, desc: isDescending }] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortParam]);
  const sort = toSort(sorting);

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput.trim());

  const updateUrlParams = (values: UrlValues) => {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        Object.entries(values).forEach(([param, value]) => {
          if (value) nextParams.set(param, value);
          else nextParams.delete(param);
        });

        return nextParams;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const updateListParams = (values: UrlValues) =>
    updateUrlParams({ ...values, [TABLE_URL_PARAMS.PAGE]: undefined });

  const lastUrlSearch = useRef(search);

  useEffect(() => {
    if (lastUrlSearch.current === search) return;

    lastUrlSearch.current = search;
    setSearchInput((currentInput) => (currentInput.trim() === search ? currentInput : search));
  }, [search]);

  useEffect(() => {
    if (debouncedSearch === search) return;

    updateListParams({ [searchParam]: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const activeFilterCount = [search, ...filterValues].filter(Boolean).length;

  const resetFilters = () => {
    setSearchInput("");
    updateListParams(
      Object.fromEntries([searchParam, ...filterKeys].map((param) => [param, undefined])),
    );
  };

  return {
    search,
    searchInput,
    setSearchInput,
    filters,
    setFilter: (filterKey: TFilterKey, value?: string) => updateListParams({ [filterKey]: value }),
    setFilters: (values: Partial<Record<TFilterKey, string>>) => updateListParams(values),
    sorting,
    sort,
    setSorting: (sortingUpdater: Updater<SortingState>) =>
      updateListParams({
        [TABLE_URL_PARAMS.SORT]: toSort(functionalUpdate(sortingUpdater, sorting)),
      }),
    page,
    perPage,
    setPage: (nextPage: number) =>
      updateUrlParams({ [TABLE_URL_PARAMS.PAGE]: nextPage > 1 ? String(nextPage) : undefined }),
    setPerPage: (nextPerPage: string) =>
      updateListParams({
        [TABLE_URL_PARAMS.PER_PAGE]:
          Number(nextPerPage) === defaultPerPage ? undefined : nextPerPage,
      }),
    activeFilterCount,
    resetFilters,
  };
}

export type UrlTableState<
  TFilterKey extends string,
  TSortField extends string = string,
> = ReturnType<typeof useUrlTableState<TFilterKey, TSortField>>;
