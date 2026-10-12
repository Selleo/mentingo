import type {
  ItemsPerPageOption,
  PaginationRangeItem,
  PaginationStateParams,
} from "./pagination.types";

export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
export const NEWS_ITEMS_PER_PAGE_OPTIONS = [7, 9] as const;

export const getItemsPerPageOptions = (itemsPerPage: ItemsPerPageOption) =>
  NEWS_ITEMS_PER_PAGE_OPTIONS.some((option) => option === itemsPerPage)
    ? NEWS_ITEMS_PER_PAGE_OPTIONS
    : ITEMS_PER_PAGE_OPTIONS;

export const getPaginationState = ({
  totalItems,
  itemsPerPage,
  currentPage,
  overrideTotalPages,
  startItemOverride,
  endItemOverride,
}: PaginationStateParams) => {
  const totalPages = overrideTotalPages ?? Math.ceil(totalItems / itemsPerPage);

  return {
    totalPages,
    startItem: startItemOverride ?? (currentPage - 1) * itemsPerPage + 1,
    endItem: endItemOverride ?? Math.min(currentPage * itemsPerPage, totalItems),
    itemsPerPageOptions: getItemsPerPageOptions(itemsPerPage),
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
};

const pagesBetween = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const toPaginationRange = (pages: number[], totalPages: number): PaginationRangeItem[] => {
  const shownPages = [...new Set(pages)].filter((page) => page >= 1 && page <= totalPages);

  return shownPages.flatMap((page, index): PaginationRangeItem[] => {
    const previousPage = shownPages[index - 1];
    const pageItem = { key: page, page, isEllipsis: false };

    if (previousPage === undefined || page - previousPage === 1) return [pageItem];

    const isEndGap = index === shownPages.length - 1;

    return [
      {
        key: isEndGap ? "end-ellipsis" : "start-ellipsis",
        page: isEndGap ? previousPage + 1 : page - 1,
        isEllipsis: true,
      },
      pageItem,
    ];
  });
};

export const getPaginationRange = (
  currentPage: number,
  totalPages: number,
): PaginationRangeItem[] =>
  toPaginationRange([1, currentPage - 1, currentPage, currentPage + 1, totalPages], totalPages);

const FIXED_RANGE_LENGTH = 7;
const EDGE_PAGE_COUNT = FIXED_RANGE_LENGTH - 2;

export const getFixedLengthPaginationRange = (
  currentPage: number,
  totalPages: number,
): PaginationRangeItem[] => {
  if (totalPages <= FIXED_RANGE_LENGTH) {
    return toPaginationRange(pagesBetween(1, totalPages), totalPages);
  }

  const closingStartsAt = totalPages - EDGE_PAGE_COUNT + 1;

  if (currentPage + 1 <= EDGE_PAGE_COUNT) {
    return toPaginationRange([...pagesBetween(1, EDGE_PAGE_COUNT), totalPages], totalPages);
  }

  if (currentPage - 1 >= closingStartsAt) {
    return toPaginationRange([1, ...pagesBetween(closingStartsAt, totalPages)], totalPages);
  }

  return getPaginationRange(currentPage, totalPages);
};
