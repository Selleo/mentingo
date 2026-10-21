import { CONTENT_MARKETPLACE_DURATIONS, CONTENT_MARKETPLACE_SORT } from "@repo/shared";
import { match } from "ts-pattern";

import { CONTENT_MARKETPLACE_FILTER_ALL } from "../contentMarketplace.constants";

export const findContentMarketplaceDuration = (value: string) =>
  Object.values(CONTENT_MARKETPLACE_DURATIONS).find((duration) => duration === value);

export const findContentMarketplaceSort = (value: string) =>
  Object.values(CONTENT_MARKETPLACE_SORT).find((sort) => sort === value);

export const toContentMarketplaceCategoryQuery = (category: string) =>
  match(category)
    .with(CONTENT_MARKETPLACE_FILTER_ALL, () => undefined)
    .otherwise((selectedCategory) => selectedCategory);
