import { useReducer } from "react";
import { match } from "ts-pattern";

import { PAGINATION_REDUCER_ACTIONS } from "./usePaginationReducer.types";

import type {
  PaginationReducerAction,
  PaginationReducerState,
  UsePaginationReducerParams,
} from "./usePaginationReducer.types";

const DEFAULT_PAGINATION_STATE: PaginationReducerState = {
  page: 1,
  perPage: 10,
  search: "",
};

const createInitialPaginationState = (
  initialState: UsePaginationReducerParams = {},
): PaginationReducerState => ({
  ...DEFAULT_PAGINATION_STATE,
  ...initialState,
});

const paginationReducer = (
  state: PaginationReducerState,
  action: PaginationReducerAction,
): PaginationReducerState =>
  match(action)
    .with({ type: PAGINATION_REDUCER_ACTIONS.SET_PAGE }, ({ page }) => ({
      ...state,
      page,
    }))
    .with({ type: PAGINATION_REDUCER_ACTIONS.SET_PER_PAGE }, ({ perPage }) => ({
      ...state,
      page: 1,
      perPage,
    }))
    .with({ type: PAGINATION_REDUCER_ACTIONS.SET_SEARCH }, ({ search }) => ({
      ...state,
      page: 1,
      search,
    }))
    .with({ type: PAGINATION_REDUCER_ACTIONS.RESET }, ({ state }) => state)
    .exhaustive();

export function usePaginationReducer(initialState?: UsePaginationReducerParams) {
  const initialPaginationState = createInitialPaginationState(initialState);
  const [pagination, dispatch] = useReducer(paginationReducer, initialPaginationState);

  return {
    pagination,
    setPage: (page: number) => dispatch({ type: PAGINATION_REDUCER_ACTIONS.SET_PAGE, page }),
    setPerPage: (perPage: string) =>
      dispatch({
        type: PAGINATION_REDUCER_ACTIONS.SET_PER_PAGE,
        perPage: Number(perPage) as PaginationReducerState["perPage"],
      }),
    setSearch: (search: string) =>
      dispatch({ type: PAGINATION_REDUCER_ACTIONS.SET_SEARCH, search }),
    resetPagination: () =>
      dispatch({ type: PAGINATION_REDUCER_ACTIONS.RESET, state: initialPaginationState }),
  };
}
