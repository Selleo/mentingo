import type { ITEMS_PER_PAGE_OPTIONS, NEWS_ITEMS_PER_PAGE_OPTIONS } from "./pagination.utils";

export type ItemsPerPageOption =
  | (typeof ITEMS_PER_PAGE_OPTIONS)[number]
  | (typeof NEWS_ITEMS_PER_PAGE_OPTIONS)[number];

export interface PaginationProps {
  className?: string;
  emptyDataClassName?: string;
  totalItems?: number;
  itemsPerPage?: ItemsPerPageOption;
  currentPage?: number;
  canChangeItemsPerPage?: boolean;
  overrideTotalPages?: number;
  startItemOverride?: number;
  endItemOverride?: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: string) => void;
  testIds?: {
    previous?: string;
    next?: string;
    page?: (page: number) => string;
    itemsPerPage?: string;
    itemsPerPageOption?: (itemsPerPage: number) => string;
  };
}

export type PaginationStateParams = Required<
  Pick<PaginationProps, "totalItems" | "itemsPerPage" | "currentPage">
> &
  Pick<PaginationProps, "overrideTotalPages" | "startItemOverride" | "endItemOverride">;

export type PaginationRangeItem = {
  key: string | number;
  page: number;
  isEllipsis: boolean;
};
