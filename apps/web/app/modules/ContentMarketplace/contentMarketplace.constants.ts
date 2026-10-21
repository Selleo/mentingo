import { CONTENT_MARKETPLACE_SORT } from "@repo/shared";

export const CONTENT_MARKETPLACE_PATH = "/content-marketplace";

export const CONTENT_MARKETPLACE_FILTER_ALL = "__all__";

export const CONTENT_MARKETPLACE_PAGE_SIZE = 20;

export const CONTENT_MARKETPLACE_RECENT_QUERY = {
  page: 1,
  perPage: 2,
  sortBy: CONTENT_MARKETPLACE_SORT.RECENT,
} as const;
