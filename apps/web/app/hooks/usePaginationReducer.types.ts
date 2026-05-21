import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

export const PAGINATION_REDUCER_ACTIONS = {
  SET_PAGE: "set_page",
  SET_PER_PAGE: "set_per_page",
  SET_SEARCH: "set_search",
  RESET: "reset",
} as const;

export type PaginationReducerState = {
  page: number;
  perPage: ItemsPerPageOption;
  search: string;
};

export type PaginationReducerAction =
  | { type: typeof PAGINATION_REDUCER_ACTIONS.SET_PAGE; page: number }
  | { type: typeof PAGINATION_REDUCER_ACTIONS.SET_PER_PAGE; perPage: ItemsPerPageOption }
  | { type: typeof PAGINATION_REDUCER_ACTIONS.SET_SEARCH; search: string }
  | { type: typeof PAGINATION_REDUCER_ACTIONS.RESET; state: PaginationReducerState };

export type UsePaginationReducerParams = Partial<PaginationReducerState>;
